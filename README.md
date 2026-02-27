GreenPoint TreeD is a cross-platform mobile application for foresters and environmental professionals to collect, manage, and analyze tree inventory data in the field. The app is fully offline-capable, supports advanced map features, and provides a robust data management workflow.

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54.0.31-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)

---

## Important: Expo Go Will NOT Work

This app uses native modules (SQLite, Location, FileSystem, Network, custom WebView bridge) that **require a development build**. **Expo Go is not supported.**  
You must run the app as a development build on an emulator/simulator or a physical device.

---

## Features

- **Interactive Map** — OpenStreetMap tiles rendered via Leaflet.js inside a WebView, with offline tile caching and seamless fallback to network when needed.
- **Offline Map Caching** — Download and manage map regions for offline use (Navigation: zoom 10–13, Field Work: zoom 14–18).
- **Tree Data Collection** — Add trees with species, height, DBH, crown, tags, and precise GPS coordinates.
- **Digital Tree Height Measurement** — Built-in clinometer using device sensors for accurate height via angle + distance.
- **Digital Trunk Measurement (DBH)** — Photo-based measurement using a credit card as reference.
- **Tree Details & Editing** — View and update all tree data.
- **CSV Import/Export** — Import and export tree data in CSV format, with validation and error handling.
- **Local SQLite Storage** — All data is stored on-device, fully offline.
- **Context-Aware GPS** — Uses fused location when online, GPS-only when offline, with accuracy badge.
- **Modern UI** — Clean, intuitive interface with custom navigation.
- **CI/CD Pipeline** — Jenkins multibranch pipeline with Docker for automated tests.
- **Cross-Platform** — Works on Android and iOS, tested on Windows, macOS, and Fedora Linux.

---

## Tech Stack

| Area         | Library / Tooling                              |
|--------------|------------------------------------------------|
| Framework    | React Native 0.81.5 with Expo 54.0.31          |
| Navigation   | React Navigation 7 (Stack Navigator)           |
| Maps         | Leaflet.js 1.9.4 (WebView, OSM tiles)          |
| Storage      | Expo SQLite 16.0.10                            |
| Location     | Expo Location 19.0.8                           |
| Networking   | Expo Network 8.0.8                             |
| File System  | Expo File System 19.0.21                       |
| UI           | React Native Dropdown Picker, @react-native-community/slider |
| Sensors      | Expo Sensors                                   |
| CI/CD        | Jenkins + Docker                               |

---

## Prerequisites

- **Node.js v20+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)
- **Expo CLI** — `npm install -g expo-cli` (optional, `npx expo` works too)
- **Java JDK 17+** (for Android builds)
- **Python 3** (for some build tools)
- **CocoaPods** (macOS/iOS only: `sudo gem install cocoapods`)
- **Android Studio** (for Android emulator/device)
- **Xcode** (macOS only, for iOS simulator/device)

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/S3eedkabak/GreenPoint-TreeD.git
cd GreenPoint-TreeD
```

### 2. Install dependencies

```bash
npm install
```

---

## Running the App

> **Emulators/simulators are strongly recommended for development and testing.**  
> Physical device setup is possible but requires extra steps (see below).

### Quick Start Matrix

| Platform         | Emulator/Simulator | Physical Device | Notes                                      |
|------------------|-------------------|-----------------|---------------------------------------------|
| Android (Win/Mac/Linux/Fedora) |  Recommended     |  Supported     | Emulator is fastest for dev                |
| iOS (macOS only) |  Recommended     |  Supported     | Simulator is easiest, device needs Apple ID |

---

### A. iOS (macOS only)

#### Requirements

- macOS with **Xcode** (install from Mac App Store)
- Xcode Command Line Tools: Xcode → Settings → Locations → set Command Line Tools
- **CocoaPods**: `sudo gem install cocoapods`

#### Steps

```bash
# 1. Install dependencies
npm install

# 2. Generate native iOS/Android folders
npx expo prebuild --clean

# 3. Install iOS pods
cd ios && pod install && cd ..

# 4. Run on iOS Simulator (auto-launches Simulator)
npx expo run:ios
```

- The app will build and open in the Simulator.
- For subsequent runs, you can use `npx expo start --dev-client` and press `i` to launch the Simulator.

##### To run on a physical iOS device:

- You need an Apple Developer account (free for dev, paid for App Store).
- Connect your device via USB.
- In Xcode, select your device as the target and run the app.
- You may need to trust your developer certificate on the device.

---

### B. Android (Windows, macOS, Fedora Linux)

#### Requirements

- **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio)
- **Android SDK** (installed via Android Studio)
- **Android Virtual Device (AVD)** (emulator)
- **Java JDK 17+** (set JAVA_HOME if needed)

#### Steps (Emulator)

```bash
# 1. Install dependencies
npm install

# 2. Generate native folders
npx expo prebuild --clean 
#              (OR)
npx expo prebuild --platform android

# 3. Start Android emulator:
#    - Open Android Studio → More Actions → Virtual Device Manager
#    - Create a device (e.g. Pixel 6, API 33+)
#    - Start the emulator and wait for it to boot
# NOTE: You need to set an environment Variable for the system if havent done already
#        EX: ANDROID_HOME: C:\Users\_______\AppData\Local\Android\Sdk - That is the standard path, 

# Note for Windows Graders: This project uses React Native's New Architecture. If you encounter "Path too long" errors, please ensure Long Paths are enabled in your Windows Registry or move the project folder closer to the drive root (e.g., C:\src\Project).

# Windows Build Configuration (Required)
# This project utilizes the React Native New Architecture, which involves a complex C++ compilation process via the Android NDK. This process generates deep directory structures that frequently exceed the legacy Windows 260-character path limit (MAX_PATH).

# To ensure a successful build on Windows, please follow these requirements:

# Project Location: The project must be located in a short directory path (e.g., C:\src\TreeD). Running the project from deep within folders like Desktop or Documents will cause the C++ linker to fail.

# System Configuration: Ensure Long Paths are enabled in the Windows Registry. You can verify this by checking that LongPathsEnabled is set to 1 in HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem.

# Fresh Environment: If relocating the project, always delete the node_modules and android folders and run npm install from the new location to ensure all internal metadata and autolinking paths are correctly mapped to the new root.

Execution: From the root of the project, run:
# 4. Run on emulator
npx expo run:android
```
- It will take some time to initialize, configure and execute. Let it run. 
- The app will build and install on the emulator automatically.
- For subsequent runs, use `npx expo start --dev-client` and press `a` to launch the emulator, that will be much faster.

#### Steps (Physical Android Device)

1. **Enable Developer Options** on your device:
   - Go to Settings → About phone → Tap "Build number" 7 times.
2. **Enable USB Debugging**:
   - Settings → Developer options → Enable "USB debugging".
3. **Connect device via USB**.
4. **Authorize your computer** if prompted on the device.
5. **Install ADB** (if not already):  
   - Windows: Included with Android Studio  
   - Fedora: `sudo dnf install android-tools`
6. **Verify device is detected**:
   ```bash
   adb devices
   ```
   Should show your device as "device".

7. **Run the app**:
   ```bash
   npx expo run:android
   ```
   The app will build and install on your device.

##### Fedora 43 Notes

- Install dependencies:
  ```bash
  sudo dnf install android-tools java-17-openjdk python3
  ```
- Android Studio: Download from [developer.android.com/studio](https://developer.android.com/studio)
- Follow the same steps as above for emulator or device.

---

### C. Subsequent Runs (All Platforms)

Once the native folders are generated and the app is installed:

```bash
npx expo start --dev-client --clear
```

- Press `i` for iOS Simulator, `a` for Android emulator, or scan the QR code with your device (if using a dev client build).

---

## Physical Device Setup (Summary)

| Platform | Requirements | Steps |
|----------|-------------|-------|
| Android  | USB debugging, ADB, Android Studio | Enable dev mode, connect USB, run `npx expo run:android` |
| iOS      | Apple Developer account, Xcode | Connect device, trust cert, run via Xcode or `npx expo run:ios` |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `SDK location not found` | Set ANDROID_HOME, check Android Studio SDK Manager |
| `No emulator found` | Start the emulator in Android Studio before running |
| `CocoaPods install fails` | Run `sudo gem install cocoapods` |
| App opens but map is blank | Requires internet for live tiles; use offline maps for field work |
| `command not found: expo` | Use `npx expo` instead of `expo` |
| Permission errors | Grant location, storage, and camera permissions in device settings |

---

## Testing

### Automated Tests

- Run all tests:
  ```bash
  npm test
  ```
- CSV import/export test:
  ```bash
  node src/__tests__/CSV_import_export_test.mjs
  ```

- **Continuous Integration:**  
  Automated tests are run on every commit using the included `Jenkinsfile` for CI/CD. Jenkins is configured to build, test, and report results automatically using Docker. It has a multi-branch configuration to ensure that every commit that gets pushed is tested automatically.

### Manual Testing

- Map, offline tiles, and GPS require emulator or device.
- Test offline mode by toggling airplane mode and verifying map and data access.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Mobile Device                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React Native UI Layer                    │  │
│  │  MapScreen  │  AddTree  │  TreeDetail  │  Settings    │  │
│  │                   RegionDownload                      │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │                                  │
│          ┌───────────────┼───────────────┐                  │
│          ▼               ▼               ▼                  │
│   ┌─────────────┐ ┌───────────┐ ┌──────────────┐           │
│   │  WebView    │ │  db.js    │ │ expo-location│           │
│   │  (Leaflet)  │ │ (SQLite)  │ │ expo-network │           │
│   └──────┬──────┘ └─────┬─────┘ └──────────────┘           │
│          │              │                                   │
│   ┌──────▼──────┐ ┌─────▼────────────────┐                 │
│   │ OSM Tiles   │ │  trees.db            │                 │
│   │ (network or │ │  (local SQLite)      │                 │
│   │  cached     │ └──────────────────────┘                 │
│   │  PNG tiles) │                                          │
│   └─────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

---

**Made by the GreenPoint Team — Saeid Kabak, Hamza Sallam, Atilla Benligil**