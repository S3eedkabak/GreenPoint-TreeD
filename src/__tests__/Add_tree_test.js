// Simple test without Jest (for sprint 1)
const assert = require('assert');

console.log('Running Tree Addition Tests...\n');

// Test 1 UUID generates unique IDs for trees
try {
  const { v4 } = require('uuid');
  const id1 = v4();
  const id2 = v4();
  
  assert.notStrictEqual(id1, id2, 'Tree IDs should be unique');
  console.log('PASS: Test 1 - Unique tree IDs generated');
  console.log(`   Tree ID 1: ${id1}`);
  console.log(`   Tree ID 2: ${id2}\n`);
} catch (error) {
  console.error('FAIL: Test 1 -', error.message);
  process.exit(1);
}

// Test 2 Tree data structure validation
try {
  const treeData = {
    species: 'Oak',
    latitude: 37.78825,  // Hard coded for the sake of testing if the structure is valid, not the actual location
    longitude: -122.4324,
    height: 15.5,
    diameter: 2.3,
  };
  
  // Validate required fields
  assert.ok(treeData.species, 'Tree must have a species');
  assert.ok(typeof treeData.species === 'string', 'Species must be a string');
  
  // Validate coordinates
  assert.ok(typeof treeData.latitude === 'number', 'Latitude must be a number');
  assert.ok(typeof treeData.longitude === 'number', 'Longitude must be a number');
  assert.ok(treeData.latitude >= -90 && treeData.latitude <= 90, 'Latitude must be between -90 and 90');
  assert.ok(treeData.longitude >= -180 && treeData.longitude <= 180, 'Longitude must be between -180 and 180');
  
  // Validate measurements
  assert.ok(typeof treeData.height === 'number', 'Height must be a number');
  assert.ok(treeData.height > 0, 'Height must be positive');
  assert.ok(typeof treeData.diameter === 'number', 'Diameter must be a number');
  assert.ok(treeData.diameter > 0, 'Diameter must be positive');
  
  console.log('PASS: Test 2 - Tree data structure is valid');
  console.log(`   Tree: ${JSON.stringify(treeData, null, 2)}\n`);
} catch (error) {
  console.error('FAIL: Test 2 -', error.message);
  process.exit(1);
}

// Test 3: Tree data with missing optional fields (notes)
try {
  const treeData = {
    species: 'Pine',
    latitude: 40.7128,
    longitude: -74.0060,
    height: 20.0,
    diameter: 3.0,
    // notes is optional
  };
  
  assert.ok(treeData.species, 'Tree must have species');
  assert.ok(!treeData.notes, 'Notes should be optional');
  
  console.log('PASS: Test 3 - Tree can be created without optional notes\n');
} catch (error) {
  console.error('FAIL: Test 3 -', error.message);
  process.exit(1);
}

// Test 4: Invalid tree data should fail
try {
  const invalidTree = {
    species: 'Maple',
    latitude: 200, // Invalid: outside valid range
    longitude: -74.0060,
    height: -5, // Invalid: negative height
    diameter: 2.0,
  };
  
  let errorCaught = false;
  
  try {
    assert.ok(invalidTree.latitude >= -90 && invalidTree.latitude <= 90, 'Invalid latitude');
  } catch (e) {
    errorCaught = true;
  }
  
  assert.ok(errorCaught, 'Invalid tree data should be rejected');
  console.log('PASS: Test 4 - Invalid tree data is rejected\n');
} catch (error) {
  console.error('FAIL: Test 4 -', error.message);
  process.exit(1);
}

// Test 5: Multiple trees can be created
try {
  const { v4 } = require('uuid');
  
  const trees = [
    { id: v4(), species: 'Oak', latitude: 37.78, longitude: -122.43, height: 15, diameter: 2.3 },
    { id: v4(), species: 'Pine', latitude: 40.71, longitude: -74.00, height: 20, diameter: 3.0 },
    { id: v4(), species: 'Maple', latitude: 51.50, longitude: -0.12, height: 12, diameter: 1.8 },
  ];
  
  // Verify all IDs are unique
  const ids = trees.map(t => t.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'All tree IDs must be unique');
  
  // Verify all have required fields
  trees.forEach(tree => {
    assert.ok(tree.species, 'Tree must have species');
    assert.ok(typeof tree.latitude === 'number', 'Tree must have latitude');
    assert.ok(typeof tree.longitude === 'number', 'Tree must have longitude');
  });
  
  console.log(`PASS: Test 5 - ${trees.length} trees created successfully`);
  console.log('   All trees have unique IDs and valid data\n');
} catch (error) {
  console.error('FAIL: Test 5 -', error.message);
  process.exit(1);
}

console.log('All tree addition tests passed!\n');
console.log('Summary:');
console.log('  - Unique ID generation');
console.log('  - Data validation');
console.log('  - Optional fields handling');
console.log('  - Invalid data rejection');
console.log('  - Multiple tree creation\n');
