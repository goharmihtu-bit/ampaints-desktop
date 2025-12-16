import crypto from "crypto"

const ALGO = "aes-256-gcm"

function getKey() {
  const key = process.env.CLOUD_SYNC_ENCRYPTION_KEY
  if (!key) {
    // Generate a default key if not set (for development/desktop use)
    // In production, this should be set via environment variable
    const defaultKey = "default-encryption-key-change-me-in-production"
    console.warn("[CloudSync] CLOUD_SYNC_ENCRYPTION_KEY not set, using default key. Set this environment variable in production!")
    const buf = Buffer.alloc(32)
    Buffer.from(defaultKey).copy(buf)
    return buf
  }
  // Ensure Buffer length 32
  const buf = Buffer.alloc(32)
  Buffer.from(key).copy(buf)
  return buf
}

export function encryptString(plain: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptString(payload: string) {
  const data = Buffer.from(payload, "base64")
  const iv = data.slice(0, 12)
  const tag = data.slice(12, 28)
  const encrypted = data.slice(28)
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
  return plain
}

export async function saveConnection({ id, provider, label, connectionString }: { id: string; provider: string; label?: string; connectionString: string }) {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) throw new Error("sqliteDb not available")
  const encrypted = encryptString(connectionString)
  sqliteDb.prepare(`INSERT OR REPLACE INTO cloud_sync_connections (id, provider, label, connection_string_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`).run(id, provider, label || null, encrypted)
}

export async function listConnections() {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return []
  return sqliteDb.prepare("SELECT id, provider, label, created_at, updated_at FROM cloud_sync_connections ORDER BY created_at DESC").all()
}

export async function getConnection(connectionId: string) {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return null
  const row = sqliteDb.prepare("SELECT * FROM cloud_sync_connections WHERE id = ?").get(connectionId)
  if (!row) return null
  try {
    const decrypted = decryptString(row.connection_string_encrypted)
    return { ...row, connectionString: decrypted }
  } catch (err) {
    console.error("[CloudSync] Error decrypting connection string:", err)
    return null
  }
}

export async function deleteConnection(connectionId: string) {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) return
  sqliteDb.prepare("DELETE FROM cloud_sync_connections WHERE id = ?").run(connectionId)
}

export async function enqueueJob(params: { id: string; jobType: string; provider: string; connectionId: string; dryRun?: boolean; initiatedBy?: string; details?: string }) {
  const { sqliteDb } = await import("./db")
  if (!sqliteDb) throw new Error("sqliteDb not available")
  sqliteDb.prepare(`INSERT INTO cloud_sync_jobs (id, job_type, provider, status, dry_run, initiated_by, details, attempts, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, 0, datetime('now'), datetime('now'))`).run(params.id, params.jobType, params.provider, params.dryRun ? 1 : 0, params.initiatedBy || null, params.details || null)
}
