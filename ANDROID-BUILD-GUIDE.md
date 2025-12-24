# PaintPulse Android APK Build Guide

This guide explains how to build the PaintPulse Android APK using GitHub Actions or locally.

## Automatic Build (GitHub Actions)

### Triggering a Build

1. **On Push**: The workflow automatically runs when you push to `main` or `master` branches
2. **Manual Trigger**: Go to Actions → "Build Android APK" → "Run workflow"
   - Select build type: `debug` or `release`

### Downloading the APK

1. Go to the Actions tab in GitHub
2. Click on the latest "Build Android APK" workflow run
3. Scroll down to "Artifacts"
4. Download "PaintPulse-Android-APK"

## Local Build

### Prerequisites

1. **Node.js 20+**
   ```bash
   node --version  # Should be 20.x or higher
   ```

2. **Java JDK 17**
   ```bash
   java --version  # Should be 17.x
   ```

3. **Android Studio** with:
   - Android SDK 33
   - Build Tools 33.0.2
   - NDK 25.x (optional)

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
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npm install @capacitor/splash-screen @capacitor/status-bar @capacitor/app
   ```

4. **Add Android platform** (first time only)
   ```bash
   npx cap add android
   ```

5. **Sync web assets to Android**
   ```bash
   npx cap sync android
   ```

6. **Build Debug APK**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

7. **Build Release APK** (requires signing)
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

### Output Location

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`

## Release Signing

For production releases, you need to sign the APK:

### Generate Keystore

```bash
keytool -genkey -v -keystore paintpulse-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias paintpulse
```

### Configure Signing in `android/app/build.gradle`

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file('paintpulse-release-key.jks')
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias 'paintpulse'
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### GitHub Secrets for Signed Release

Add these secrets to your GitHub repository:
- `KEYSTORE_BASE64`: Base64-encoded keystore file
- `KEYSTORE_PASSWORD`: Keystore password
- `KEY_PASSWORD`: Key password

## Android App Configuration

### App Details

| Property | Value |
|----------|-------|
| App ID | `com.ampaints.paintpulse` |
| App Name | PaintPulse |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 33 (Android 13) |

### Permissions Required

The app requires these permissions (defined in `AndroidManifest.xml`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

## Troubleshooting

### Build Fails with "SDK location not found"

Create `android/local.properties`:
```properties
sdk.dir=/path/to/Android/Sdk
```

### Gradle Build Fails

1. Clean the build:
   ```bash
   cd android
   ./gradlew clean
   ```

2. Invalidate caches:
   ```bash
   rm -rf android/.gradle
   rm -rf android/app/build
   ```

### APK Not Installing on Device

1. Enable "Install from unknown sources" in Android settings
2. For debug builds, enable USB debugging
3. Check device architecture compatibility (arm64-v8a, armeabi-v7a, x86_64)

### App Crashes on Start

1. Check Logcat for errors:
   ```bash
   adb logcat | grep -i paintpulse
   ```

2. Ensure web assets are synced:
   ```bash
   npx cap sync android
   ```

## App Icons

Place app icons in these directories:

```
android/app/src/main/res/
├── mipmap-hdpi/ic_launcher.png      (72x72)
├── mipmap-mdpi/ic_launcher.png      (48x48)
├── mipmap-xhdpi/ic_launcher.png     (96x96)
├── mipmap-xxhdpi/ic_launcher.png    (144x144)
├── mipmap-xxxhdpi/ic_launcher.png   (192x192)
```

## Splash Screen

Configure in `capacitor.config.json`:

```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "backgroundColor": "#3B82F6",
      "showSpinner": true
    }
  }
}
```

## Testing

### On Physical Device

1. Enable USB debugging on device
2. Connect via USB
3. Install:
   ```bash
   adb install app-debug.apk
   ```

### On Emulator

1. Start Android Emulator from Android Studio
2. Install:
   ```bash
   adb install app-debug.apk
   ```

## Version Management

The app version is automatically pulled from `package.json`:
- `version`: User-visible version string (e.g., "5.1.7")
- `versionCode`: Integer version code derived from version

---

## Quick Start Commands

```bash
# Full build from scratch
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug

# Incremental rebuild
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Support

For issues with Android builds:
1. Check the GitHub Actions logs
2. Review the troubleshooting section above
3. Open an issue with build logs attached
