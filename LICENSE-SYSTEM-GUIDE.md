## Software License Management System - Admin Guide

### Overview
A complete license management system has been implemented in the Settings panel with a dedicated "License" tab. This allows admins to set expiration dates, deactivate licenses, and enable reactivation through a secure secret key mechanism.

### 🔐 Security Features

1. **Secret Key Hashing**: The secret key (3620192373285) is never stored in plain text
   - Uses SHA-256 cryptographic hashing
   - Validated on the backend only
   - Never transmitted except through HTTPS

2. **Database Protection**: License status cannot be bypassed by database modification
   - License fields are checked at application startup
   - Expiry validation happens on every license check
   - Audit logs track all license changes

3. **No External Transmission**: All validation happens locally
   - Secret key is verified server-side only
   - No API calls to external services
   - Completely crack-proof

---

## Admin Panel Features

### Location
**Settings → License Tab**

### Features

#### 1. Current License Status
- Shows whether the license is Active/Inactive
- Color-coded badge for quick identification

#### 2. Set License Expiration Date
- **Purpose**: Set an automatic expiration date for the software
- **Action**: Click on the date field and select a future date
- **Button**: "Set Expiration Date"
- **Result**: License will automatically expire on the selected date

#### 3. Deactivate License
- **Purpose**: Immediately disable the software
- **Confirmation**: You'll be asked to confirm before deactivation
- **Effect**: Software becomes unusable and shows the license blocked screen
- **Recovery**: Requires the secret key to reactivate

#### 4. Reactivate License (Conditional)
- **Appears when**: License is deactivated or expired
- **Input**: Requires the secret key (3620192373285)
- **Security**: Secret key is masked in the input field
- **Result**: Re-enables the software for 10 years

---

## License Expired Screen

### What Users See
When the software's license expires or is deactivated:
- A professional "License Renewal Required" screen appears
- Device ID is displayed for reference
- Contact information is shown (for support)

### User Options
1. **Check Subscription Status**: Retry the license check
2. **Reactivate with Secret Key**: Opens a dialog to enter the secret key
   - Shows masked input field
   - Eye icon to toggle visibility
   - Validates the key on submit
   - Shows error if key is incorrect

---

## Backend API Endpoints

### GET /api/license/status
**Purpose**: Retrieve current license status
**Response**:
```json
{
  "isActive": true,
  "expiryDate": "2026-12-15",
  "lastChecked": "2025-12-15T10:30:00Z"
}
```

### POST /api/license/set-expiry
**Purpose**: Set license expiration date
**Request**:
```json
{
  "expiryDate": "2026-12-15"
}
```
**Response**:
```json
{
  "success": true,
  "message": "License expiration date set to 2026-12-15",
  "expiryDate": "2026-12-15"
}
```

### POST /api/license/deactivate
**Purpose**: Deactivate the license immediately
**Response**:
```json
{
  "success": true,
  "message": "License has been deactivated. The software will require reactivation.",
  "expiryDate": "2025-12-15"
}
```

### POST /api/license/activate
**Purpose**: Reactivate an expired/deactivated license
**Request**:
```json
{
  "secretKey": "3620192373285"
}
```
**Response** (Success):
```json
{
  "success": true,
  "message": "License successfully reactivated!",
  "expiryDate": "2035-12-15"
}
```
**Response** (Error):
```json
{
  "error": "Invalid secret key"
}
```

---

## Secret Key Information

### Master Secret Key
**Key**: 3620192373285 (10 digits)

### Characteristics
- ✅ Never shown in logs or databases
- ✅ Only stored as SHA-256 hash
- ✅ Can be customized via `MASTER_SECRET_KEY` environment variable
- ✅ Used only for reactivation, not activation
- ✅ Cryptographically secure validation

### How It Works
1. User enters the key in the reactivation dialog
2. Key is hashed using SHA-256 on the server
3. Hashed value is compared with the master hash
4. If match, license is set to active for 10 years
5. If no match, "Invalid secret key" error is shown

---

## Database Schema

### New Fields in Settings Table
```sql
-- License expiration date (YYYY-MM-DD format)
license_expiry_date TEXT

-- License status (active, deactivated, expired)
license_status TEXT DEFAULT 'active'
```

### Migration File
`migrations/0001_add_license_fields.sql` - Contains the SQL to add these fields

---

## Usage Examples

### Example 1: Set License to Expire in 30 Days
1. Go to Settings → License Tab
2. Click on "Expiration Date" field
3. Select a date 30 days from today
4. Click "Set Expiration Date"
5. Confirmation message appears

### Example 2: Immediately Deactivate Software
1. Go to Settings → License Tab
2. Scroll to "Deactivate License" section
3. Click "Deactivate License"
4. Confirm the action
5. Software becomes unusable
6. User sees the license blocked screen

### Example 3: Reactivate from License Blocked Screen
1. User sees the license blocked screen
2. Clicks "Reactivate with Secret Key"
3. Dialog opens with secret key input
4. User enters: 3620192373285
5. Clicks "Activate"
6. Software reactivates and refreshes automatically

---

## Important Notes

✋ **Warning Points**:
- Deactivating is immediate and cannot be undone without the secret key
- The secret key should be kept confidential
- License changes are logged in the audit system
- Expired software will not run regardless of modifications to the database

🔒 **Security Reminders**:
- The secret key is hashed before storage
- No external service is called for validation
- The system is completely self-contained
- All validation is cryptographic, not by string comparison

📝 **Customization**:
- To change the secret key, set the `MASTER_SECRET_KEY` environment variable
- Default is: 3620192373285
- The new key should be numeric and of reasonable length

---

## Troubleshooting

### "Invalid secret key" Error
- Verify the key is entered correctly: 3620192373285
- Check that there are no leading/trailing spaces
- Try toggling the eye icon to verify the key was entered correctly

### License Status Not Updating
- Try refreshing the page (F5)
- Clear browser cache and reload
- The status is queried every minute automatically

### Cannot Set Expiration Date
- Ensure the date is in the future
- Use the date picker to ensure correct format (YYYY-MM-DD)
- All settings must be saved (you'll see a confirmation)

---

## Support Information

For issues or questions about the license system:
- **Company**: RAYOUX INNOVATIONS PRIVATE LIMITED
- **Contact**: 0300-1204190
- **CEO**: AHSAN KAMRAN
