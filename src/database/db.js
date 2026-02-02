import * as SQLite from 'expo-sqlite';

let db;

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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
    
    const treeId = generateUUID();
    const date = new Date().toISOString().split('T')[0];
    
    await database.runAsync(
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

export const getAllTrees = async (filters = {}) => {
  try {
    const database = await openDatabase();
    let query = 'SELECT * FROM trees WHERE 1=1';
    const params = [];
    
    if (filters.species) {
      query += ' AND LOWER(species) LIKE LOWER(?)';
      params.push(`%${filters.species}%`);
    }
    
    if (filters.minHeight) {
      query += ' AND tree_height >= ?';
      params.push(filters.minHeight);
    }
    
    if (filters.maxHeight) {
      query += ' AND tree_height <= ?';
      params.push(filters.maxHeight);
    }
    
    if (filters.startDate) {
      query += ' AND date >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      query += ' AND date <= ?';
      params.push(filters.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const trees = await database.getAllAsync(query, params);
    console.log(`📱 Fetched ${trees.length} trees from local database`);
    return trees;
  } catch (error) {
    console.error('Error fetching trees:', error);
    throw error;
  }
};

export const exportToCSV = async () => {
  try {
    const trees = await getAllTrees();
    
    let csvContent = 'Tree ID,Date,Northing,Easting,Species,DBH,Tree height,Crown height,Crown radius,Crown completeness,Tags\n';
    
    trees.forEach(tree => {
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

export default { initDatabase, insertTree, getAllTrees, exportToCSV };
