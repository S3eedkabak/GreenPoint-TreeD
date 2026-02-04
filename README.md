# Green Point Data Recorder

GreenPoint is a mobile-first application for foresters and environmental professionals to collect, manage, and analyze tree inventory data in the field. It provides offline-capable data capture with local SQLite storage, map-based record management, and CSV import/export functionality for data portability.

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81.4-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54.0.31-black.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)

## Features

- **Interactive Map Interface** - View and navigate tree locations using React Native Maps
- **Add Tree Records** - Collect comprehensive tree data including species, height, DBH, crown measurements, and GPS coordinates
- **Tree Details** - View detailed information about each recorded tree
- **Offline Storage** - Local SQLite database for persistent offline data storage
- **CSV Import/Export** - Import bulk tree data from CSV files with validation and error handling
- **Data Validation** - Built-in validation for tree measurements and attributes
- **Modern UI** - Clean, intuitive interface with custom navigation

## Architecture

TreeD follows a **Standalone-Local-Offline Architecture** designed for field data collection without internet dependency.

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Device                          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Native Frontend (Offline)            │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│ │
│  │  │   Map    │  │ Add Tree │  │  Tree    │  │Settings ││ │
│  │  │  Screen  │  │  Screen  │  │ Details  │  │ Screen  ││ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘│ │
│  │       │             │             │              │      │ │
│  │       └─────────────┴─────────────┴──────────────┘      │ │
│  │                          │                               │ │
│  │                          ▼                               │ │
│  │              ┌───────────────────────┐                  │ │
│  │              │   Database Layer      │                  │ │
│  │              │   (db.js API)         │                  │ │
│  │              └──────────┬────────────┘                  │ │
│  └─────────────────────────┼───────────────────────────────┘ │
│                             ▼                                 │
│         ┌─────────────────────────────────────────┐          │
│         │      SQLite Database (Local Storage)    │          │
│         │                                          │          │
│         │  ┌────────────────────────────────────┐ │          │
│         │  │  trees.db                          │ │          │
│         │  │  • tree_id (UUID)                  │ │          │
│         │  │  • species                         │ │          │
│         │  │  • coordinates (northing, easting) │ │          │
│         │  │  • measurements (height, DBH, etc) │ │          │
│         │  │  • date, tags                      │ │          │
│         │  └────────────────────────────────────┘ │          │
│         └─────────────────────────────────────────┘          │
│                             │                                 │
│                             ▼                                 │
│         ┌─────────────────────────────────────────┐          │
│         │      File System (CSV Export)           │          │
│         │      • Export data to CSV               │          │
│         │      • Import data from CSV             │          │
│         │      • Share files locally              │          │
│         └─────────────────────────────────────────┘          │
│                                                               │
└─────────────────────────────────────────────────────────────┘

```

## Tech Stack

- **Framework:** React Native 0.81.4 with Expo 54.0.31
- **Navigation:** React Navigation 7.1.28 (Stack Navigator)
- **Maps:** React Native Maps 1.20.1
- **Storage:** Expo SQLite 16.0.10
- **Location:** Expo Location 19.0.8
- **File System:** Expo File System 19.0.21 (for CSV import)
- **State Management:** React Hooks
- **UI Components:** React Native Dropdown Picker, Slider, custom components
- **Data Validation:** Custom Tree model with schema validation
- **Version Control:** Git

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Expo Go App** - Install from [App Store](https://apps.apple.com/app/expo-go/id982107779) or [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/S3eedkabak/Green-Point-3rd-Year-Final-Project-TreeD.git
cd Green-Point-3rd-Year-Final-Project-TreeD
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Google Maps API (Android)

Edit `app.json` and add your Google Maps API key:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "X"
        }
      }
    }
  }
}
```

## Running the Project

### Start the Development Server

```bash
npx expo start --tunnel
```
MAKE SURE ALL DEPENDENCIES ARE INSTALLED.
```bash
    npm install
```


Or simply:

```bash
npm start
```

### Testing on Your Device

1. Install **Expo Go** app on your phone from the App Store or Google Play
2. Scan the QR code shown in the terminal
3. The app will load on your device

**Note:** Use `--tunnel` flag if your device is not on the same network as your development machine.

## Testing

The project includes comprehensive test suites for core functionality.

### Available Tests

#### 1. Add Tree Test
Tests the tree insertion functionality with validation.

```bash
npm test
```

This test suite validates:
- Tree creation with valid data
- Required field validation (species, height, coordinates)
- Optional field handling (DBH, crown measurements)
- Data type validation
- Database insertion

**Test File:** `src/__tests__/Add_tree_test.js`

#### 2. CSV Import/Export Test
Tests CSV parsing, validation, and data integrity.

```bash
npm run test:csv
```

This test suite validates:
- CSV file parsing with proper header validation
- Data type conversions (strings to numbers)
- Handling of quoted fields and special characters
- Error detection and reporting
- Duplicate tree ID detection
- Export format consistency
- Round-trip data integrity (export → import)

**Test File:** `src/__tests__/CSV_import_export_test.mjs`

### Running All Tests

```bash
# Run tree insertion tests
npm test

# Run CSV import/export tests
npm run test:csv
```

## Project Structure

```
TreeD/
├── App.js                          # Main app entry point with navigation
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── README.md                       # This file
├── CSV_IMPORT_README.md            # CSV import documentation
├── Jenkinsfile                     # CI/CD configuration
│
├── src/
│   ├── __tests__/
│   │   └── Add_tree_test.js        # Test cases
│   │
│   ├── database/
│   │   └── db.js                   # SQLite database initialization & operations
│   │
│   │
│   │   
│   │
│   ├── screens/
│   │   ├── MapScreen.js            # Main map interface
│   │   ├── AddTreeScreen.js        # Add new tree form
│   │   ├── TreeDetailScreen.js     # Tree details view
│   │   └── SettingsScreen.js       # App settings & CSV import
│   │
│   └── utils/
│       ├── csvParser.js            # CSV parsing and validation
│       ├── csvImportExamples.js    # CSV import examples
│       └── testCSVParser.js        # CSV parser tests
│
└── test-data/
    ├── sample_trees.csv            # Sample CSV data
    └── sample_trees_with_errors.csv # CSV validation examples
```
**Made with GreenPoint Team, Saeid Kabak, Hamza Sallam, Atilla Benligil**

