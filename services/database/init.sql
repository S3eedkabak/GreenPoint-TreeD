-- Tree-D Cloud Database Schema

-- Create trees table
CREATE TABLE IF NOT EXISTS trees (
    id SERIAL PRIMARY KEY,
    species VARCHAR(255) NOT NULL,
    height DECIMAL(10, 2) NOT NULL CHECK (height > 0),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    device_id VARCHAR(255),
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trees_created_at ON trees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trees_device_id ON trees(device_id);
CREATE INDEX IF NOT EXISTS idx_trees_species ON trees(LOWER(species));
CREATE INDEX IF NOT EXISTS idx_trees_location ON trees(latitude, longitude);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trees_updated_at BEFORE UPDATE ON trees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO trees (species, height, latitude, longitude, device_id, synced_at) VALUES
('Oak', 25.5, 31.2357, 34.7818, 'seed-device', NOW()),
('Pine', 18.3, 31.2367, 34.7828, 'seed-device', NOW()),
('Eucalyptus', 30.2, 31.2377, 34.7838, 'seed-device', NOW()),
('Cedar', 22.7, 31.2387, 34.7848, 'seed-device', NOW()),
('Maple', 15.9, 31.2397, 34.7858, 'seed-device', NOW())
ON CONFLICT DO NOTHING;

-- Create view for statistics
CREATE OR REPLACE VIEW tree_statistics AS
SELECT
    COUNT(*) as total_trees,
    COUNT(DISTINCT species) as unique_species,
    ROUND(AVG(height)::numeric, 2) as average_height,
    MAX(height) as max_height,
    MIN(height) as min_height,
    COUNT(DISTINCT device_id) as total_devices,
    MAX(created_at) as last_updated
FROM trees;

-- Grant permissions (if needed for specific user)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO treed_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO treed_user;

COMMENT ON TABLE trees IS 'Main table for storing tree data synced from mobile devices';
COMMENT ON COLUMN trees.device_id IS 'Unique identifier for the device that uploaded the tree';
COMMENT ON COLUMN trees.synced_at IS 'Timestamp when the tree was synced to cloud';
