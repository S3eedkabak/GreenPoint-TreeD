const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Tree-D API Gateway',
    timestamp: new Date().toISOString(),
    database: 'connected',
  });
});

// Get all trees
app.get('/api/v1/trees', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trees ORDER BY created_at DESC'
    );
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching trees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trees',
      message: error.message,
    });
  }
});

// Get single tree by ID
app.get('/api/v1/trees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM trees WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found',
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tree',
    });
  }
});

// Create new tree
app.post('/api/v1/trees', async (req, res) => {
  try {
    const { species, height, latitude, longitude, device_id } = req.body;

    // Validation
    if (!species || !height || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: species, height, latitude, longitude',
      });
    }

    if (height <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Height must be greater than 0',
      });
    }

    const result = await pool.query(
      `INSERT INTO trees (species, height, latitude, longitude, device_id, synced_at, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
       RETURNING *`,
      [species, height, latitude, longitude, device_id || 'unknown']
    );

    console.log('✅ Tree created:', result.rows[0].id);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create tree',
      message: error.message,
    });
  }
});

// Bulk sync trees from device
app.post('/api/v1/trees/sync', async (req, res) => {
  try {
    const { trees, device_id } = req.body;

    if (!Array.isArray(trees) || trees.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or empty trees array',
      });
    }

    const insertedTrees = [];
    
    // Use transaction for bulk insert
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const tree of trees) {
        const result = await client.query(
          `INSERT INTO trees (species, height, latitude, longitude, device_id, synced_at, created_at) 
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
           RETURNING *`,
          [tree.species, tree.height, tree.latitude, tree.longitude, device_id || 'unknown']
        );
        insertedTrees.push(result.rows[0]);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Synced ${insertedTrees.length} trees from device: ${device_id}`);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({
      success: true,
      synced: insertedTrees.length,
      data: insertedTrees,
    });
  } catch (error) {
    console.error('Error syncing trees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync trees',
      message: error.message,
    });
  }
});

// Update tree
app.put('/api/v1/trees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { species, height, latitude, longitude } = req.body;

    const result = await pool.query(
      `UPDATE trees 
       SET species = $1, height = $2, latitude = $3, longitude = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING *`,
      [species, height, latitude, longitude, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update tree',
    });
  }
});

// Delete tree
app.delete('/api/v1/trees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM trees WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found',
      });
    }

    res.json({
      success: true,
      message: 'Tree deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete tree',
    });
  }
});

// Get statistics
app.get('/api/v1/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_trees,
        COUNT(DISTINCT species) as unique_species,
        ROUND(AVG(height)::numeric, 2) as average_height,
        MAX(height) as max_height,
        MIN(height) as min_height,
        COUNT(DISTINCT device_id) as total_devices
      FROM trees
    `);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

// Get trees by species
app.get('/api/v1/trees/species/:species', async (req, res) => {
  try {
    const { species } = req.params;
    const result = await pool.query(
      'SELECT * FROM trees WHERE LOWER(species) = LOWER($1) ORDER BY created_at DESC',
      [species]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching trees by species:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trees',
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Tree-D API Gateway`);
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🌳 Trees endpoint: http://localhost:${PORT}/api/v1/trees`);
  console.log(`📊 Stats endpoint: http://localhost:${PORT}/api/v1/stats\n`);
});
