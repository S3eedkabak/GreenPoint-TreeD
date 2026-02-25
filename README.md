# GreenPoint TreeD

GreenPoint TreeD is a mobile-first application for foresters and environmental professionals to collect, manage, and analyse tree inventory data in the field. It provides offline-capable data capture with local SQLite storage, OpenStreetMap-based map rendering, offline tile caching, context-aware GPS, and CSV import/export functionality.

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54.0.31-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)

---

## Important — Expo Go Will NOT Work

This app uses `expo-dev-client` and native modules (SQLite, Location, FileSystem, Network) that are **not supported by Expo Go**. You must run it as a **development build** on an emulator or simulator.

**For testing purposes, we strongly recommend using emulators/simulators:**
- **iOS Simulator** (macOS only) — No Apple Developer account required
- **Android Emulator** (Windows, macOS, Linux) — No Google Play account required

Running on physical devices requires:
- **iOS**: An Apple Developer account ($99/year)
- **Android**: A physical device with USB debugging enabled (no paid account needed)

> A virtualised list console warning appears on launch but can be safely ignored as it does not affect functionality.

---

## Features

- **Interactive Map** — OpenStreetMap tiles rendered via Leaflet.js inside a WebView, works identically on iOS and Android with no proprietary SDK
- **Add Tree Records** — Species dropdown, height slider, and optional measurements (DBH, crown height, crown radius, crown completeness, tags)
- **Offline Map Caching** — Search and download map tile regions for offline use; two modes: Navigation (zoom 10–13) and Field Work (zoom 14–18)
- **Context-Aware GPS** — Fused location (GPS + Wi-Fi + cell towers) when online; GPS-chip-only when offline; accuracy badge shown on map
- **Tree Details** — View full data for any recorded tree
- **Local SQLite Storage** — All data persists on-device with no internet required
- **CSV Import/Export** — Bulk import from CSV with validation, export and share from the Settings screen
- **CI/CD Pipeline** — Jenkins multibranch pipeline with Docker runs automated tests on every commit

---

## Tech Stack

| Area | Library |
|------|---------|
| Framework | React Native 0.81.5 with Expo 54.0.31 |
| Navigation | React Navigation 7 (Stack Navigator) |
| Maps | Leaflet.js 1.9.4 over OpenStreetMap (WebView) |
| Storage | Expo SQLite 16.0.10 |
| Location | Expo Location 19.0.8 |
| Networking | Expo Network 8.0.8 |
| File System | Expo File System 19.0.21 |
| UI Components | React Native Dropdown Picker, @react-native-community/slider |
| CI/CD | Jenkins + Docker |

---

## Prerequisites

Install the following before you begin:

- **Node.js v20+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)
- **Android Studio** (for Android emulator) — [developer.android.com/studio](https://developer.android.com/studio)
- **Xcode** (for iOS simulator, macOS only) — Mac App Store

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

The app uses native modules that require a development build — **Expo Go will not work**. The steps below use `expo prebuild` to generate the native project locally, which does not require an Expo account or a paid developer account.

---

### Option A — iOS Simulator (macOS only)

#### Requirements
- macOS with **Xcode** installed (Mac App Store)
- Xcode Command Line Tools configured: Xcode → Settings → Locations → set Command Line Tools to your Xcode version

#### Steps

```bash
# 1. Install dependencies
npm install

# 2. Generate native iOS and Android folders
npx expo prebuild --clean

# 3. Run on iOS Simulator (opens Simulator automatically)
npx expo run:ios
```

The Simulator will launch and the app will install and open automatically. On subsequent runs you can skip step 2 and just run step 3.

---

### Option B — Android Emulator

#### Requirements
- **Android Studio** installed — [developer.android.com/studio](https://developer.android.com/studio)
- At least one Android Virtual Device (AVD) created and running:
  1. Open Android Studio
  2. Go to **More Actions → Virtual Device Manager**
  3. Create a device (e.g. Pixel 6, API 33 or higher)
  4. Press the **play button** to start the emulator and wait until it fully boots to the home screen

#### Steps

```bash
# 1. Install dependencies
npm install

# 2. Generate native iOS and Android folders
npx expo prebuild --clean

# 3. Run on Android emulator (emulator must already be running)
npx expo run:android
```

The app will build and install on the emulator automatically.

---

### Subsequent Runs (after first build)

Once the native folders exist and the app is installed on the emulator/simulator, you only need:

```bash
npx expo start --dev-client --clear
```

Then press **`i`** for iOS Simulator or **`a`** for Android emulator in the terminal.

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `SDK location not found` | Open Android Studio → SDK Manager, copy the SDK path, then add `export ANDROID_HOME=<path>` to your shell profile |
| `No emulator found` | Make sure the Android emulator is fully booted to the home screen before running `expo run:android` |
| CocoaPods install fails | Run `sudo gem install cocoapods` then retry `npx expo prebuild --clean` |
| App opens but map is blank | An internet connection is required for live map tiles. Use the offline maps button to download a region for offline use |
| `command not found: expo` | Run `npm install` again, then use `npx expo` instead of `expo` |

---

## Testing

### Automated Tests (CI/CD)

Both test files run automatically via **Jenkins** on every commit. Jenkins is configured as a multibranch pipeline — it tracks every branch and triggers a Docker build automatically. The pipeline builds the Docker image, runs both test files inside the container, and fails the build if any assertion breaks.

To run the tests manually:

```bash
# Tree insertion and validation tests
npm test

# CSV import/export tests
node src/__tests__/CSV_import_export_test.mjs
```

#### Add_tree_test.js

Validates core tree data logic:
- Unique UUID generation per tree
- Required field validation (species, height, coordinates)
- Rejection of invalid data (out-of-range coordinates, negative heights)
- Optional field handling
- Multiple tree creation with unique IDs

#### CSV_import_export_test.mjs

Tests the full CSV import/export flow using real CSV files:
- Parsing valid CSV files
- Database import and map-ready coordinate verification
- Round-trip export consistency (export → re-import produces the same data)
- Partial import where bad rows are skipped but valid rows pass through
- Empty and header-only CSV edge cases

### Manual Testing

Map rendering, offline tile caching, and GPS strategy require a physical device or emulator and cannot be fully automated. These were tested manually by toggling airplane mode and verifying the accuracy badge and tile fallback behaviour. Testing was limited to emulators due to device availability constraints.

---

## Project Structure

```
GreenPoint-TreeD/
├── App.js                                # Entry point, navigation setup, DB init
├── app.json                              # Expo configuration
├── eas.json                              # EAS Build profiles
├── Jenkinsfile                           # CI/CD pipeline definition
├── Dockerfile                            # Docker image for test runner
├── package.json                          # Dependencies and test scripts
│
├── assets/
│   └── leaflet-map.html                  # Leaflet map with CachedTileLayer and WebView bridge
│
├── src/
│   ├── __tests__/
│   │   ├── Add_tree_test.js              # Tree validation tests
│   │   └── CSV_import_export_test.mjs   # CSV round-trip tests
│   │
│   ├── database/
│   │   └── db.js                         # SQLite init, insert, query, CSV import/export
│   │
│   ├── models/
│   │   └── Tree.js                       # Tree schema, validation, sanitisation
│   │
│   ├── screens/
│   │   ├── MapScreen.js                  # Main map (emulator/simulator version, polling)
│   │   ├── MapScreenPROD.js              # Production map (watchPositionAsync)
│   │   ├── AddTreeScreen.js              # Add tree form with dropdown and slider
│   │   ├── TreeDetailScreen.js           # Tree detail view
│   │   ├── SettingsScreen.js             # CSV export/import, tree count
│   │   └── RegionDownloadScreen.js       # Offline tile download and management
│   │
│   └── utils/
│       ├── csvParser.js                  # CSV parsing and validation
│       ├── csvImportExamples.js          # Example CSV import flows
│       └── testCSVParser.js             # Manual CSV parser test script
│
└── test-data/
    ├── sample_trees.csv                  # Valid sample data
    └── sample_trees_with_errors.csv      # Sample data with intentional errors
```

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