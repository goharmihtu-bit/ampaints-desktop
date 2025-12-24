# Neon Remote License Management Configuration

This document explains how to configure the Neon PostgreSQL database for remote license management, billing status tracking, and 24-hour performance reports.

## Features

- **Multi-Desktop Tracking**: Each software instance is identified by PC name
- **Billing Status Management**: Active, Expired, Blocked, Suspended states
- **24-Hour Performance Reports**: Track software active time per device
- **Silent Error Handling**: Errors are logged to database, never shown to users
- **Secure Configuration**: Database URL stored in environment variable

## Security Notice ⚠️

**NEVER hardcode database credentials in source code!** 

The Neon database URL contains sensitive credentials and must be stored securely using environment variables.

## Configuration Steps

### 1. Set Environment Variable

Add the Neon database URL to your environment:

**Windows (PowerShell)**:
```powershell
$env:NEON_LICENSE_DB_URL = "postgresql://neondb_owner:your_password@your-endpoint.neon.tech/neondb?sslmode=require"
```

**Windows (System Environment)**:
1. Open System Properties → Environment Variables
2. Add new User or System variable:
   - Name: `NEON_LICENSE_DB_URL`
   - Value: Your Neon connection string

**Linux/macOS**:
```bash
export NEON_LICENSE_DB_URL="postgresql://neondb_owner:your_password@your-endpoint.neon.tech/neondb?sslmode=require"
```

**For Production Deployment**:
Add to your `.env` file or deployment configuration:
```
NEON_LICENSE_DB_URL=postgresql://neondb_owner:your_password@your-endpoint.neon.tech/neondb?sslmode=require
```

### 2. Database Tables (Auto-Created)

The following tables are automatically created when the service first connects:

#### `software_instances`
Tracks all registered software instances:
- `device_id` - Unique identifier based on hardware
- `pc_name` - Human-readable PC name (hostname-platform-arch)
- `store_name` - Store name associated with this device
- `status` - active, blocked, expired, suspended
- `billing_status` - paid, unpaid, trial, grace_period
- `expiry_date` - License expiration date
- `last_heartbeat` - Last activity timestamp
- `total_active_minutes` - Total tracked active time
- `today_active_minutes` - Today's active time

#### `activity_logs`
Tracks session activity for performance reports:
- `session_start` - When session started
- `session_end` - When session ended
- `duration_minutes` - Session duration
- `date_key` - Date for daily aggregation

#### `error_logs`
Silent error tracking (never shown to users):
- `error_type` - Category of error
- `error_message` - Error description
- `error_stack` - Stack trace (if available)

## API Endpoints

### Public Endpoints (No PIN Required)

#### Check License Status
```
GET /api/neon-license/status
```
Returns license status, PC name, and device ID.

#### Register Instance
```
POST /api/neon-license/register
Body: { storeName: string, appVersion: string }
```
Registers or updates the software instance.

#### Send Heartbeat
```
POST /api/neon-license/heartbeat
```
Updates last activity timestamp and tracks active time.

#### Session Management
```
POST /api/neon-license/session/start
POST /api/neon-license/session/end
```
Start/end session tracking.

### Admin Endpoints (Master PIN Required)

All admin endpoints require `masterPin` in the request body.

#### Get All Instances
```
POST /api/neon-license/instances
Body: { masterPin: string }
```

#### Get Performance Report
```
POST /api/neon-license/performance-report
Body: { masterPin: string, deviceId?: string }
```

#### Update Billing Status
```
POST /api/neon-license/update-billing
Body: { masterPin: string, deviceId: string, billingStatus: string, expiryDate?: string }
```
Valid billing statuses: paid, unpaid, trial, grace_period

#### Block Instance
```
POST /api/neon-license/block
Body: { masterPin: string, deviceId: string, reason?: string }
```

#### Unblock Instance
```
POST /api/neon-license/unblock
Body: { masterPin: string, deviceId: string }
```

#### Set Expiry Date
```
POST /api/neon-license/set-expiry
Body: { masterPin: string, deviceId: string, expiryDate: string }
```
Date format: YYYY-MM-DD

#### Get Error Logs
```
POST /api/neon-license/error-logs
Body: { masterPin: string, deviceId?: string, limit?: number }
```

## How It Works

### Automatic Heartbeat
When the server starts with `NEON_LICENSE_DB_URL` configured:
1. A session is automatically started
2. Heartbeats are sent every 60 seconds
3. Active time is tracked and accumulated
4. Session ends when server shuts down

### Multi-Device Tracking
Each device is identified by:
- Hardware-based device ID (stable across reinstalls)
- PC name (hostname-platform-architecture)

### Silent Error Handling
- Errors are logged to the `error_logs` table
- Errors are never shown to end users
- Error logging has rate limiting to prevent flooding
- Same errors are only logged every 5 minutes

### Performance Reports
24-hour reports show:
- Total sessions per device
- Total active minutes
- First and last session times
- Daily aggregation by PC name

## Troubleshooting

### Service Not Working
1. Check if `NEON_LICENSE_DB_URL` is set correctly
2. Verify the connection string is valid
3. Check server logs for `[NeonLicense]` messages

### Check Configuration
```
GET /api/neon-license/status
```
Returns `configured: false` if not set up properly.

### View Logs
Server logs will show:
- `[NeonLicense] Starting heartbeat interval...` - Service starting
- `[NeonLicense] ✅ Heartbeat service started` - Service running
- `[NeonLicense] Not configured...` - Missing environment variable
