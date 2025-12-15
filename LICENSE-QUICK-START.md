# License System - Quick Start Guide

## 🎯 For Admins

### Step 1: Set License Expiration Date

**Path**: Settings → License Tab

**Steps**:
1. Click on the date input field under "Set License Expiration Date"
2. Select a date from the calendar (any future date)
3. Click "Set Expiration Date" button
4. You'll see a success message: "License expiry date set to [date]"

**Example**: 
- Today: December 15, 2025
- Set Expiration: March 15, 2026
- Result: Software will expire in 3 months

### Step 2: Deactivate License (Optional)

**Path**: Settings → License Tab

**Steps**:
1. Scroll down to "Deactivate License" section
2. Click the red "Deactivate License" button
3. A confirmation dialog appears asking if you're sure
4. Click "Yes" to confirm
5. License is immediately deactivated
6. User sees the license blocked screen on next load

**Warning**: This is immediate and irreversible without the secret key!

### Step 3: Monitor License Status

**Path**: Settings → License Tab

**What You See**:
- Status badge showing "Active" or "Inactive"
- Current expiration date (if set)
- All available actions

---

## 👥 For Users (When License Expires)

### What Users See
1. **License Blocked Screen** appears instead of the normal app
2. Shows: "License Renewal Required"
3. Shows: Device ID
4. Two buttons available:
   - "Check Subscription Status"
   - "Reactivate with Secret Key"

### How Users Reactivate

**Steps**:
1. Click "Reactivate with Secret Key" button
2. A dialog opens with a secret key input field
3. Enter the secret key: **3620192373285**
   - ✅ Can use show/hide toggle to verify
   - ✅ The field is masked for security
4. Click "Activate" button
5. Wait for success message
6. App automatically reloads and continues normally

**If Wrong Key Is Entered**:
- Error message: "Invalid secret key"
- Try again with the correct key
- Contact support if key is forgotten

---

## 🔑 Secret Key

### The Master Secret Key
```
3620192373285
```

### Important Facts
- ✅ This is the ONLY key needed for reactivation
- ✅ It's 10 digits long (numeric only)
- ✅ Never changes (unless admin customizes it)
- ✅ Must be entered exactly as shown
- ✅ No spaces or special characters

### How to Share with Users
When you set an expiration date or deactivate, inform users:

> "If your license expires, you can reactivate it anytime by entering the secret key: **3620192373285**"

---

## 📅 Common Scenarios

### Scenario 1: Trial Period (30 Days)

**Admin Actions**:
```
1. Go to Settings → License
2. Click date input
3. Select date 30 days from today
4. Click "Set Expiration Date"
5. Tell users: "You have 30 days to evaluate"
```

**After 30 Days**:
```
User sees: "License Renewal Required" screen
User clicks: "Reactivate with Secret Key"
User enters: 3620192373285
Result: Software continues working
```

### Scenario 2: Immediate Deactivation

**Admin Actions**:
```
1. Go to Settings → License
2. Scroll to "Deactivate License"
3. Click "Deactivate License"
4. Confirm when asked
5. License is immediately disabled
```

**User Sees**:
```
- If already using the app: Screen goes to blocked state
- If opening the app: Blocked screen appears immediately
- Cannot use any features until reactivated
```

### Scenario 3: Reactivation Attempt

**User Actions**:
```
1. Sees license blocked screen
2. Clicks "Reactivate with Secret Key"
3. Dialog appears with input field
4. Enters: 3620192373285
5. Clicks "Activate"
```

**Outcomes**:
- ✅ Correct key: "License successfully reactivated!" → App refreshes
- ❌ Wrong key: "Invalid secret key" → User can try again

---

## ⚙️ Technical Details

### How It Works Behind the Scenes

**1. License Expiration Check**
```
When user opens the app:
- Server checks if license_expiry_date is set
- If date is today or in the past → blocked
- Otherwise → allow normal operation
```

**2. Deactivation Check**
```
When user opens the app:
- Server checks if license_status is "deactivated"
- If yes → show blocked screen
- If no → show app normally
```

**3. Reactivation with Key**
```
When user submits secret key:
- Server receives the key
- Hashes the key using SHA-256
- Compares with stored hash
- If match → license is reactivated
- If no match → show error
```

### Security
- ✅ Key is never stored in plain text
- ✅ Uses cryptographic hashing (SHA-256)
- ✅ Cannot crack by guessing
- ✅ Cannot bypass by editing database
- ✅ Works completely offline

---

## 📋 Checklist for Admins

### Initial Setup
- [ ] Settings tab includes License option
- [ ] Can view current license status
- [ ] Can set an expiration date
- [ ] Can deactivate license

### Testing
- [ ] Set a test expiration date
- [ ] Verify it saves correctly
- [ ] Deactivate the license
- [ ] See blocked screen appear
- [ ] Reactivate with secret key: 3620192373285
- [ ] Verify software works again

### For Users
- [ ] Users are aware of the license system
- [ ] Users know the secret key: 3620192373285
- [ ] Users understand what happens when expired
- [ ] Users know how to reactivate

---

## 🆘 Troubleshooting

### "I forgot the secret key"
**Solution**: The key is: **3620192373285**
- It's always the same unless admin changed it
- Check with your administrator

### "Invalid secret key error"
**Solution**: 
- Make sure you're entering: 3620192373285
- Check for extra spaces at beginning/end
- Try toggling the show/hide eye icon to verify
- Contact administrator if still not working

### "License status not updating"
**Solution**:
- Refresh the page (F5)
- Clear browser cache
- Try in an incognito/private window
- Status is checked automatically every minute

### "Deactivation happened but app still works"
**Solution**:
- The change takes effect on next app load
- Refresh the page or restart the browser
- Blocked screen should appear

### "Can't set expiration date"
**Solution**:
- Use the date picker (don't type manually)
- Select a date in the future
- Click "Set Expiration Date" button
- Wait for success message
- Check that the date was saved

---

## 📞 Support

If you encounter any issues:

**Company**: RAYOUX INNOVATIONS PRIVATE LIMITED
**Contact**: 0300-1204190
**CEO**: AHSAN KAMRAN

Include the following information:
- What were you trying to do?
- What error did you see?
- What is your Device ID? (shown on blocked screen)
- Have you tried [troubleshooting steps]?

---

## 🎓 Training Summary

### For Admins
- Setting expiration dates
- Deactivating licenses
- Understanding security features
- Monitoring license status

### For End Users
- What to do when license expires
- How to reactivate with secret key
- Understanding security
- When to contact support

### For Support Team
- License status is in Settings → License
- Blocked screen shows Device ID
- Secret key to reactivate: 3620192373285
- Check logs for license change history

---

## ✅ You're All Set!

The license system is ready to use. Start by:

1. Going to Settings → License
2. Setting an expiration date (optional)
3. Testing the reactivation flow
4. Informing users about the system

**Questions?** Refer to LICENSE-SYSTEM-GUIDE.md for detailed documentation.

---

**Last Updated**: December 15, 2025
**Status**: Ready for Production Use ✅
