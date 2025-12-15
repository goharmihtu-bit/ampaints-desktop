# Secret Key Configuration Guide

## Master Secret Key

### Default Key
```
3620192373285
```

### What It Does
- Used to reactivate an expired or deactivated license
- Entered by users on the license blocked screen
- Never transmitted externally
- Stored as SHA-256 hash only

---

## How to Customize the Secret Key

### Option 1: Environment Variable (Recommended)

#### On Development Machine
1. Create/edit `.env` file in project root
2. Add the following line:
   ```
   MASTER_SECRET_KEY=your_new_key_here
   ```
3. Restart the server
4. The new key will be used for all license validations

#### On Production Server
1. Set environment variable through your hosting platform:
   - Heroku: `heroku config:set MASTER_SECRET_KEY=your_new_key_here`
   - Docker: Add to docker-compose.yml or docker env file
   - AWS/Azure: Set in environment variables section

2. Restart the application

#### Example `.env` file
```env
# License Configuration
MASTER_SECRET_KEY=9876543210

# Other settings...
DATABASE_URL=...
NODE_ENV=production
```

### Option 2: Direct Code Change (Not Recommended)

If you must hardcode the key:

1. Open `server/routes.ts`
2. Find this line (~line 1809):
   ```typescript
   const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || "3620192373285"
   ```
3. Change the fallback value:
   ```typescript
   const MASTER_SECRET_KEY = process.env.MASTER_SECRET_KEY || "your_new_key_here"
   ```
4. Rebuild and deploy

---

## Key Recommendations

### Best Practices
✅ **Do:**
- Use numeric keys (easier for users to remember)
- Keep it at least 10 digits long
- Store the key in environment variables
- Rotate keys periodically
- Document the key in a secure location
- Use different keys for different instances

❌ **Don't:**
- Hardcode the key in version control
- Share the key publicly
- Use weak keys (too short)
- Change the key frequently without notice
- Store in plain text files

### Key Format
- **Recommended**: 10-13 digit numeric string
- **Example**: 3620192373285, 1234567890, 9876543210
- **Must be**: A string of digits (or could be alphanumeric)

---

## Testing Your Custom Key

### Step 1: Set Environment Variable
```bash
export MASTER_SECRET_KEY=1234567890
```

### Step 2: Start the Server
```bash
npm run dev
```

### Step 3: Test in Admin Panel
1. Go to Settings → License
2. Click "Deactivate License"
3. Confirm deactivation
4. Navigate to any page (license will be checked)
5. You should see the license blocked screen

### Step 4: Test Reactivation
1. Click "Reactivate with Secret Key"
2. Enter your custom key: 1234567890
3. Should show "License successfully reactivated!"
4. App reloads and continues normally

### Step 5: Verify Invalid Key Fails
1. Deactivate license again
2. On blocked screen, enter wrong key: 0000000000
3. Should show "Invalid secret key" error

---

## Multi-Environment Setup

### Development
```env
# .env.development
MASTER_SECRET_KEY=1111111111
NODE_ENV=development
```

### Staging
```env
# .env.staging
MASTER_SECRET_KEY=2222222222
NODE_ENV=production
```

### Production
```env
# .env.production
MASTER_SECRET_KEY=3333333333
NODE_ENV=production
```

### Usage
```bash
# Development
npm run dev

# Staging (with staging .env)
NODE_ENV=staging npm run build && npm start

# Production (with production .env)
NODE_ENV=production npm run build && npm start
```

---

## Docker Configuration

### Docker Compose Example
```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - MASTER_SECRET_KEY=your_docker_key_here
      - NODE_ENV=production
      - DATABASE_URL=postgresql://...
    ports:
      - "3000:3000"
    restart: always
```

### Dockerfile Example
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY . .

RUN npm install
RUN npm run build

ENV MASTER_SECRET_KEY=your_docker_key_here
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

---

## Hashing Details

### How the Key is Verified

The secret key verification uses SHA-256 hashing:

```typescript
function hashSecretKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// Example
const userInput = "3620192373285"
const masterKey = process.env.MASTER_SECRET_KEY || "3620192373285"

const hashedInput = hashSecretKey(userInput)
const hashedMaster = hashSecretKey(masterKey)

if (hashedInput === hashedMaster) {
  // License is activated
}
```

### SHA-256 Hashes
- Input: `3620192373285` → Hash: `a1b2c3d4e5f6...` (never changes for same input)
- This makes brute force attacks extremely difficult
- Users can't reverse-engineer the actual key from the hash

---

## Security Warnings

⚠️ **Important Security Notes:**

1. **Never** commit the real secret key to version control
2. **Always** use environment variables in production
3. **Don't** share the key through unencrypted channels
4. **Rotate** keys periodically for security
5. **Document** key changes for audit purposes
6. **Test** key changes before deploying to production

---

## Troubleshooting

### Key Not Working
**Problem**: User enters the key but it says "Invalid"

**Solution**:
1. Verify the environment variable is set: `echo $MASTER_SECRET_KEY`
2. Check for typos (leading/trailing spaces)
3. Verify server was restarted after changing the key
4. Check server logs for the actual key value being used

### Key Verification Fails on Production
**Problem**: Works in development but not in production

**Solution**:
1. Verify environment variable is set on production server
2. Check if old key is still cached somewhere
3. Restart the production server
4. Clear browser cache
5. Check if different servers have different keys

### Lost the Custom Key
**Problem**: Can't remember the custom key set

**Solution**:
1. Reset to default key in environment variable
2. Remove the `MASTER_SECRET_KEY` from `.env`
3. Server will use default: `3620192373285`
4. Restart the server
5. Now you can reactivate with the default key

---

## Monitoring & Auditing

### Log Activation Attempts
Every activation attempt is logged:
```
License reactivated with valid secret key
License deactivated by admin
License expiry date set to 2026-12-15
```

### View Logs
```bash
# On the server, check logs
tail -f /path/to/app/logs.txt | grep -i license
```

---

## Support

If you need to change or reset the secret key:
1. Document the old key in a secure location
2. Generate a new key (10-13 random digits)
3. Update the environment variable
4. Test the new key in a safe environment first
5. Deploy to production
6. Notify users if the key has changed

**Company Contact**:
- RAYOUX INNOVATIONS PRIVATE LIMITED
- 0300-1204190
- CEO: AHSAN KAMRAN
