import crypto from "crypto"

export interface JobResult {
  id: string
  status: 'success' | 'failed'
  result?: any
  error?: string
  duration?: number
}

export async function processNextJob(): Promise<JobResult | null> {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) throw new Error("sqliteDb not available")

  const job = sqliteDb.prepare("SELECT * FROM cloud_sync_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1").get() as any
  if (!job) return null

  const startTime = Date.now()
  
  // Lock job
  sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'running', attempts = attempts + 1, updated_at = datetime('now') WHERE id = ?").run(job.id)

  try {
    console.log(`[CloudSyncWorker] Processing job ${job.id} type=${job.job_type} dry_run=${job.dry_run}`)

    // Use export/import implementations when available
    try {
      if (job.job_type === 'export') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connection_id)
        if (!conn) throw new Error('Connection not found')
        
        const { exportToPostgres } = await import('./cloudSyncExport')
        const result = await exportToPostgres(conn.connectionString, job.dry_run === 1)
        
        const duration = Date.now() - startTime
        
        // Store detailed result
        const resultSummary = {
          ...result.summary,
          totalRows: result.totalRows,
          totalExported: result.totalExported,
          totalErrors: result.totalErrors,
          exportChecksum: result.exportChecksum,
          duration: result.duration,
          timestamp: result.timestamp
        }
        
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(resultSummary), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (export) in ${duration}ms`)
        
        return { 
          id: job.id, 
          status: 'success', 
          result: resultSummary,
          duration 
        }
      }

      if (job.job_type === 'import') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connection_id)
        if (!conn) throw new Error('Connection not found')
        
        const { importFromPostgres } = await import('./cloudSyncImport')
        
        // Parse job details for strategy
        let strategy = 'merge'
        let createBackup = true
        try {
          const details = job.details ? JSON.parse(job.details) : null
          if (details && details.strategy) strategy = details.strategy
          if (details && details.createBackup !== undefined) createBackup = details.createBackup
        } catch (err) {
          // ignore parse errors, use defaults
        }

        const result = await importFromPostgres(conn.connectionString, strategy, job.dry_run === 1, createBackup)
        
        const duration = Date.now() - startTime
        
        // Store detailed result
        const resultSummary = {
          ...result.summary,
          totalRows: result.totalRows,
          totalImported: result.totalImported,
          totalSkipped: result.totalSkipped,
          totalErrors: result.totalErrors,
          importChecksum: result.importChecksum,
          backupPath: result.backupPath,
          duration: result.duration,
          timestamp: result.timestamp
        }
        
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(resultSummary), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (import) in ${duration}ms`)
        
        return { 
          id: job.id, 
          status: 'success', 
          result: resultSummary,
          duration 
        }
      }

      if (job.job_type === 'verify_export') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connection_id)
        if (!conn) throw new Error('Connection not found')
        
        const { verifyExport } = await import('./cloudSyncExport')
        const result = await verifyExport(conn.connectionString)
        
        const duration = Date.now() - startTime
        
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(result), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (verify_export) in ${duration}ms`)
        
        return { 
          id: job.id, 
          status: 'success', 
          result,
          duration 
        }
      }

      if (job.job_type === 'verify_import') {
        const { getConnection } = await import('./cloudSync')
        const conn = await getConnection(job.connection_id)
        if (!conn) throw new Error('Connection not found')
        
        const { verifyImport } = await import('./cloudSyncImport')
        const result = await verifyImport(conn.connectionString)
        
        const duration = Date.now() - startTime
        
        sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'success', details = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(result), job.id)
        console.log(`[CloudSyncWorker] Job ${job.id} completed (verify_import) in ${duration}ms`)
        
        return { 
          id: job.id, 
          status: 'success', 
          result,
          duration 
        }
      }

      // Unknown job type
      const duration = Date.now() - startTime
      sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run('Unknown job type: ' + job.job_type, job.id)
      return { id: job.id, status: 'failed', error: 'Unknown job type: ' + job.job_type, duration }
    } catch (err: any) {
      const duration = Date.now() - startTime
      console.error(`[CloudSyncWorker] Job ${job.id} execution error:`, err)
      sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(err?.message || String(err), job.id)
      return { id: job.id, status: 'failed', error: err?.message, duration }
    }
  } catch (err: any) {
    const duration = Date.now() - startTime
    console.error(`[CloudSyncWorker] Job ${job.id} failed:`, err)
    sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'failed', last_error = ?, updated_at = datetime('now') WHERE id = ?").run(err?.message || String(err), job.id)
    return { id: job.id, status: 'failed', error: err?.message, duration }
  }
}

// Process all pending jobs
export async function processAllPendingJobs(): Promise<{ processed: number; results: JobResult[] }> {
  const results: JobResult[] = []
  let processed = 0
  
  while (true) {
    const result = await processNextJob()
    if (!result) break
    
    results.push(result)
    processed++
    
    // Small delay between jobs to prevent overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  return { processed, results }
}

// Get job status
export async function getJobStatus(jobId: string): Promise<any | null> {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return null
  
  const job = sqliteDb.prepare("SELECT * FROM cloud_sync_jobs WHERE id = ?").get(jobId) as any
  if (!job) return null
  
  // Parse details if present
  let parsedDetails = null
  if (job.details) {
    try {
      parsedDetails = JSON.parse(job.details)
    } catch (e) {
      parsedDetails = job.details
    }
  }
  
  return {
    ...job,
    parsedDetails
  }
}

// Cancel a pending job
export async function cancelJob(jobId: string): Promise<boolean> {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return false
  
  const job = sqliteDb.prepare("SELECT status FROM cloud_sync_jobs WHERE id = ?").get(jobId) as any
  if (!job) return false
  
  if (job.status !== 'pending') {
    throw new Error(`Cannot cancel job with status: ${job.status}`)
  }
  
  sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(jobId)
  return true
}

// Retry a failed job
export async function retryJob(jobId: string): Promise<boolean> {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return false
  
  const job = sqliteDb.prepare("SELECT status FROM cloud_sync_jobs WHERE id = ?").get(jobId) as any
  if (!job) return false
  
  if (job.status !== 'failed') {
    throw new Error(`Cannot retry job with status: ${job.status}`)
  }
  
  sqliteDb.prepare("UPDATE cloud_sync_jobs SET status = 'pending', last_error = NULL, updated_at = datetime('now') WHERE id = ?").run(jobId)
  return true
}

// Clean up old completed jobs (older than specified days)
export async function cleanupOldJobs(daysOld: number = 30): Promise<number> {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return 0
  
  const result = sqliteDb.prepare(`
    DELETE FROM cloud_sync_jobs 
    WHERE status IN ('success', 'failed', 'cancelled') 
    AND datetime(updated_at) < datetime('now', '-' || ? || ' days')
  `).run(daysOld)
  
  return result.changes
}
