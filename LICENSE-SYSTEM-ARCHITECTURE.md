# License System - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN INTERFACE                               │
│              Settings → License Tab                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Current License Status                    ✅ Active      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Set Expiration Date                                      │   │
│  │ [Date Picker] → [Set Expiration Date Button]           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Deactivate License                                       │   │
│  │ ⚠️ WARNING: Will make software unusable                 │   │
│  │ [Deactivate Button]                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Reactivate License (if deactivated)                      │   │
│  │ [Secret Key Input] [Activate Button]                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                  [Admin Actions]
                            ↓
        ┌───────────────────┬────────────────┐
        ↓                   ↓                ↓
    Set Date          Deactivate       No Action
        ↓                   ↓                ↓
   DB Updated      Status = OFF      License Active
```

---

## User Flow - When License Expires

```
                    [User Opens App]
                           ↓
                  [Check License Status]
                           ↓
                ┌─────────────────────┐
                │  Is Date Passed?    │
                │  Is Deactivated?    │
                └─────────────────────┘
                    ↙           ↘
                  YES             NO
                   ↓              ↓
        [Show Blocked          [Show App]
         Screen]                ↓
                   ↓         [Normal Use]
        ┌────────────────────┐
        │ License Blocked    │
        │ Device ID: [xxx]   │
        │                    │
        │ [Check Status]     │
        │ [Reactivate Key] ──→ ┌──────────────┐
        └────────────────────┘ │ Input Dialog │
                               │              │
                    ┌──────────→ Key: _______ │
                    │          │              │
                    │          │ [Activate]   │
                    │          └──────────────┘
                    │                 ↓
            ┌───────┴─────┐     ┌─────────────┐
            │             │     │   Verify    │
            ↓             ↓     │  Key (SHA256│
          ✅ VALID      ❌ INVALID    │     │
            ↓             ↓     │ 3620192... │
     Reactivate      Show Error └─────────────┘
     For 10 Years         ↓
            ↓         [Retry]
     [Reload App]
            ↓
    [Back to Normal]
```

---

## Data Flow - Activation Process

```
USER INPUT
   │
   ↓ [user enters: 3620192373285]
   │
[CLIENT SIDE]
   ↓
POST /api/license/activate
   │
   ├─ secret_key: 3620192373285
   │
   ↓
[SERVER SIDE - VALIDATION]
   │
   ├─ Receive key from user
   ├─ Hash it: SHA256("3620192373285")
   │
   ├─ Get master key from env
   │   (MASTER_SECRET_KEY or default)
   ├─ Hash master: SHA256("3620192373285")
   │
   ├─ Compare hashes
   │   hash_user === hash_master?
   │
   ├─ If YES:
   │  └─ Set license_status = "active"
   │  └─ Set license_expiry = 10 years from now
   │  └─ Save to database
   │  └─ Return success
   │
   ├─ If NO:
   │  └─ Return error: "Invalid secret key"
   │
   ↓
[RESPONSE TO CLIENT]
   │
   ├─ Success: {"success": true, "message": "..."}
   │  ↓
   │  [Reload Application]
   │  [User can use app]
   │
   └─ Error: {"error": "Invalid secret key"}
      ↓
      [Show error message]
      [User can try again]
```

---

## Database Schema

```
SETTINGS TABLE
┌────────────────────────────────────┐
│ id (PRIMARY KEY)                   │
├────────────────────────────────────┤
│ ... other fields ...               │
├────────────────────────────────────┤
│ license_expiry_date                │ ← NEW (TEXT/NULL)
│ Format: YYYY-MM-DD                 │   Example: "2026-12-15"
├────────────────────────────────────┤
│ license_status                     │ ← NEW (TEXT)
│ Values: "active" | "deactivated"   │   Default: "active"
├────────────────────────────────────┤
│ updatedAt                          │
└────────────────────────────────────┘
```

---

## API Endpoints

```
1. GET /api/license/status
   └─→ Response:
       {
         "isActive": true,
         "expiryDate": "2026-12-15",
         "lastChecked": "2025-12-15T10:30:00Z"
       }

2. POST /api/license/set-expiry
   ├─ Request: {"expiryDate": "2026-12-15"}
   └─→ Response:
       {
         "success": true,
         "message": "License expiration date set...",
         "expiryDate": "2026-12-15"
       }

3. POST /api/license/deactivate
   ├─ No request body needed
   └─→ Response:
       {
         "success": true,
         "message": "License has been deactivated...",
         "expiryDate": "2025-12-15"
       }

4. POST /api/license/activate
   ├─ Request: {"secretKey": "3620192373285"}
   ├─→ If VALID:
   │    {
   │      "success": true,
   │      "message": "License successfully reactivated!",
   │      "expiryDate": "2035-12-15"
   │    }
   │
   └─→ If INVALID:
        {
          "error": "Invalid secret key"
        }
```

---

## Component Structure

```
FRONTEND
├── Settings Page (settings.tsx)
│   ├── License Tab
│   │   ├── Status Display
│   │   ├── Set Expiry Form
│   │   ├── Deactivate Section
│   │   └── Reactivate Section (conditional)
│   │
│   └── License Handlers
│       ├── handleSetLicenseExpiry()
│       ├── handleDeactivateLicense()
│       └── handleActivateLicense()
│
└── License Blocked Screen (license-blocked-screen.tsx)
    ├── Status Message
    ├── Device ID Display
    ├── Retry Button
    ├── Reactivate Button
    └── Reactivation Dialog
        ├── Secret Key Input
        ├── Show/Hide Toggle
        └── Activate Button

BACKEND
├── Routes (server/routes.ts)
│   ├── GET /api/license/status
│   ├── POST /api/license/set-expiry
│   ├── POST /api/license/deactivate
│   └── POST /api/license/activate
│
├── Utilities
│   └── hashSecretKey() - SHA-256 hashing
│
└── Storage Layer
    └── Updated Settings management
```

---

## Security Flow

```
SECRET KEY VERIFICATION PROCESS

Input: "3620192373285" (from user)
   ↓
[Client]
   ├─ Mask input (show as •••••••••••)
   ├─ Send to server (HTTPS only)
   ↓
[Server - Validation]
   ├─ Never expose key
   ├─ Hash immediately
   │  hash_input = SHA256("3620192373285")
   │
   ├─ Get master key
   │  master_key = process.env.MASTER_SECRET_KEY
   │
   ├─ Hash master key
   │  hash_master = SHA256(master_key)
   │
   ├─ Cryptographic comparison
   │  if (hash_input === hash_master)
   │
   ├─ If match:
   │  ├─ Update database
   │  ├─ Set license active
   │  ├─ Log action
   │  └─ Return success
   │
   └─ If no match:
      ├─ Don't reveal why it failed
      ├─ Return generic error
      └─ Log attempt
   ↓
[Client]
   └─ Show result to user
```

---

## Timeline - License Expiration

```
TODAY                                  EXPIRATION DATE
  ↓                                           ↓
  [License is Active]                        
    ↓                                         ↓
    ↓                                    Software Expires
    ↓                                         ↓
    ↓                                    User sees Blocked
    ↓                                    Screen on next load
    ↓                                         ↓
    ↓                                    User enters key
    ↓                                         ↓
    ↓                                    Key is validated
    ↓                                         ↓
    ↓                                    License Reactivated
    ↓                                    for 10 more years
    ↓                                         ↓
    └──────────────────────────────────────────→
            User continues using app
```

---

## Feature Comparison

```
┌─────────────────────────┬────────────┬──────────┬──────────┐
│ Feature                 │ Admin      │ User     │ Support  │
├─────────────────────────┼────────────┼──────────┼──────────┤
│ Set Expiry Date         │ ✅ YES     │ ❌ NO    │ ⚠️ LOGS  │
│ Deactivate License      │ ✅ YES     │ ❌ NO    │ ⚠️ LOGS  │
│ View Status             │ ✅ YES     │ ❌ NO    │ ✅ LOGS  │
│ Reactivate              │ ❌ NO      │ ✅ YES   │ ⚠️ LOGS  │
│ Enter Secret Key        │ ❌ NO      │ ✅ YES   │ ❌ NO    │
│ View Logs               │ ✅ YES     │ ❌ NO    │ ✅ YES   │
└─────────────────────────┴────────────┴──────────┴──────────┘
```

---

## File Structure

```
ampaints-desktop/
│
├── client/src/
│   ├── pages/
│   │   └── settings.tsx              ← MODIFIED (License Tab)
│   │
│   └── components/
│       └── license-blocked-screen.tsx ← MODIFIED (Reactivation)
│
├── server/
│   └── routes.ts                     ← MODIFIED (API Endpoints)
│
├── shared/
│   └── schema.ts                     ← MODIFIED (DB Schema)
│
├── migrations/
│   └── 0001_add_license_fields.sql   ← NEW (Database)
│
└── Documentation/
    ├── LICENSE-SYSTEM-GUIDE.md       ← NEW (Admin Guide)
    ├── LICENSE-QUICK-START.md        ← NEW (Quick Ref)
    ├── SECRET-KEY-CONFIGURATION.md   ← NEW (Key Config)
    ├── IMPLEMENTATION-CHECKLIST.md   ← NEW (Checklist)
    ├── LICENSE-SYSTEM-SUMMARY.md     ← NEW (Summary)
    └── IMPLEMENTATION-COMPLETE.md    ← NEW (Final Summary)
```

---

## Decision Tree - Is License Valid?

```
                    [Check License]
                           ↓
                   ┌───────────────┐
                   │ Read Database │
                   └───────────────┘
                           ↓
         ┌─────────────────┴──────────────────┐
         ↓                                    ↓
    license_expiry_date            license_status
         ↓                                    ↓
    Is it set?                         Is it "active"?
    ├─ YES ─→ Date > Today?            ├─ YES ─→ ✅ VALID
    │            ├─ YES ─→ ✅ VALID     │
    │            └─ NO ──→ ❌ EXPIRED   └─ NO ──→ ❌ BLOCKED
    │
    └─ NO ──→ ✅ VALID (No expiry set)
```

---

This visual architecture shows how all components of the license system work together to create a secure, user-friendly licensing mechanism.
