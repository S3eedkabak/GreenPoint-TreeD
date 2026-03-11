import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

let db;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const openDatabase = async () => { // Singleton pattern / ONLY ONE SHOULD EXIST AT ALL TIMES
  if (!db) {  // if no db
    db = await SQLite.openDatabaseAsync('trees.db'); // open or create
  }
  return db; // return existing or new database instance
};

export const initDatabase = async () => { // Initialize DB 
  try {
    const database = await openDatabase();

    // Only CREATE IF NOT EXISTS to avoid overwriting data
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS trees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tree_id TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        northing REAL NOT NULL,
        easting REAL NOT NULL,
        species TEXT NOT NULL,
        dbh REAL,
        tree_height REAL NOT NULL,
        crown_height REAL,
        crown_radius REAL,
        crown_completeness REAL,
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_trees_tree_id ON trees(tree_id);
      CREATE INDEX IF NOT EXISTS idx_trees_date ON trees(date);
      CREATE INDEX IF NOT EXISTS idx_trees_species ON trees(species);
      CREATE INDEX IF NOT EXISTS idx_trees_coords ON trees(northing, easting);
    `);
    
    console.log('Local database initialized (data persists between restarts)');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const insertTree = async (species, treeHeight, latitude, longitude, dbh = null, crownHeight = null, crownRadius = null, crownCompleteness = null, tags = null) => {
  try { // insert a new tree with parameters
    const database = await openDatabase(); 

    // Generate UUID and current date (CSV spec)
    const treeId = generateUUID();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const localResult = await database.runAsync( // insert without synced column
      `INSERT INTO trees (
        tree_id, date, northing, easting, species, dbh,
        tree_height, crown_height, crown_radius, crown_completeness, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [treeId, date, latitude, longitude, species, dbh, treeHeight, crownHeight, crownRadius, crownCompleteness, tags]
    ) 

    console.log('Tree saved locally:', treeId); // done 
    return treeId;
  } catch (error) {
    console.error('Error inserting tree:', error);
    throw error;
  }
};

export const getAllTrees = async (filters = {}) => { // retrieve all trees or with filters
  try {
    const database = await openDatabase();
    let query = 'SELECT * FROM trees WHERE 1=1';
    const params = [];

    if (filters.species) { // case-insensitive search
      query += ' AND LOWER(species) LIKE LOWER(?)';
      params.push(`%${filters.species}%`);
    }

    if (filters.minHeight) { // minimum tree height filter
      query += ' AND tree_height >= ?';
      params.push(filters.minHeight);
    }

    if (filters.maxHeight) { // maximum tree height filter
      query += ' AND tree_height <= ?';
      params.push(filters.maxHeight);
    }

    if (filters.startDate) { // date start range filter
      query += ' AND date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) { // date end range filter
      query += ' AND date <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC'; // most recent first

    const trees = await database.getAllAsync(query, params);
    console.log(`📱 Fetched ${trees.length} trees from local database`);
    return trees;
  } catch (error) {
    console.error('Error fetching trees:', error); // detailed logging
    throw error;
  }
};

// Returns a single integer — never loads rows into memory.
export const getTreeCount = async () => {
  try {
    const database = await openDatabase();
    const result = await database.getFirstAsync('SELECT COUNT(*) as count FROM trees');
    return result ? result.count : 0;
  } catch (error) {
    console.error('Error getting tree count:', error);
    throw error;
  }
};

// Returns only trees whose northing/easting fall within the given bounding box.
// Uses the idx_trees_coords composite index for fast range scans.
export const getTreesInBounds = async (minLat, maxLat, minLng, maxLng) => {
  try {
    const database = await openDatabase();
    const trees = await database.getAllAsync(
      `SELECT * FROM trees
       WHERE northing >= ? AND northing <= ?
         AND easting  >= ? AND easting  <= ?
       ORDER BY created_at DESC`,
      [minLat, maxLat, minLng, maxLng]
    );
    console.log(`📱 Fetched ${trees.length} trees in bounds`);
    return trees;
  } catch (error) {
    console.error('Error fetching trees in bounds:', error);
    throw error;
  }
};

// Helper function to escape CSV values (handles commas, quotes, newlines)
const escapeCSV = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Helper function to parse CSV line (handles quoted values)
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current); // Add last value
  return values;
};

export const exportToCSV = async () => {
  try {
    const trees = await getAllTrees();
    
    if (trees.length === 0) {
      throw new Error('No trees to export');
    }
    
    // CSV header matching exact specification
    let csvContent = 'Tree ID,Date,Northing,Easting,Species,DBH,Tree height,Crown height,Crown radius,Crown completeness,Tags\n';
    
    trees.forEach(tree => {
      csvContent += `${escapeCSV(tree.tree_id)},`;
      csvContent += `${escapeCSV(tree.date)},`;
      csvContent += `${escapeCSV(tree.northing)},`;
      csvContent += `${escapeCSV(tree.easting)},`;
      csvContent += `${escapeCSV(tree.species)},`;
      csvContent += `${escapeCSV(tree.dbh)},`;
      csvContent += `${escapeCSV(tree.tree_height)},`;
      csvContent += `${escapeCSV(tree.crown_height)},`;
      csvContent += `${escapeCSV(tree.crown_radius)},`;
      csvContent += `${escapeCSV(tree.crown_completeness)},`;
      csvContent += `${escapeCSV(tree.tags)}\n`;
    });

    return csvContent;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw error;
  }
};

// Batch size for transactional inserts. 500 rows per transaction balances
// memory pressure against SQLite transaction overhead on mobile hardware.
const IMPORT_BATCH_SIZE = 500;

export const importFromCSV = async (csvContent, onProgress = null) => {
  try {
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    // ── Header validation (unchanged logic) ──────────────────────────────────
    const header = lines[0].split(',').map(h => h.trim());

    const expectedHeaders = [
      'Tree ID', 'Date', 'Northing', 'Easting', 'Species',
      'DBH', 'Tree height', 'Crown height', 'Crown radius',
      'Crown completeness', 'Tags',
    ];

    const headerLower   = header.map(h => h.toLowerCase());
    const expectedLower = expectedHeaders.map(h => h.toLowerCase());

    const isValidHeader = expectedLower.every((expected, index) =>
      headerLower[index] === expected ||
      headerLower[index] === expected.replace(/\s+/g, '')
    );

    if (!isValidHeader) {
      throw new Error('Invalid CSV format. Header does not match expected format.');
    }

    // ── Pre-pass: collect all data rows (skip header + blanks) ───────────────
    // We build a lightweight array of raw line strings, not parsed objects,
    // so we don't hold 1M parsed objects in memory simultaneously.
    const dataLines = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) dataLines.push({ raw: line, lineIndex: i });
    }

    const total      = dataLines.length;
    let imported     = 0;
    let skipped      = 0;
    const errors     = [];
    const errorDetails = [];

    const database = await openDatabase();

    // ── Process in batches ───────────────────────────────────────────────────
    for (let batchStart = 0; batchStart < total; batchStart += IMPORT_BATCH_SIZE) {
      const batchEnd  = Math.min(batchStart + IMPORT_BATCH_SIZE, total);
      const batch     = dataLines.slice(batchStart, batchEnd);

      // Validate all rows in this batch before opening a transaction.
      // Invalid rows are collected as errors and excluded from the insert.
      const validRows = [];

      for (const { raw, lineIndex } of batch) {
        const rowNum = lineIndex + 1; // 1-based for user-facing messages
        try {
          const values = parseCSVLine(raw);

          const treeId   = values[0]?.trim() || generateUUID();
          const date     = values[1]?.trim() || new Date().toISOString().split('T')[0];
          const northing = parseFloat(values[2]?.trim());
          const easting  = parseFloat(values[3]?.trim());
          const species  = values[4]?.trim();
          const dbh      = values[5]?.trim() ? parseFloat(values[5].trim()) : null;
          const treeHeight      = parseFloat(values[6]?.trim());
          const crownHeight     = values[7]?.trim() ? parseFloat(values[7].trim()) : null;
          const crownRadius     = values[8]?.trim() ? parseFloat(values[8].trim()) : null;
          const crownCompleteness = values[9]?.trim() ? parseFloat(values[9].trim()) : null;
          const tags     = values[10]?.trim() || null;

          // ── Per-row validation (same rules as before) ──────────────────────
          if (!species) throw new Error(`Row ${rowNum}: Species is required`);
          if (isNaN(northing) || isNaN(easting)) throw new Error(`Row ${rowNum}: Invalid coordinates`);
          if (isNaN(treeHeight) || treeHeight <= 0) throw new Error(`Row ${rowNum}: Tree height must be a positive number`);
          if (dbh !== null && (isNaN(dbh) || dbh < 0)) throw new Error(`Row ${rowNum}: Invalid DBH value`);
          if (crownHeight !== null && (isNaN(crownHeight) || crownHeight < 0)) throw new Error(`Row ${rowNum}: Invalid crown height value`);
          if (crownRadius !== null && (isNaN(crownRadius) || crownRadius < 0)) throw new Error(`Row ${rowNum}: Invalid crown radius value`);
          if (crownCompleteness !== null && (isNaN(crownCompleteness) || crownCompleteness < 0 || crownCompleteness > 1)) {
            throw new Error(`Row ${rowNum}: Crown completeness must be between 0 and 1`);
          }

          validRows.push([treeId, date, northing, easting, species, dbh,
            treeHeight, crownHeight, crownRadius, crownCompleteness, tags]);
        } catch (err) {
          errors.push(err.message);
          errorDetails.push(err.message);
        }
      }

      if (validRows.length === 0) {
        // Nothing valid in this batch — skip the transaction entirely
        const processed = batchEnd;
        if (onProgress) onProgress({ processed, total, imported, skipped });
        continue;
      }

      // ── Single transaction for the whole batch ───────────────────────────
      // INSERT OR IGNORE lets SQLite silently skip any row whose tree_id
      // already exists (UNIQUE constraint), eliminating the need for a
      // SELECT-per-row duplicate check.
      let batchImported = 0;
      let batchSkipped  = 0;

      await database.withTransactionAsync(async () => {
        for (const row of validRows) {
          const result = await database.runAsync(
            `INSERT OR IGNORE INTO trees (
              tree_id, date, northing, easting, species, dbh,
              tree_height, crown_height, crown_radius, crown_completeness, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            row
          );
          // runAsync returns { changes, lastInsertRowId }.
          // changes === 0 means IGNORE fired (duplicate tree_id).
          if (result.changes > 0) {
            batchImported++;
          } else {
            batchSkipped++;
          }
        }
      });

      imported += batchImported;
      skipped  += batchSkipped;

      const processed = batchEnd;
      if (onProgress) onProgress({ processed, total, imported, skipped });
    }

    return {
      success: true,
      imported,
      skipped,
      total,
      errors: errors.length,
      errorDetails,
    };

  } catch (error) {
    console.error('Error importing CSV:', error);
    throw error;
  }
};

export default { initDatabase, insertTree, getAllTrees, getTreeCount, getTreesInBounds, exportToCSV, importFromCSV };