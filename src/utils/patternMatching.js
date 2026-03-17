import munkres from 'munkres-js';

// Constants
const SIGMA_POSITION = 2.0;    // meters
const SIGMA_DBH = 0.01;        // meters (equivalent to 1cm) 
const P_WRONG_SPECIES = 0.05;

// Helper: Calculate distance in meters between two lat/lng coordinates (Haversine formula).
export const calculateDistance = (loc1, loc2) => {
  if (!loc1 || !loc2 || !loc1.latitude || !loc2.latitude) return 100000;
  const R = 6371000; // Radius of Earth in meters
  const lat1 = loc1.latitude * Math.PI / 180;
  const lat2 = loc2.latitude * Math.PI / 180;
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Log-probability for 2D Gaussian (position)
const logGaussian2D = (x, y, mu_x, mu_y, sigma) => {
  return -Math.log(2 * Math.PI * sigma ** 2) - ((x - mu_x) ** 2 + (y - mu_y) ** 2) / (2 * sigma ** 2);
};

// Log-probability for 1D Gaussian (DBH)
const logGaussian1D = (x, mu, sigma) => {
  return -Math.log(Math.sqrt(2 * Math.PI) * sigma) - ((x - mu) ** 2) / (2 * sigma ** 2);
};

// Log-probability for species match
const logSpeciesProb = (obs_species, db_species, p_wrong) => {
  if (!obs_species || !db_species) return Math.log(p_wrong); // fallback
  if (obs_species.toLowerCase() === db_species.toLowerCase()) {
    return Math.log(1 - p_wrong);
  } else {
    return Math.log(p_wrong);
  }
};

/**
 * Converts a lat/lng offset roughly to meters for small distances.
 */
const latLngToMetersOffset = (lat1, lon1, lat2, lon2) => {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dx = (lon2 - lon1) * 111320 * Math.cos(midLat);
  const dy = (lat2 - lat1) * 111320;
  return { dx, dy };
};

/**
 * Converts a meter offset back to lat/lng roughly.
 */
const metersOffsetToLatLng = (lat, dx, dy) => {
  const dLat = dy / 111320;
  const dLon = dx / (111320 * Math.cos(lat * Math.PI / 180));
  return { dLat, dLon };
};

/**
 * Finds the best match for the observed trees in the database.
 * @param {Array} observations Array of { latitude, longitude, species, dbh }
 * @param {Array} dbTrees Array of tree objects from the database
 */
export const findPatternMatch = (observations, dbTrees) => {
  if (!observations || observations.length === 0) return null;
  if (!dbTrees || dbTrees.length < observations.length) return null;

  const validDbTrees = dbTrees.filter(t => t.northing !== undefined && t.easting !== undefined);
  if (validDbTrees.length < observations.length) return null;

  let bestGlobalResult = null;
  let minGlobalCost = Infinity;

  // Since GPS might have drift, we evaluate potential "shifts".
  // A simple heuristic: try anchoring the first observation to each tree.
  for (let anchorIdx = 0; anchorIdx < validDbTrees.length; anchorIdx++) {
    const anchorDbTree = validDbTrees[anchorIdx];
    
    // Assume observations[0] matches anchorDbTree
    const latDrift = anchorDbTree.northing - observations[0].latitude;
    const lonDrift = anchorDbTree.easting - observations[0].longitude;

    // Apply drift to all observations so they overlay on the DB
    const shiftedObservations = observations.map(obs => {
      return {
        ...obs,
        shiftedLat: obs.latitude + latDrift,
        shiftedLon: obs.longitude + lonDrift,
      };
    });

    // Build the cost matrix
    // rows: shiftedObservations, cols: validDbTrees
    const costMatrix = [];
    for (let i = 0; i < shiftedObservations.length; i++) {
        const obs = shiftedObservations[i];
        const row = [];
        
        for (let j = 0; j < validDbTrees.length; j++) {
            const dbTree = validDbTrees[j];

            // Calculate offset of obs vs dbTree in meters directly
            const offsetMeters = latLngToMetersOffset(
                obs.shiftedLat, obs.shiftedLon,
                dbTree.northing, dbTree.easting
            );

            // Cost components
            const ll_pos = logGaussian2D(0, 0, offsetMeters.dx, offsetMeters.dy, SIGMA_POSITION);
            
            // DBH check (some DB trees might not have DBH, so handle null)
            const obsDbhMeters = (obs.dbh || 0) / 100; // convert cm to m
            const dbDbhMeters = (dbTree.dbh || 0) / 100; 
            const ll_dbh = dbTree.dbh ? logGaussian1D(obsDbhMeters, dbDbhMeters, SIGMA_DBH) : logGaussian1D(obsDbhMeters, 0.2, 0.5); // fallback if no DB DBH

            // Species check
            const ll_species = logSpeciesProb(obs.species, dbTree.species, P_WRONG_SPECIES);

            const totalLogLikelihood = ll_pos + ll_dbh + ll_species;
            
            // Munkres minimizes cost, so we negate log likelihood
            // We cap the cost to prevent infinity breaking the solver
            let cost = -totalLogLikelihood;
            if (cost > 1000000) cost = 1000000;
            if (isNaN(cost)) cost = 1000000;

            row.push(cost);
        }
        costMatrix.push(row);
    }

    // Run Hungarian algorithm to find optimal assignment for this anchor
    try {
        // Deep copy cost matrix since Munkres modifies it
        const matrixCopy = costMatrix.map(row => [...row]);
        const indices = munkres(matrixCopy);
        
        let totalCost = 0;
        const matches = [];

        indices.forEach(([obsIndex, dbIndex]) => {
            totalCost += costMatrix[obsIndex][dbIndex];
            matches.push({
                observationIndex: obsIndex,
                dbTree: validDbTrees[dbIndex],
                cost: costMatrix[obsIndex][dbIndex],
                observedData: observations[obsIndex]
            });
        });

        if (totalCost < minGlobalCost) {
            minGlobalCost = totalCost;
            bestGlobalResult = matches;
        }
    } catch (err) {
        console.error("Munkres error: ", err);
    }
  }

  // Sort matches by observation index so they tie back 1:1
  if (bestGlobalResult) {
    bestGlobalResult.sort((a, b) => a.observationIndex - b.observationIndex);
  }

  return bestGlobalResult;
};
