import { useState, useEffect, useCallback, useRef } from "react"
import { apiRequest } from "@/lib/queryClient"

interface LicenseStatus {
  deviceId: string
  status: string
  isBlocked: boolean
  blockedReason: string | null
  blockedAt: string | null
  message: string
}

interface UseLicenseReturn {
  isLoading: boolean
  isBlocked: boolean
  blockedReason: string | null
  deviceId: string | null
  // returns true on successful check
  checkLicense: (suppressInitialLoading?: boolean) => Promise<boolean>
  error: string | null
}

// Default to once-a-day checks (24 hours). Can be overridden by Vite env
// `VITE_LICENSE_HEARTBEAT_MS` (milliseconds). Set to `0` to disable periodic
// background checks entirely (useful for kiosks or offline setups).
const DEFAULT_HEARTBEAT = 24 * 60 * 60 * 1000 // 24 hours
const HEARTBEAT_INTERVAL = Number(import.meta.env?.VITE_LICENSE_HEARTBEAT_MS) || DEFAULT_HEARTBEAT

const LAST_CHECK_KEY = "paintpulse_license_last_check"

function getLastCheck(): number | null {
  try {
    const v = localStorage.getItem(LAST_CHECK_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

function setLastCheck(ts: number): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, String(ts))
  } catch {
    // ignore
  }
}

function getStoredDeviceId(): string | null {
  try {
    return localStorage.getItem("paintpulse_device_id")
  } catch {
    return null
  }
}

function setStoredDeviceId(deviceId: string): void {
  try {
    localStorage.setItem("paintpulse_device_id", deviceId)
  } catch {
  }
}

function generateDeviceId(): string {
  const random = Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now().toString(36)
  return `${random}${timestamp}`.substring(0, 16)
}

export function useLicense(): UseLicenseReturn {
  // `isInitialLoading` is used to show the full-screen loader only for the
  // first (initial) license verification. Subsequent periodic checks should
  // be non-blocking to avoid disturbing the UI (e.g., POS page).
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  // `suppressInitialLoading` when true prevents toggling the initial loading
  // state so periodic background checks won't render the blocking loader.
  const checkLicense = useCallback(async (suppressInitialLoading = false) => {
    try {
      if (!suppressInitialLoading) setIsInitialLoading(true)
      setError(null)

      let currentDeviceId = getStoredDeviceId()
      if (!currentDeviceId) {
        currentDeviceId = generateDeviceId()
        setStoredDeviceId(currentDeviceId)
      }

      const settingsResponse = await fetch("/api/settings")
      const settings = await settingsResponse.json()
      const storeName = settings.storeName || "PaintPulse"

      const response = await apiRequest("POST", "/api/license/check", {
        deviceId: currentDeviceId,
        deviceName: `Web Browser`,
        storeName,
      })

      const data: LicenseStatus = await response.json()
      
      setDeviceId(data.deviceId)
      setIsBlocked(data.isBlocked)
      setBlockedReason(data.blockedReason)

      if (data.isBlocked) {
        console.warn("[License] Software is blocked:", data.blockedReason)
      }

      // mark successful check
      setLastCheck(Date.now())
      return true
    } catch (err) {
      console.error("[License] Error checking license:", err)
      setError("Failed to verify license - please check your connection")
      return false
    } finally {
      if (!suppressInitialLoading) setIsInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const scheduleNext = (delay = HEARTBEAT_INTERVAL) => {
      if (!mounted) return
      // clear previous
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (!delay || delay <= 0) return
      timeoutRef.current = window.setTimeout(async () => {
        const ok = await checkLicense(true)
        if (ok) scheduleNext(HEARTBEAT_INTERVAL)
      }, delay)
    }

    // Initial (blocking) license check on mount
    checkLicense(false).then((ok) => {
      if (!mounted) return
      if (ok) {
        // compute remaining delay based on last check
        const last = getLastCheck()
        const elapsed = last ? Date.now() - last : HEARTBEAT_INTERVAL
        const delay = Math.max(0, HEARTBEAT_INTERVAL - elapsed)
        scheduleNext(delay)
      }
    })

    // On window focus, if last check older than HEARTBEAT_INTERVAL, run a
    // non-blocking check (this covers the "open next day" behavior when the
    // app is brought to foreground).
    const onFocus = () => {
      const last = getLastCheck()
      if (!HEARTBEAT_INTERVAL || HEARTBEAT_INTERVAL <= 0) return
      if (!last || Date.now() - last >= HEARTBEAT_INTERVAL) {
        checkLicense(true).then((ok) => {
          if (ok) scheduleNext(HEARTBEAT_INTERVAL)
        })
      }
    }

    window.addEventListener("focus", onFocus)

    return () => {
      mounted = false
      window.removeEventListener("focus", onFocus)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [checkLicense])

  return {
    // keep the external API name `isLoading` for compatibility, but expose
    // the initial-loading-only semantics
    isLoading: isInitialLoading,
    isBlocked,
    blockedReason,
    deviceId,
    checkLicense,
    error,
  }
}
