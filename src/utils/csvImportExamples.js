/**
 * Example: How to Use the CSV Parser and Import Functions
 * 
 * This file demonstrates the complete workflow for importing tree data from CSV files.
 */

import * as FileSystem from 'expo-file-system';
import { parseTreeCSV } from '../utils/csvParser';
import { validateTree, sanitizeTree } from '../models/Tree';
import { importTreesFromCSV } from '../database/db';

/**
 * Example 1: Basic CSV Import
 * Reads a CSV file and imports it into the database
 */
export const importCSVFile = async (fileUri) => {
    try {
        // Step 1: Read the CSV file
        const csvContent = await FileSystem.readAsStringAsync(fileUri);

        // Step 2: Parse the CSV
        const parseResults = parseTreeCSV(csvContent);

        console.log(`Parsed ${parseResults.trees.length} trees`);
        console.log(`Parsing errors: ${parseResults.errors.length}`);
        console.log(`Warnings: ${parseResults.warnings.length}`);

        // Step 3: Validate and sanitize trees
        const validTrees = [];
        const validationErrors = [];

        parseResults.trees.forEach((tree, index) => {
            const sanitized = sanitizeTree(tree);
            const validation = validateTree(sanitized);

            if (validation.valid) {
                validTrees.push(sanitized);
            } else {
                validationErrors.push({
                    tree_id: tree.tree_id,
                    errors: validation.errors
                });
            }
        });

        console.log(`${validTrees.length} trees passed validation`);

        // Step 4: Import into database
        const importResults = await importTreesFromCSV(validTrees);

        // Step 5: Return comprehensive results
        return {
            total: parseResults.trees.length,
            imported: importResults.success,
            duplicates: importResults.duplicates.length,
            parseErrors: parseResults.errors,
            validationErrors: validationErrors,
            importErrors: importResults.errors,
            warnings: parseResults.warnings
        };

    } catch (error) {
        console.error('Error importing CSV:', error);
        throw error;
    }
};

/**
 * Example 2: Import from String (for testing)
 */
export const importCSVFromString = async (csvString) => {
    const parseResults = parseTreeCSV(csvString);

    if (parseResults.errors.length > 0) {
        console.log('Parse errors:', parseResults.errors);
    }

    if (parseResults.trees.length === 0) {
        return { success: false, message: 'No valid trees found in CSV' };
    }

    const importResults = await importTreesFromCSV(parseResults.trees);

    return {
        success: true,
        imported: importResults.success,
        skipped: importResults.skipped,
        errors: importResults.errors
    };
};

/**
 * Example 3: Test with Sample Data
 */
export const testCSVImport = async () => {
    const sampleCSV = `Tree ID,Date,Easting,Northing,Species,DBH,Height,Crown height,Crown radius,Crown completeness,Tags
test-001,2024-01-15,-122.4194,37.7749,Oak,65.5,25.3,8.5,6.2,0.85,healthy
test-002,2024-01-16,-122.4195,37.7750,Pine,45.2,18.7,,,0.75,young
test-003,2024-01-17,-122.4196,37.7751,Maple,,15.5,5.2,4.1,0.68,`;

    const results = await importCSVFromString(sampleCSV);
    console.log('Test import results:', results);
    return results;
};

/**
 * Example 4: Handle Import with Detailed Error Reporting
 */
export const importWithDetailedReporting = async (fileUri) => {
    const csvContent = await FileSystem.readAsStringAsync(fileUri);
    const parseResults = parseTreeCSV(csvContent);

    // Create detailed report
    const report = {
        summary: {
            totalRows: parseResults.trees.length + parseResults.errors.length,
            successfullyParsed: parseResults.trees.length,
            parseErrors: parseResults.errors.length,
            warnings: parseResults.warnings.length
        },
        details: {
            parseErrors: parseResults.errors,
            warnings: parseResults.warnings
        }
    };

    // Import valid trees
    if (parseResults.trees.length > 0) {
        const importResults = await importTreesFromCSV(parseResults.trees);

        report.summary.imported = importResults.success;
        report.summary.duplicates = importResults.duplicates.length;
        report.summary.importErrors = importResults.errors.length;

        report.details.duplicates = importResults.duplicates;
        report.details.importErrors = importResults.errors;
    }

    return report;
};

/**
 * Example 5: Validate CSV Before Import (Preview Mode)
 */
export const validateCSVFile = async (fileUri) => {
    const csvContent = await FileSystem.readAsStringAsync(fileUri);
    const parseResults = parseTreeCSV(csvContent);

    return {
        valid: parseResults.errors.length === 0,
        treeCount: parseResults.trees.length,
        errors: parseResults.errors,
        warnings: parseResults.warnings,
        preview: parseResults.trees.slice(0, 5) // First 5 trees as preview
    };
};

export default {
    importCSVFile,
    importCSVFromString,
    testCSVImport,
    importWithDetailedReporting,
    validateCSVFile
};
