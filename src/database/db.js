import * as SQLite from 'expo-sqlite';

let db;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const openDatabase = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('trees.db');
  }
  return db;
};

export const initDatabase = async () => {
  try {
    const database = await openDatabase();

    // REMOVED DROP TABLE - now data persists!
    // Only CREATE IF NOT EXISTS - preserves existing data
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
    `);
    
    console.log('Local database initialized (data persists between restarts)');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export const insertTree = async (species, treeHeight, latitude, longitude, dbh = null, crownHeight = null, crownRadius = null, crownCompleteness = null, tags = null) => {
  try {
    const database = await openDatabase();

    // Generate UUID and current date (CSV spec)
    const treeId = generateUUID();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const localResult = await database.runAsync(
      `INSERT INTO trees (
        tree_id, date, northing, easting, species, dbh,
        tree_height, crown_height, crown_radius, crown_completeness, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [treeId, date, latitude, longitude, species, dbh, treeHeight, crownHeight, crownRadius, crownCompleteness, tags]
    );

    console.log('Tree saved locally:', treeId);
    return treeId;
  } catch (error) {
    console.error('Error inserting tree:', error);
    throw error;
  }
};

export const getAllTrees = async (filters = {}) => { // get all or with filters
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

export const exportToCSV = async () => { // exports all trees to CSV format
  try {
    const trees = await getAllTrees();

    // CSV header matching exact specification
    let csvContent = 'Tree ID,Date,Northing,Easting,Species,DBH,Tree height,Crown height,Crown radius,Crown completeness,Tags\n';

    trees.forEach(tree => { // append each tree as CSV row
      csvContent += `${tree.tree_id},`;
      csvContent += `${tree.date},`;
      csvContent += `${tree.northing},`;
      csvContent += `${tree.easting},`;
      csvContent += `${tree.species},`;
      csvContent += `${tree.dbh || ''},`;
      csvContent += `${tree.tree_height},`;
      csvContent += `${tree.crown_height || ''},`;
      csvContent += `${tree.crown_radius || ''},`;
      csvContent += `${tree.crown_completeness || ''},`;
      csvContent += `${tree.tags || ''}\n`;
    });

    return csvContent;
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw error;
  }
};

export const syncUnsyncedTrees = async () => { // ignore: SCRAPPED FROM SPRINT 1
  if (!ENABLE_CLOUD_SYNC) {
    console.log('☁️ Cloud sync is disabled');
    return { synced: 0, message: 'Cloud sync disabled' };
  }

  try {
    const database = await openDatabase();
    const unsyncedTrees = await database.getAllAsync(
      'SELECT * FROM trees WHERE synced = 0'
    );

    if (unsyncedTrees.length === 0) {
      console.log('✅ All trees are synced');
      return { synced: 0, message: 'Nothing to sync' };
    }

    console.log(`📤 Syncing ${unsyncedTrees.length} trees to cloud...`);
    const cloudTrees = await api.syncTrees(unsyncedTrees);

    for (let i = 0; i < cloudTrees.length; i++) {
      await database.runAsync(
        'UPDATE trees SET cloud_id = ?, synced = 1 WHERE tree_id = ?',
        [cloudTrees[i].id, unsyncedTrees[i].tree_id]
      );
    }

    console.log(`✅ Synced ${cloudTrees.length} trees to cloud`);
    return { synced: cloudTrees.length, message: 'Sync successful' };
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    return { synced: 0, message: 'Sync failed - no internet', error };
  }
};

/**
 * Imports trees from parsed CSV data
 * @param {Array} trees - Array of tree objects from CSV parser
 * @returns {Object} - { success: number, errors: Array, duplicates: Array }
 */
export const importTreesFromCSV = async (trees) => {
  const results = {
    success: 0,
    errors: [],
    duplicates: [],
    skipped: 0
  };

  if (!trees || trees.length === 0) {
    results.errors.push({ message: 'No trees to import' });
    return results;
  }

  try {
    const database = await openDatabase();

    // Get existing tree IDs to check for duplicates
    const existingTrees = await database.getAllAsync('SELECT tree_id FROM trees');
    const existingIds = new Set(existingTrees.map(t => t.tree_id));

    // Process each tree
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];

      try {
        // Check for duplicate
        if (existingIds.has(tree.tree_id)) {
          results.duplicates.push({
            tree_id: tree.tree_id,
            message: `Tree ID ${tree.tree_id} already exists, skipping`
          });
          results.skipped++;
          continue;
        }

        // Insert tree
        await database.runAsync(
          `INSERT INTO trees (
            tree_id, date, northing, easting, species, dbh,
            tree_height, crown_height, crown_radius, crown_completeness, tags, synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            tree.tree_id,
            tree.date,
            tree.northing,
            tree.easting,
            tree.species,
            tree.dbh,
            tree.tree_height,
            tree.crown_height,
            tree.crown_radius,
            tree.crown_completeness,
            tree.tags,
            0 // Not synced to cloud yet
          ]
        );

        results.success++;
        existingIds.add(tree.tree_id); // Add to set to catch duplicates within the same import

      } catch (error) {
        results.errors.push({
          tree_id: tree.tree_id,
          message: `Failed to import tree: ${error.message}`
        });
      }
    }

    console.log(`✅ CSV Import complete: ${results.success} imported, ${results.skipped} duplicates, ${results.errors.length} errors`);
    return results;

  } catch (error) {
    console.error('Error importing trees from CSV:', error);
    results.errors.push({ message: `Database error: ${error.message}` });
    return results;
  }
};

export default { initDatabase, insertTree, getAllTrees, exportToCSV, syncUnsyncedTrees, importTreesFromCSV };
