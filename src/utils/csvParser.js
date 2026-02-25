/**
 * CSV Parser Utility for Tree Data
 * 
 * Parses CSV files containing tree data according to the specification:
 * Tree ID, Date, Easting, Northing, Species, DBH, Height, Crown height, Crown radius, Crown completeness, Tags
 * 
 * Features:
 * - Trims header names to handle extra spaces
 * - Ignores empty columns
 * - Handles missing/malformed values gracefully
 * - Returns detailed parsing results with errors
 */

/**
 * Parses a CSV string into an array of tree objects
 * @param {string} csvText - The raw CSV file content
 * @returns {Object} - { trees: Array, errors: Array, warnings: Array }
 */
export const parseTreeCSV = (csvText) => {
    const results = {
        trees: [],
        errors: [],
        warnings: []
    };

    if (!csvText || typeof csvText !== 'string') {
        results.errors.push({ row: 0, message: 'Invalid CSV content' });
        return results;
    }

    // Split into lines and filter out empty lines
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        results.errors.push({ row: 0, message: 'CSV file is empty or has no data rows' });
        return results;
    }

    // Parse header row
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.trim());

    // Create header map (case-insensitive, trimmed)
    const headerMap = createHeaderMap(headers);

    // Validate required headers
    const requiredHeaders = ['tree id', 'date', 'easting', 'northing', 'species', 'height'];
    const missingHeaders = requiredHeaders.filter(h => !headerMap.has(h));

    if (missingHeaders.length > 0) {
        results.errors.push({
            row: 0,
            message: `Missing required headers: ${missingHeaders.join(', ')}`
        });
        return results;
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
        const rowNumber = i + 1;
        const line = lines[i].trim();

        if (!line) continue; // Skip empty lines

        try {
            const values = parseCSVLine(line);
            const tree = parseTreeRow(values, headerMap, rowNumber, results);

            if (tree) {
                results.trees.push(tree);
            }
        } catch (error) {
            results.errors.push({
                row: rowNumber,
                message: `Failed to parse row: ${error.message}`
            });
        }
    }

    return results;
};

/**
 * Creates a map of header names to their column indices
 * Normalizes header names (lowercase, trimmed) for case-insensitive matching
 */
const createHeaderMap = (headers) => {
    const map = new Map();

    headers.forEach((header, index) => {
        const normalized = header.toLowerCase().trim();
        if (normalized) { // Ignore empty headers
            map.set(normalized, index);
        }
    });

    return map;
};

/**
 * Parses a single CSV line, handling quoted values with commas
 */
const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current.trim());
    return values;
};

/**
 * Parses a single tree row into a tree object
 */
const parseTreeRow = (values, headerMap, rowNumber, results) => {
    // Helper to get value by header name
    const getValue = (headerName) => {
        const index = headerMap.get(headerName.toLowerCase());
        if (index === undefined) return null;
        const value = values[index];
        return value && value.trim() ? value.trim() : null;
    };

    // Extract required fields
    const treeId = getValue('tree id');
    const dateStr = getValue('date');
    const eastingStr = getValue('easting');
    const northingStr = getValue('northing');
    const species = getValue('species');
    const heightStr = getValue('height');

    // Validate required fields
    const errors = [];

    if (!treeId) errors.push('Tree ID is required');
    if (!dateStr) errors.push('Date is required');
    if (!eastingStr) errors.push('Easting is required');
    if (!northingStr) errors.push('Northing is required');
    if (!species) errors.push('Species is required');
    if (!heightStr) errors.push('Height is required');

    if (errors.length > 0) {
        results.errors.push({
            row: rowNumber,
            message: errors.join('; '),
            treeId: treeId || 'unknown'
        });
        return null;
    }

    // Parse and validate numeric fields
    const easting = parseFloat(eastingStr);
    const northing = parseFloat(northingStr);
    const height = parseFloat(heightStr);

    if (isNaN(easting)) {
        results.errors.push({ row: rowNumber, treeId, message: 'Invalid Easting value' });
        return null;
    }
    if (isNaN(northing)) {
        results.errors.push({ row: rowNumber, treeId, message: 'Invalid Northing value' });
        return null;
    }
    if (isNaN(height) || height <= 0) {
        results.errors.push({ row: rowNumber, treeId, message: 'Invalid Height value (must be > 0)' });
        return null;
    }

    // Parse date
    const date = parseDate(dateStr);
    if (!date) {
        results.errors.push({ row: rowNumber, treeId, message: `Invalid date format: ${dateStr}` });
        return null;
    }

    // Parse optional fields
    const tree = {
        tree_id: treeId,
        date: date,
        easting: easting,
        northing: northing,
        species: species,
        tree_height: height,
        dbh: parseOptionalNumber(getValue('dbh'), 'DBH', rowNumber, treeId, results),
        crown_height: parseOptionalNumber(getValue('crown height'), 'Crown height', rowNumber, treeId, results),
        crown_radius: parseOptionalNumber(getValue('crown radius'), 'Crown radius', rowNumber, treeId, results),
        crown_completeness: parseOptionalNumber(getValue('crown completeness'), 'Crown completeness', rowNumber, treeId, results, 0, 1),
        tags: getValue('tags')
    };

    return tree;
};

/**
 * Parses optional numeric fields with validation
 */
const parseOptionalNumber = (value, fieldName, rowNumber, treeId, results, min = 0, max = Infinity) => {
    if (!value) return null;

    const num = parseFloat(value);

    if (isNaN(num)) {
        results.warnings.push({
            row: rowNumber,
            treeId,
            message: `Invalid ${fieldName} value "${value}", setting to null`
        });
        return null;
    }

    if (num < min || num > max) {
        results.warnings.push({
            row: rowNumber,
            treeId,
            message: `${fieldName} value ${num} out of range [${min}, ${max}], setting to null`
        });
        return null;
    }

    return num;
};

/**
 * Parses date string into YYYY-MM-DD format
 * Supports multiple formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc.
 */
const parseDate = (dateStr) => {
    if (!dateStr) return null;

    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Try parsing with Date constructor
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Try MM/DD/YYYY or DD/MM/YYYY format
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        // Assume MM/DD/YYYY if first part is <= 12
        if (parseInt(parts[0]) <= 12) {
            const month = String(parts[0]).padStart(2, '0');
            const day = String(parts[1]).padStart(2, '0');
            const year = parts[2];
            return `${year}-${month}-${day}`;
        }
    }

    return null;
};

/**
 * Validates a parsed tree object against the schema
 * @param {Object} tree - The tree object to validate
 * @returns {Object} - { valid: boolean, errors: Array }
 */
export const validateTree = (tree) => {
    const errors = [];

    // Required fields
    if (!tree.tree_id) errors.push('Tree ID is required');
    if (!tree.date) errors.push('Date is required');
    if (typeof tree.easting !== 'number' || isNaN(tree.easting)) errors.push('Valid Easting is required');
    if (typeof tree.northing !== 'number' || isNaN(tree.northing)) errors.push('Valid Northing is required');
    if (!tree.species) errors.push('Species is required');
    if (typeof tree.tree_height !== 'number' || tree.tree_height <= 0) errors.push('Valid Height is required');

    // Optional field validation
    if (tree.dbh !== null && (typeof tree.dbh !== 'number' || tree.dbh < 0)) {
        errors.push('DBH must be a positive number');
    }
    if (tree.crown_height !== null && (typeof tree.crown_height !== 'number' || tree.crown_height < 0)) {
        errors.push('Crown height must be a positive number');
    }
    if (tree.crown_radius !== null && (typeof tree.crown_radius !== 'number' || tree.crown_radius < 0)) {
        errors.push('Crown radius must be a positive number');
    }
    if (tree.crown_completeness !== null && (typeof tree.crown_completeness !== 'number' || tree.crown_completeness < 0 || tree.crown_completeness > 1)) {
        errors.push('Crown completeness must be between 0 and 1');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

export default { parseTreeCSV, validateTree };
