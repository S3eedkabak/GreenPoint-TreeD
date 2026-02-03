# CSV Import - Quick Reference

## How to Use

### 1. Import from CSV File

```javascript
import * as FileSystem from 'expo-file-system';
import { parseTreeCSV } from './utils/csvParser';
import { importTreesFromCSV } from './database/db';

// Read and parse CSV
const csvContent = await FileSystem.readAsStringAsync(fileUri);
const { trees, errors, warnings } = parseTreeCSV(csvContent);

// Import to database
const results = await importTreesFromCSV(trees);
console.log(`Imported ${results.success} trees`);
```

### 2. CSV Format

**Required columns**: Tree ID, Date, Easting, Northing, Species, Height  
**Optional columns**: DBH, Crown height, Crown radius, Crown completeness, Tags

Example:
```csv
Tree ID,Date,Easting,Northing,Species,DBH,Height,Crown height,Crown radius,Crown completeness,Tags
550e8400-...,2024-01-15,-122.4194,37.7749,Oak,65.5,25.3,8.5,6.2,0.85,healthy
```

### 3. Error Handling

```javascript
const { trees, errors, warnings } = parseTreeCSV(csvContent);

// Check for errors
if (errors.length > 0) {
  errors.forEach(err => {
    console.log(`Row ${err.row}: ${err.message}`);
  });
}

// Import valid trees
if (trees.length > 0) {
  const results = await importTreesFromCSV(trees);
  // Handle results...
}
```

## Files Created

- **Parser**: `src/utils/csvParser.js`
- **Model**: `src/models/Tree.js`
- **Database**: `src/database/db.js` (added `importTreesFromCSV`)
- **Examples**: `src/utils/csvImportExamples.js`
- **Test Data**: `test-data/sample_trees.csv`, `test-data/sample_trees_with_errors.csv`

## Key Features

✅ Trims header spaces  
✅ Ignores empty columns  
✅ Handles missing values  
✅ Validates data types  
✅ Detects duplicates  
✅ Detailed error reporting  
✅ Batch import support  

## Validation Rules

- **Tree ID**: Required, non-empty string
- **Date**: Required, YYYY-MM-DD format
- **Easting/Northing**: Required, valid numbers
- **Species**: Required, non-empty string
- **Height**: Required, > 0 meters
- **DBH**: Optional, ≥ 0 cm
- **Crown height/radius**: Optional, ≥ 0 meters
- **Crown completeness**: Optional, 0-1 range
- **Tags**: Optional, any text
