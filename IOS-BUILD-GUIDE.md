# PaintPulse iOS IPA Build Guide

This guide explains how to build the PaintPulse iOS app using GitHub Actions or locally on macOS.

## Automatic Build (GitHub Actions)

### Triggering a Build

1. **On Push**: The workflow automatically runs when you push to `main` or `master` branches
2. **Manual Trigger**: Go to Actions → "Build iOS IPA" → "Run workflow"
   - Select build type: `development` (simulator) or `distribution` (App Store)

### Downloading the Build

1. Go to the Actions tab in GitHub
2. Click on the latest "Build iOS IPA" workflow run
3. Scroll down to "Artifacts"
4. Download "PaintPulse-iOS-Build"

## Local Build (macOS Required)

### Prerequisites

1. **macOS Monterey or later**

2. **Xcode 15.2+**
   ```bash
   xcode-select --install
   ```

3. **Node.js 20+**
   ```bash
   node --version  # Should be 20.x or higher
   ```

4. **CocoaPods**
   ```bash
   sudo gem install cocoapods
   ```

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build web assets**
   ```bash
   npm run build
   ```

3. **Install Capacitor packages**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios
   npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/app
   ```

4. **Add iOS platform** (first time only)
   ```bash
   npx cap add ios
   ```

5. **Sync web assets to iOS**
   ```bash
   npx cap sync ios
   ```

6. **Install CocoaPods dependencies**
   ```bash
   cd ios/App
   pod install
   ```

7. **Open in Xcode**
   ```bash
   npx cap open ios
   ```

8. **Build in Xcode**
   - Select your target device/simulator
   - Press Cmd+B to build
   - Press Cmd+R to run

### Using NPM Scripts

```bash
npm run ios:init          # Add iOS platform
npm run ios:sync          # Sync web assets
npm run ios:open          # Open in Xcode
npm run ios:build         # Build for simulator
npm run ios:build:release # Build release archive
npm run ios:run           # Run on device/simulator
```

## App Store Distribution

### Requirements

1. **Apple Developer Account** ($99/year)
   - https://developer.apple.com/programs/

2. **Distribution Certificate**
   - Go to Certificates, Identifiers & Profiles
   - Create a Distribution certificate

3. **Provisioning Profile**
   - Create an App ID for `com.ampaints.paintpulse`
   - Create an App Store distribution profile

### Setting Up GitHub Secrets

For automated distribution builds, add these secrets to your repository:

| Secret Name | Description |
|-------------|-------------|
| `IOS_CERTIFICATE_BASE64` | Base64-encoded .p12 certificate |
| `IOS_CERTIFICATE_PASSWORD` | Password for the certificate |
| `IOS_PROVISION_PROFILE_BASE64` | Base64-encoded .mobileprovision file |
| `KEYCHAIN_PASSWORD` | Password for build keychain (any secure string) |

### Export Certificate to Base64

```bash
# Export certificate from Keychain as .p12
# Then convert to base64:
base64 -i certificate.p12 | tr -d '\n' > certificate_base64.txt
```

### Export Provisioning Profile to Base64

```bash
base64 -i profile.mobileprovision | tr -d '\n' > profile_base64.txt
```

## iOS App Configuration

### App Details

| Property | Value |
|----------|-------|
| App ID | `com.ampaints.paintpulse` |
| App Name | PaintPulse |
| Min iOS | 14.0 |
| Target iOS | 17.0 |

### Capabilities

The app uses these iOS capabilities:
- Internet access
- Background fetch (optional)
- Push notifications (optional)

## Creating Export Options Plist

For distribution builds, create `ios-export-options.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
</dict>
</plist>
```

## Troubleshooting

### "No signing certificate" Error

1. Open Xcode
2. Go to Signing & Capabilities
3. Select your team or enable "Automatically manage signing"

### CocoaPods Installation Fails

```bash
# Update CocoaPods
sudo gem install cocoapods

# Clear cache
pod cache clean --all

# Reinstall pods
cd ios/App
rm -rf Pods Podfile.lock
pod install --repo-update
```

### Build Fails with Module Errors

```bash
# Clean and rebuild
cd ios/App
xcodebuild clean
cd ../..
npx cap sync ios
```

### App Crashes on Launch

1. Check Xcode console for error logs
2. Ensure web assets are synced:
   ```bash
   npx cap sync ios
   ```

## App Icons

Place app icons in these locations:

```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
├── icon-20.png         (20x20)
├── icon-20@2x.png      (40x40)
├── icon-20@3x.png      (60x60)
├── icon-29.png         (29x29)
├── icon-29@2x.png      (58x58)
├── icon-29@3x.png      (87x87)
├── icon-40.png         (40x40)
├── icon-40@2x.png      (80x80)
├── icon-40@3x.png      (120x120)
├── icon-60@2x.png      (120x120)
├── icon-60@3x.png      (180x180)
├── icon-76.png         (76x76)
├── icon-76@2x.png      (152x152)
├── icon-83.5@2x.png    (167x167)
├── icon-1024.png       (1024x1024)
└── Contents.json
```

## Splash Screen

Configure in `capacitor.config.json`:

```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#3B82F6",
      "showSpinner": true,
      "spinnerColor": "#FFFFFF"
    }
  }
}
```

## TestFlight Submission

1. Build archive in Xcode (Product → Archive)
2. Click "Distribute App"
3. Select "App Store Connect"
4. Upload to TestFlight
5. Add test groups in App Store Connect

## App Store Submission

1. Complete app information in App Store Connect
2. Add screenshots for all required device sizes
3. Submit for review

---

## Quick Start Commands

```bash
# Full build from scratch (macOS)
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap add ios
npx cap sync ios
cd ios/App && pod install && cd ../..
npx cap open ios

# Incremental rebuild
npm run build
npx cap sync ios
```

## Support

For issues with iOS builds:
1. Check the GitHub Actions logs
2. Review the troubleshooting section above
3. Open an issue with build logs attached
