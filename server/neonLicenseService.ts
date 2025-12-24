/**
 * Neon License Service - Remote License Management
 * 
 * This service securely connects to a Neon PostgreSQL database for:
 * - Tracking software instances across multiple desktops
 * - Managing billing status (active, expired, blocked)
 * - Monitoring software active time (24-hour performance reports)
 * - Silent error handling (errors logged to database, never shown to clients)
 * 
 * SECURITY: Database URL is read from environment variable NEON_LICENSE_DB_URL
 * Never hardcode database credentials in source code!
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless"
import os from "os"
import crypto from "crypto"

// Environment variable for Neon database URL
const NEON_LICENSE_DB_URL = process.env.NEON_LICENSE_DB_URL

// Cache for SQL connection to avoid reconnecting on every call
let cachedSql: NeonQueryFunction<false, false> | null = null

// Session tracking
let sessionStartTime: Date | null = null
let lastHeartbeatTime: Date | null = null
const HEARTBEAT_INTERVAL = 60000 // 1 minute heartbeat interval

// Error logging cache to prevent flooding
const errorCache = new Map<string, { count: number; lastLogged: Date }>()
const ERROR_LOG_INTERVAL = 300000 // 5 minutes between same error logs
const MAX_ERROR_CACHE_SIZE = 100 // Maximum number of cached errors to prevent memory leak

// Types for license data
export interface NeonLicenseRecord {
  id: string
  device_id: string
  pc_name: string
  store_name: string | null
  status: 'active' | 'blocked' | 'expired' | 'suspended'
  billing_status: 'paid' | 'unpaid' | 'trial' | 'grace_period'
  expiry_date: string | null // YYYY-MM-DD
  blocked_reason: string | null
  blocked_at: string | null
  last_heartbeat: string
  last_session_start: string | null
  total_active_minutes: number
  today_active_minutes: number
  ip_address: string | null
  user_agent: string | null
  app_version: string | null
  created_at: string
  updated_at: string
}

export interface NeonActivityLog {
  id: string
  device_id: string
  pc_name: string
  action: string
  session_start: string
  session_end: string | null
  duration_minutes: number
  date_key: string // YYYY-MM-DD for daily aggregation
  created_at: string
}

export interface NeonErrorLog {
  id: string
  device_id: string
  pc_name: string
  error_type: string
  error_message: string
  error_stack: string | null
  created_at: string
}

export interface DailyPerformanceReport {
  date: string
  pc_name: string
  total_sessions: number
  total_active_minutes: number
  first_session: string
  last_session: string
}

/**
 * Get PC name for multi-device identification
 */
export function getPcName(): string {
  try {
    const hostname = os.hostname()
    const platform = os.platform()
    const arch = os.arch()
    return `${hostname}-${platform}-${arch}`
  } catch (error) {
    return `unknown-${Date.now()}`
  }
}

/**
 * Get a unique device ID based on hardware and hostname
 */
export function getDeviceId(): string {
  try {
    const hostname = os.hostname()
    const platform = os.platform()
    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown'
    const totalMem = os.totalmem()
    
    // Create a stable device ID from hardware characteristics using SHA256
    const baseString = `${hostname}-${platform}-${cpuModel}-${totalMem}`
    const hash = crypto.createHash('sha256').update(baseString).digest('hex').substring(0, 16)
    
    return `device-${hash}`
  } catch (error) {
    return `device-${Date.now()}`
  }
}

/**
 * Check if Neon license service is configured
 */
export function isNeonLicenseConfigured(): boolean {
  return !!NEON_LICENSE_DB_URL && NEON_LICENSE_DB_URL.startsWith('postgresql://')
}

/**
 * Get Neon SQL connection (with caching)
 */
function getNeonSql(): NeonQueryFunction<false, false> | null {
  if (!isNeonLicenseConfigured()) {
    return null
  }
  
  if (!cachedSql) {
    try {
      cachedSql = neon(NEON_LICENSE_DB_URL!)
    } catch (error) {
      console.error('[NeonLicense] Failed to create Neon connection:', error)
      return null
    }
  }
  
  return cachedSql
}

/**
 * Initialize database tables if they don't exist
 * Called on first connection
 */
async function initializeTables(): Promise<boolean> {
  const sql = getNeonSql()
  if (!sql) return false

  try {
    // Create software_instances table for tracking devices
    await sql`
      CREATE TABLE IF NOT EXISTS software_instances (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        device_id TEXT NOT NULL UNIQUE,
        pc_name TEXT NOT NULL,
        store_name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        billing_status TEXT NOT NULL DEFAULT 'trial',
        expiry_date DATE,
        blocked_reason TEXT,
        blocked_at TIMESTAMPTZ,
        last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_session_start TIMESTAMPTZ,
        total_active_minutes INTEGER NOT NULL DEFAULT 0,
        today_active_minutes INTEGER NOT NULL DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        app_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create activity_logs table for tracking sessions
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        device_id TEXT NOT NULL,
        pc_name TEXT NOT NULL,
        action TEXT NOT NULL,
        session_start TIMESTAMPTZ NOT NULL,
        session_end TIMESTAMPTZ,
        duration_minutes INTEGER NOT NULL DEFAULT 0,
        date_key DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create error_logs table for silent error tracking
    await sql`
      CREATE TABLE IF NOT EXISTS error_logs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        device_id TEXT NOT NULL,
        pc_name TEXT NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_software_instances_device_id ON software_instances(device_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_software_instances_status ON software_instances(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_device_date ON activity_logs(device_id, date_key)`
    await sql`CREATE INDEX IF NOT EXISTS idx_error_logs_device_date ON error_logs(device_id, created_at)`

    console.log('[NeonLicense] ✅ Database tables initialized successfully')
    return true
  } catch (error) {
    console.error('[NeonLicense] ❌ Failed to initialize tables:', error)
    return false
  }
}

/**
 * Log error to Neon database silently
 * This ensures errors are tracked without disrupting the user experience
 */
export async function logErrorToNeon(
  errorType: string,
  errorMessage: string,
  errorStack?: string
): Promise<void> {
  // Check error cache to prevent flooding
  const cacheKey = `${errorType}:${errorMessage.substring(0, 100)}`
  const cached = errorCache.get(cacheKey)
  const now = new Date()
  
  if (cached && (now.getTime() - cached.lastLogged.getTime()) < ERROR_LOG_INTERVAL) {
    // Already logged recently, skip
    return
  }
  
  // Clean up old cache entries to prevent memory leak
  if (errorCache.size >= MAX_ERROR_CACHE_SIZE) {
    const oldestEntries = Array.from(errorCache.entries())
      .sort((a, b) => a[1].lastLogged.getTime() - b[1].lastLogged.getTime())
      .slice(0, errorCache.size - MAX_ERROR_CACHE_SIZE + 1)
    
    for (const [key] of oldestEntries) {
      errorCache.delete(key)
    }
  }
  
  errorCache.set(cacheKey, { count: 1, lastLogged: now })

  const sql = getNeonSql()
  if (!sql) return // Silently fail if not configured

  const deviceId = getDeviceId()
  const pcName = getPcName()

  try {
    await sql`
      INSERT INTO error_logs (device_id, pc_name, error_type, error_message, error_stack)
      VALUES (${deviceId}, ${pcName}, ${errorType}, ${errorMessage}, ${errorStack || null})
    `
  } catch (dbError) {
    // Silently fail - we don't want to create infinite error loops
    console.error('[NeonLicense] Silent error log failed (not critical):', dbError)
  }
}

/**
 * Register or update software instance in Neon database
 * This is called on application startup and periodically
 */
export async function registerSoftwareInstance(
  storeName?: string,
  appVersion?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<NeonLicenseRecord | null> {
  const sql = getNeonSql()
  if (!sql) return null

  const deviceId = getDeviceId()
  const pcName = getPcName()

  try {
    // Initialize tables on first call
    await initializeTables()

    // Upsert the software instance
    const result = await sql`
      INSERT INTO software_instances (device_id, pc_name, store_name, app_version, ip_address, user_agent, last_heartbeat)
      VALUES (${deviceId}, ${pcName}, ${storeName || null}, ${appVersion || null}, ${ipAddress || null}, ${userAgent || null}, NOW())
      ON CONFLICT (device_id) DO UPDATE SET
        pc_name = ${pcName},
        store_name = COALESCE(${storeName}, software_instances.store_name),
        app_version = COALESCE(${appVersion}, software_instances.app_version),
        ip_address = COALESCE(${ipAddress}, software_instances.ip_address),
        user_agent = COALESCE(${userAgent}, software_instances.user_agent),
        last_heartbeat = NOW(),
        updated_at = NOW()
      RETURNING *
    `

    if (result.length > 0) {
      console.log(`[NeonLicense] ✅ Software instance registered: ${pcName} (${deviceId})`)
      return result[0] as unknown as NeonLicenseRecord
    }

    return null
  } catch (error) {
    await logErrorToNeon('registration_error', String(error), (error as Error)?.stack)
    return null
  }
}

/**
 * Check license status from Neon database
 * Returns status information or null if not configured/error
 */
export async function checkNeonLicenseStatus(): Promise<{
  isBlocked: boolean
  isExpired: boolean
  status: string
  billingStatus: string
  blockedReason: string | null
  expiryDate: string | null
  message: string
} | null> {
  const sql = getNeonSql()
  if (!sql) return null

  const deviceId = getDeviceId()

  try {
    const result = await sql`
      SELECT status, billing_status, expiry_date, blocked_reason
      FROM software_instances
      WHERE device_id = ${deviceId}
    `

    if (result.length === 0) {
      // Device not registered, register it now
      await registerSoftwareInstance()
      return {
        isBlocked: false,
        isExpired: false,
        status: 'active',
        billingStatus: 'trial',
        blockedReason: null,
        expiryDate: null,
        message: 'New device registered'
      }
    }

    const record = result[0] as any
    const today = new Date().toISOString().split('T')[0]
    const isExpired = record.expiry_date && record.expiry_date < today
    const isBlocked = record.status === 'blocked' || record.status === 'suspended'

    let message = 'License active'
    if (isBlocked) {
      message = record.blocked_reason || 'Software blocked by administrator'
    } else if (isExpired) {
      message = `License expired on ${record.expiry_date}. Please renew.`
    }

    return {
      isBlocked,
      isExpired,
      status: record.status,
      billingStatus: record.billing_status,
      blockedReason: record.blocked_reason,
      expiryDate: record.expiry_date,
      message
    }
  } catch (error) {
    await logErrorToNeon('license_check_error', String(error), (error as Error)?.stack)
    return null
  }
}

/**
 * Start a new session - called when application starts
 */
export async function startSession(): Promise<void> {
  sessionStartTime = new Date()
  lastHeartbeatTime = new Date()
  
  const sql = getNeonSql()
  if (!sql) return

  const deviceId = getDeviceId()
  const pcName = getPcName()

  try {
    // Record session start
    await sql`
      INSERT INTO activity_logs (device_id, pc_name, action, session_start, date_key)
      VALUES (${deviceId}, ${pcName}, 'session_start', NOW(), CURRENT_DATE)
    `

    // Update last_session_start on the instance
    await sql`
      UPDATE software_instances 
      SET last_session_start = NOW(), last_heartbeat = NOW(), updated_at = NOW()
      WHERE device_id = ${deviceId}
    `

    console.log(`[NeonLicense] ✅ Session started for ${pcName}`)
  } catch (error) {
    await logErrorToNeon('session_start_error', String(error), (error as Error)?.stack)
  }
}

/**
 * Send heartbeat to track active time
 * Should be called periodically (every minute recommended)
 */
export async function sendHeartbeat(): Promise<void> {
  const sql = getNeonSql()
  if (!sql) return

  const deviceId = getDeviceId()
  const now = new Date()

  // Calculate minutes since last heartbeat
  const minutesSinceLastHeartbeat = lastHeartbeatTime 
    ? Math.floor((now.getTime() - lastHeartbeatTime.getTime()) / 60000)
    : 0

  lastHeartbeatTime = now

  try {
    // Update heartbeat and active minutes
    await sql`
      UPDATE software_instances 
      SET 
        last_heartbeat = NOW(),
        total_active_minutes = total_active_minutes + ${minutesSinceLastHeartbeat},
        -- Reset today_active_minutes if last_heartbeat was on a different day
        -- This handles gaps in usage where the app wasn't used for multiple days
        today_active_minutes = CASE 
          WHEN DATE(last_heartbeat) < CURRENT_DATE THEN ${minutesSinceLastHeartbeat}
          ELSE today_active_minutes + ${minutesSinceLastHeartbeat}
        END,
        updated_at = NOW()
      WHERE device_id = ${deviceId}
    `
  } catch (error) {
    await logErrorToNeon('heartbeat_error', String(error), (error as Error)?.stack)
  }
}

/**
 * End session - called when application closes
 */
export async function endSession(): Promise<void> {
  const sql = getNeonSql()
  if (!sql) return

  const deviceId = getDeviceId()
  const pcName = getPcName()

  // Calculate session duration
  const sessionDuration = sessionStartTime 
    ? Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 60000)
    : 0

  try {
    // Update the most recent session_start log with end time
    await sql`
      UPDATE activity_logs 
      SET session_end = NOW(), duration_minutes = ${sessionDuration}
      WHERE device_id = ${deviceId} 
        AND action = 'session_start' 
        AND session_end IS NULL
        AND date_key = CURRENT_DATE
    `

    console.log(`[NeonLicense] Session ended for ${pcName} (${sessionDuration} minutes)`)
  } catch (error) {
    await logErrorToNeon('session_end_error', String(error), (error as Error)?.stack)
  }

  sessionStartTime = null
  lastHeartbeatTime = null
}

/**
 * Get 24-hour performance report for a device or all devices
 */
export async function get24HourPerformanceReport(
  targetDeviceId?: string
): Promise<DailyPerformanceReport[]> {
  const sql = getNeonSql()
  if (!sql) return []

  try {
    let result
    if (targetDeviceId) {
      result = await sql`
        SELECT 
          date_key::text as date,
          pc_name,
          COUNT(*) as total_sessions,
          COALESCE(SUM(duration_minutes), 0) as total_active_minutes,
          MIN(session_start)::text as first_session,
          MAX(COALESCE(session_end, session_start))::text as last_session
        FROM activity_logs
        WHERE device_id = ${targetDeviceId}
          AND date_key >= CURRENT_DATE - INTERVAL '1 day'
        GROUP BY date_key, pc_name
        ORDER BY date_key DESC
      `
    } else {
      result = await sql`
        SELECT 
          date_key::text as date,
          pc_name,
          COUNT(*) as total_sessions,
          COALESCE(SUM(duration_minutes), 0) as total_active_minutes,
          MIN(session_start)::text as first_session,
          MAX(COALESCE(session_end, session_start))::text as last_session
        FROM activity_logs
        WHERE date_key >= CURRENT_DATE - INTERVAL '1 day'
        GROUP BY date_key, pc_name
        ORDER BY date_key DESC, pc_name
      `
    }

    return result as unknown as DailyPerformanceReport[]
  } catch (error) {
    await logErrorToNeon('performance_report_error', String(error), (error as Error)?.stack)
    return []
  }
}

/**
 * Get all registered software instances (admin function)
 */
export async function getAllSoftwareInstances(): Promise<NeonLicenseRecord[]> {
  const sql = getNeonSql()
  if (!sql) return []

  try {
    const result = await sql`
      SELECT * FROM software_instances
      ORDER BY last_heartbeat DESC
    `
    return result as unknown as NeonLicenseRecord[]
  } catch (error) {
    await logErrorToNeon('get_instances_error', String(error), (error as Error)?.stack)
    return []
  }
}

/**
 * Update billing status for a device (admin function)
 */
export async function updateBillingStatus(
  targetDeviceId: string,
  billingStatus: 'paid' | 'unpaid' | 'trial' | 'grace_period',
  expiryDate?: string
): Promise<boolean> {
  const sql = getNeonSql()
  if (!sql) return false

  try {
    await sql`
      UPDATE software_instances 
      SET 
        billing_status = ${billingStatus},
        expiry_date = ${expiryDate || null},
        status = CASE 
          WHEN ${billingStatus} = 'unpaid' THEN 'suspended'
          ELSE 'active'
        END,
        updated_at = NOW()
      WHERE device_id = ${targetDeviceId}
    `
    return true
  } catch (error) {
    await logErrorToNeon('update_billing_error', String(error), (error as Error)?.stack)
    return false
  }
}

/**
 * Block a software instance (admin function)
 */
export async function blockSoftwareInstance(
  targetDeviceId: string,
  reason: string
): Promise<boolean> {
  const sql = getNeonSql()
  if (!sql) return false

  try {
    await sql`
      UPDATE software_instances 
      SET 
        status = 'blocked',
        blocked_reason = ${reason},
        blocked_at = NOW(),
        updated_at = NOW()
      WHERE device_id = ${targetDeviceId}
    `
    return true
  } catch (error) {
    await logErrorToNeon('block_instance_error', String(error), (error as Error)?.stack)
    return false
  }
}

/**
 * Unblock a software instance (admin function)
 */
export async function unblockSoftwareInstance(targetDeviceId: string): Promise<boolean> {
  const sql = getNeonSql()
  if (!sql) return false

  try {
    await sql`
      UPDATE software_instances 
      SET 
        status = 'active',
        blocked_reason = NULL,
        blocked_at = NULL,
        updated_at = NOW()
      WHERE device_id = ${targetDeviceId}
    `
    return true
  } catch (error) {
    await logErrorToNeon('unblock_instance_error', String(error), (error as Error)?.stack)
    return false
  }
}

/**
 * Set expiry date for a device (admin function)
 */
export async function setExpiryDate(
  targetDeviceId: string,
  expiryDate: string | null
): Promise<boolean> {
  const sql = getNeonSql()
  if (!sql) return false

  try {
    await sql`
      UPDATE software_instances 
      SET 
        expiry_date = ${expiryDate},
        status = CASE 
          WHEN ${expiryDate} IS NOT NULL AND ${expiryDate}::date < CURRENT_DATE THEN 'expired'
          ELSE 'active'
        END,
        updated_at = NOW()
      WHERE device_id = ${targetDeviceId}
    `
    return true
  } catch (error) {
    await logErrorToNeon('set_expiry_error', String(error), (error as Error)?.stack)
    return false
  }
}

/**
 * Get error logs for a device (admin function)
 */
export async function getErrorLogs(
  targetDeviceId?: string,
  limit: number = 100
): Promise<NeonErrorLog[]> {
  const sql = getNeonSql()
  if (!sql) return []

  try {
    let result
    if (targetDeviceId) {
      result = await sql`
        SELECT * FROM error_logs
        WHERE device_id = ${targetDeviceId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    } else {
      result = await sql`
        SELECT * FROM error_logs
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    }
    return result as unknown as NeonErrorLog[]
  } catch (error) {
    console.error('[NeonLicense] Failed to get error logs:', error)
    return []
  }
}

/**
 * Start automatic heartbeat interval
 * Returns cleanup function to stop the interval
 */
export function startHeartbeatInterval(): () => void {
  if (!isNeonLicenseConfigured()) {
    return () => {} // No-op if not configured
  }

  // Start session immediately
  startSession()

  // Set up heartbeat interval
  const intervalId = setInterval(() => {
    sendHeartbeat().catch(err => {
      console.error('[NeonLicense] Heartbeat failed:', err)
    })
  }, HEARTBEAT_INTERVAL)

  // Return cleanup function
  return () => {
    clearInterval(intervalId)
    endSession().catch(err => {
      console.error('[NeonLicense] Failed to end session:', err)
    })
  }
}
