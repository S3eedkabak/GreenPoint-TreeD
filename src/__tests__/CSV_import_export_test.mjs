/**
 * CSV Import/Export Tests (ESM version)
 * Run: node src/__tests__/CSV_import_export_test.mjs
 * Verbose (log all errors/warnings): VERBOSE=1 npm run test:csv
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dynamic import for csvParser (ES module)
const { parseTreeCSV } = await import('../utils/csvParser.js');

const SAMPLE_CSV = path.join(__dirname, '../../test-data/sample_trees.csv');
const SAMPLE_ERRORS_CSV = path.join(__dirname, '../../test-data/sample_trees_with_errors.csv');

const VERBOSE = process.env.VERBOSE === '1' || process.argv.includes('--verbose');

function logParseResult(label, result) {
  if (result.errors.length > 0) {
    console.error(`   [${label}] Parsing errors:`);
    result.errors.forEach((e, i) => {
      console.error(`     ${i + 1}. Row ${e.row}: ${e.message}${e.treeId ? ` (tree_id: ${e.treeId})` : ''}`);
    });
  }
  if (result.warnings && result.warnings.length > 0) {
    console.warn(`   [${label}] Warnings:`);
    result.warnings.forEach((w, i) => {
      console.warn(`     ${i + 1}. Row ${w.row} (${w.treeId}): ${w.message}`);
    });
  }
}

function logImportResult(label, result) {
  if (result.errors.length > 0) {
    console.error(`   [${label}] Import errors:`);
    result.errors.forEach((e, i) => {
      console.error(`     ${i + 1}. ${e.tree_id}: ${e.message}`);
    });
  }
  if (result.duplicates.length > 0) {
    console.warn(`   [${label}] Duplicates skipped: ${result.duplicates.map((d) => d.tree_id).join(', ')}`);
  }
}

console.log('Running CSV Import/Export Tests...\n');

async function createTestDatabase() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE trees (
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
      synced INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX idx_trees_tree_id ON trees(tree_id);
  `);
  return db;
}

function importTreesToTestDb(db, trees) {
  const results = { success: 0, errors: [], duplicates: [], skipped: 0 };
  const existingStmt = db.prepare('SELECT tree_id FROM trees');
  const existingIds = new Set();
  while (existingStmt.step()) existingIds.add(existingStmt.get()[0]);
  existingStmt.free();

  const insertStmt = db.prepare(`
    INSERT INTO trees (tree_id, date, northing, easting, species, dbh,
      tree_height, crown_height, crown_radius, crown_completeness, tags, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const tree of trees) {
    if (existingIds.has(tree.tree_id)) {
      results.duplicates.push({ tree_id: tree.tree_id, message: 'Duplicate' });
      results.skipped++;
      continue;
    }
    try {
      insertStmt.run([
        tree.tree_id, tree.date, tree.northing, tree.easting, tree.species,
        tree.dbh ?? null, tree.tree_height, tree.crown_height ?? null,
        tree.crown_radius ?? null, tree.crown_completeness ?? null,
        tree.tags ?? null, 0,
      ]);
      results.success++;
      existingIds.add(tree.tree_id);
    } catch (err) {
      results.errors.push({ tree_id: tree.tree_id, message: err.message });
    }
  }
  insertStmt.free();
  return results;
}

function getAllTreesFromTestDb(db) {
  const stmt = db.prepare('SELECT * FROM trees ORDER BY created_at DESC');
  const trees = [];
  while (stmt.step()) trees.push(stmt.getAsObject());
  stmt.free();
  return trees;
}

function exportToCSVFromTestDb(db) {
  const trees = getAllTreesFromTestDb(db);
  let csv = 'Tree ID,Date,Northing,Easting,Species,DBH,Height,Crown height,Crown radius,Crown completeness,Tags\n';
  trees.forEach((t) => {
    csv += `${t.tree_id},${t.date},${t.northing},${t.easting},${t.species},${t.dbh ?? ''},${t.tree_height},${t.crown_height ?? ''},${t.crown_radius ?? ''},${t.crown_completeness ?? ''},${t.tags ?? ''}\n`;
  });
  return csv;
}

async function runTests() {
  let db;
  let parseResult, importResult, reparseResult, errorsResult, errorsImportResult;
  try {
    console.log('Test 1: Parse valid CSV file');
    const csvContent = fs.readFileSync(SAMPLE_CSV, 'utf-8');
    parseResult = parseTreeCSV(csvContent);
    if (VERBOSE || parseResult.errors.length > 0 || (parseResult.warnings && parseResult.warnings.length > 0)) {
      logParseResult('Test 1', parseResult);
    }
    assert.ok(parseResult.trees.length > 0, 'Should parse at least one tree');
    assert.ok(parseResult.errors.length === 0, 'Valid CSV should have no errors');
    console.log(`   Parsed ${parseResult.trees.length} trees - PASS\n`);

    console.log('Test 2: Import to database and verify map-ready data');
    db = await createTestDatabase();
    importResult = importTreesToTestDb(db, parseResult.trees);
    if (VERBOSE || importResult.errors.length > 0 || importResult.duplicates.length > 0) {
      logImportResult('Test 2', importResult);
    }
    assert.ok(importResult.success > 0, 'At least one tree should import');
    assert.strictEqual(importResult.success + importResult.skipped, parseResult.trees.length, 'All trees accounted for (imported or duplicates)');
    const allTrees = getAllTreesFromTestDb(db);
    allTrees.forEach((tree) => {
      assert.ok(tree.tree_id && tree.species, 'Map needs tree_id and species');
      assert.ok(typeof tree.northing === 'number' && typeof tree.easting === 'number', 'Map needs coords');
    });
    console.log(`   Imported ${importResult.success} trees, map would show ${allTrees.length} markers - PASS\n`);

    console.log('Test 3: Export to CSV and round-trip');
    const exportedCsv = exportToCSVFromTestDb(db);
    reparseResult = parseTreeCSV(exportedCsv);
    if (VERBOSE || reparseResult.errors.length > 0 || (reparseResult.warnings && reparseResult.warnings.length > 0)) {
      logParseResult('Test 3 (reparse)', reparseResult);
    }
    assert.strictEqual(reparseResult.trees.length, allTrees.length, 'Round-trip should preserve imported count');
    console.log('   Export and round-trip valid - PASS\n');

    console.log('Test 4: Parse CSV with errors (partial import)');
    const errorsCsv = fs.readFileSync(SAMPLE_ERRORS_CSV, 'utf-8');
    errorsResult = parseTreeCSV(errorsCsv);
    if (VERBOSE || errorsResult.errors.length > 0 || (errorsResult.warnings && errorsResult.warnings.length > 0)) {
      logParseResult('Test 4', errorsResult);
    }
    assert.ok(errorsResult.errors.length > 0 && errorsResult.trees.length > 0, 'Should have both errors and valid rows');
    db = await createTestDatabase();
    errorsImportResult = importTreesToTestDb(db, errorsResult.trees);
    if (VERBOSE || errorsImportResult.errors.length > 0 || errorsImportResult.duplicates.length > 0) {
      logImportResult('Test 4', errorsImportResult);
    }
    const mapTrees = getAllTreesFromTestDb(db);
    assert.ok(mapTrees.length > 0, 'Map should show valid trees');
    console.log(`   ${errorsResult.trees.length} valid imported, ${errorsResult.errors.length} errors - PASS\n`);

    console.log('Test 5: Empty CSV handling');
    assert.ok(parseTreeCSV('').errors.length > 0, 'Empty should error');
    assert.strictEqual(parseTreeCSV('Tree ID,Date,Easting,Northing,Species,Height\n').trees.length, 0, 'Header-only = no trees');
    console.log('   Empty/header-only handled - PASS\n');

    console.log('All CSV import/export tests passed!\n');
  } catch (error) {
    console.error('\n--- TEST FAILED ---');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    if (parseResult) {
      console.error('\nParse result:', JSON.stringify({ treesCount: parseResult.trees?.length, errors: parseResult.errors, warnings: parseResult.warnings }, null, 2));
    }
    if (importResult !== undefined) {
      console.error('\nImport result:', JSON.stringify(importResult, null, 2));
    }
    if (reparseResult !== undefined) {
      console.error('\nReparse result:', JSON.stringify({ treesCount: reparseResult.trees?.length, errors: reparseResult.errors, warnings: reparseResult.warnings }, null, 2));
    }
    if (errorsResult !== undefined) {
      console.error('\nErrors parse result:', JSON.stringify({ treesCount: errorsResult.trees?.length, errors: errorsResult.errors, warnings: errorsResult.warnings }, null, 2));
    }
    if (errorsImportResult !== undefined) {
      console.error('\nErrors import result:', JSON.stringify(errorsImportResult, null, 2));
    }
    process.exit(1);
  } finally {
    if (db) db.close();
  }
}

runTests();
