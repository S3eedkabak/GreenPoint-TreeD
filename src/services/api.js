// API used to interact with the optional CLOUD BACKEND - DOCKER. GET AND PUBLISH TREE DATA 


const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = {
  // Get all trees from cloud
  async getAllTrees() {
    try {
      const response = await fetch(`${API_URL}/trees`);
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('API Error fetching trees:', error);
      throw error;
    }
  },

  // Create new tree in cloud
  async createTree(species, height, latitude, longitude) {
    try {
      const response = await fetch(`${API_URL}/trees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          species,
          height,
          latitude,
          longitude,
          device_id: 'mobile-app', // You can use device ID here
        }),
      });
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('API Error creating tree:', error);
      throw error;
    }
  },

  // Sync local trees to cloud
  async syncTrees(trees) {
    try {
      const response = await fetch(`${API_URL}/trees/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trees,
          device_id: 'mobile-app',
        }),
      });
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error('API Error syncing trees:', error);
      throw error;
    }
  },

  // Get statistics
  async getStats() {
    try {
      const response = await fetch(`${API_URL}/stats`);
      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('API Error fetching stats:', error);
      throw error;
    }
  },
};
