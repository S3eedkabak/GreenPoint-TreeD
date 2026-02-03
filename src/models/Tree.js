/**
 * Tree Model and Validator
 * 
 * Defines the Tree data model and provides validation functions
 * to ensure data integrity before database insertion.
 */

/**
 * Tree schema definition
 */
export const TreeSchema = {
    // Required fields
    tree_id: { type: 'string', required: true },
    date: { type: 'string', required: true, format: 'YYYY-MM-DD' },
    easting: { type: 'number', required: true }, // longitude
    northing: { type: 'number', required: true }, // latitude
    species: { type: 'string', required: true },
    tree_height: { type: 'number', required: true, min: 0 },

    // Optional fields
    dbh: { type: 'number', required: false, min: 0 }, // cm
    crown_height: { type: 'number', required: false, min: 0 }, // m
    crown_radius: { type: 'number', required: false, min: 0 }, // m
    crown_completeness: { type: 'number', required: false, min: 0, max: 1 },
    tags: { type: 'string', required: false }
};

/**
 * Creates a new Tree object with default values
 */
export const createTree = (data) => {
    return {
        tree_id: data.tree_id || null,
        date: data.date || null,
        easting: data.easting || null,
        northing: data.northing || null,
        species: data.species || null,
        tree_height: data.tree_height || null,
        dbh: data.dbh || null,
        crown_height: data.crown_height || null,
        crown_radius: data.crown_radius || null,
        crown_completeness: data.crown_completeness || null,
        tags: data.tags || null
    };
};

/**
 * Validates a tree object against the schema
 * @param {Object} tree - The tree object to validate
 * @returns {Object} - { valid: boolean, errors: Array<string> }
 */
export const validateTree = (tree) => {
    const errors = [];

    // Validate required fields
    if (!tree.tree_id || typeof tree.tree_id !== 'string' || !tree.tree_id.trim()) {
        errors.push('Tree ID is required and must be a non-empty string');
    }

    if (!tree.date || typeof tree.date !== 'string') {
        errors.push('Date is required and must be a string');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(tree.date)) {
        errors.push('Date must be in YYYY-MM-DD format');
    }

    if (typeof tree.easting !== 'number' || isNaN(tree.easting)) {
        errors.push('Easting must be a valid number');
    }

    if (typeof tree.northing !== 'number' || isNaN(tree.northing)) {
        errors.push('Northing must be a valid number');
    }

    if (!tree.species || typeof tree.species !== 'string' || !tree.species.trim()) {
        errors.push('Species is required and must be a non-empty string');
    }

    if (typeof tree.tree_height !== 'number' || isNaN(tree.tree_height)) {
        errors.push('Tree height must be a valid number');
    } else if (tree.tree_height <= 0) {
        errors.push('Tree height must be greater than 0');
    }

    // Validate optional numeric fields
    if (tree.dbh !== null && tree.dbh !== undefined) {
        if (typeof tree.dbh !== 'number' || isNaN(tree.dbh)) {
            errors.push('DBH must be a valid number or null');
        } else if (tree.dbh < 0) {
            errors.push('DBH must be non-negative');
        }
    }

    if (tree.crown_height !== null && tree.crown_height !== undefined) {
        if (typeof tree.crown_height !== 'number' || isNaN(tree.crown_height)) {
            errors.push('Crown height must be a valid number or null');
        } else if (tree.crown_height < 0) {
            errors.push('Crown height must be non-negative');
        }
    }

    if (tree.crown_radius !== null && tree.crown_radius !== undefined) {
        if (typeof tree.crown_radius !== 'number' || isNaN(tree.crown_radius)) {
            errors.push('Crown radius must be a valid number or null');
        } else if (tree.crown_radius < 0) {
            errors.push('Crown radius must be non-negative');
        }
    }

    if (tree.crown_completeness !== null && tree.crown_completeness !== undefined) {
        if (typeof tree.crown_completeness !== 'number' || isNaN(tree.crown_completeness)) {
            errors.push('Crown completeness must be a valid number or null');
        } else if (tree.crown_completeness < 0 || tree.crown_completeness > 1) {
            errors.push('Crown completeness must be between 0 and 1');
        }
    }

    // Validate tags (optional string)
    if (tree.tags !== null && tree.tags !== undefined && typeof tree.tags !== 'string') {
        errors.push('Tags must be a string or null');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Sanitizes a tree object by trimming strings and ensuring proper types
 */
export const sanitizeTree = (tree) => {
    const sanitized = { ...tree };

    // Trim string fields
    if (sanitized.tree_id) sanitized.tree_id = sanitized.tree_id.trim();
    if (sanitized.species) sanitized.species = sanitized.species.trim();
    if (sanitized.tags) sanitized.tags = sanitized.tags.trim();
    if (sanitized.date) sanitized.date = sanitized.date.trim();

    // Ensure null for empty optional fields
    if (sanitized.dbh === '' || sanitized.dbh === undefined) sanitized.dbh = null;
    if (sanitized.crown_height === '' || sanitized.crown_height === undefined) sanitized.crown_height = null;
    if (sanitized.crown_radius === '' || sanitized.crown_radius === undefined) sanitized.crown_radius = null;
    if (sanitized.crown_completeness === '' || sanitized.crown_completeness === undefined) sanitized.crown_completeness = null;
    if (sanitized.tags === '' || sanitized.tags === undefined) sanitized.tags = null;

    return sanitized;
};

/**
 * Formats a tree object for display
 */
export const formatTreeForDisplay = (tree) => {
    return {
        ...tree,
        dbh: tree.dbh ? `${tree.dbh} cm` : 'N/A',
        tree_height: `${tree.tree_height} m`,
        crown_height: tree.crown_height ? `${tree.crown_height} m` : 'N/A',
        crown_radius: tree.crown_radius ? `${tree.crown_radius} m` : 'N/A',
        crown_completeness: tree.crown_completeness !== null ? `${(tree.crown_completeness * 100).toFixed(0)}%` : 'N/A',
        coordinates: `N: ${tree.northing.toFixed(6)}, E: ${tree.easting.toFixed(6)}`
    };
};

export default {
    TreeSchema,
    createTree,
    validateTree,
    sanitizeTree,
    formatTreeForDisplay
};
