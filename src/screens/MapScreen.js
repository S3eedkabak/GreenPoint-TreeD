import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Animated, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrees } from '../database/db';

const MapScreen = ({ navigation }) => {
  const [trees, setTrees] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centerCoords, setCenterCoords] = useState(null); // State for center pinning
  const mapRef = useRef(null);
  const fabScale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    requestLocationPermission();
    loadTrees();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrees();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userCoords);
      setLoading(false);

      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...userCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } catch (error) {
      console.error('Location error:', error);
      setLoading(false);
    }
  };

  const loadTrees = async () => {
    try {
      const allTrees = await getAllTrees();
      setTrees(allTrees);
    } catch (error) {
      Alert.alert('Error', 'Failed to load trees from database');
    }
  };

  const handleMapPress = (event) => {
    const coords = event.nativeEvent.coordinate;
    setSelectedCoords(coords);
  };

  const handleAddTree = () => {
    if (!selectedCoords) {
      Alert.alert('No Location Selected', 'Please tap on the map to select a location first');
      return;
    }
    navigation.navigate('AddTree', {
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
    });
    setSelectedCoords(null);
  };

  const handleTreePress = (tree) => {
    navigation.navigate('TreeDetail', { treeId: tree.tree_id });
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleRegionChange = (region) => {
    setCenterCoords({
      latitude: region.latitude,
      longitude: region.longitude,
    });
  };

  const handleConfirmPin = () => {
    if (centerCoords) {
      Alert.alert(
        'Location Confirmed',
        `Latitude: ${centerCoords.latitude.toFixed(6)}, Longitude: ${centerCoords.longitude.toFixed(6)}`
      );
      setSelectedCoords(centerCoords); // Set the selected coordinates
    }
  };

  // Add utility function to calculate distance between two coordinates
  const calculateDistance = (coord1, coord2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const lat1 = toRad(coord1.latitude);
    const lat2 = toRad(coord2.latitude);
    const deltaLat = toRad(coord2.latitude - coord1.latitude);
    const deltaLon = toRad(coord2.longitude - coord1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Modify the trees rendering logic
  const filteredTrees = userLocation
    ? trees.filter(
        (tree) =>
        calculateDistance(userLocation, {
            latitude: tree.northing,
            longitude: tree.easting,
          }) < 500 // Show trees within 500 meters
      )
    : trees;

  const closestTree = userLocation
    ? filteredTrees.reduce((closest, tree) => {
        const distance = calculateDistance(userLocation, {
          latitude: tree.northing,
          longitude: tree.easting,
        });
        return distance < closest.distance
          ? { tree, distance }
          : closest;
      }, { tree: null, distance: Infinity }).tree
    : null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={userLocation ? {
          ...userLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : {
          latitude: 31.2357,
          longitude: 34.7818,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChange} // Track region changes
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={50}
              fillColor="rgba(0, 217, 165, 0.2)"
              strokeColor="rgba(0, 217, 165, 0.5)"
              strokeWidth={2}
            />
            <Marker coordinate={userLocation}>
              <Animated.View style={[styles.userMarker, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="person" size={20} color="#fff" />
              </Animated.View>
            </Marker>
          </>
        )}

        {filteredTrees.map((tree) => (
          <Marker
            key={tree.tree_id}
            coordinate={{
              latitude: tree.northing,
              longitude: tree.easting,
            }}
            onPress={() => handleTreePress(tree)}
          >
            <View
              style={{
                backgroundColor: tree.speciesColor || 'rgba(100, 100, 100, 0.5)', // Muted color palette
                width: tree.crownDiameter || 30, // Scale diameter
                height: tree.crownDiameter || 30,
                borderRadius: (tree.crownDiameter || 30) / 2,
                opacity: 0.5,
                borderWidth: closestTree?.tree_id === tree.tree_id ? 3 : 0, // Highlight closest tree
                borderColor: closestTree?.tree_id === tree.tree_id ? '#FFD700' : 'transparent',
              }}
            />
          </Marker>
        ))}

        {selectedCoords && (
          <Marker coordinate={selectedCoords}>
            <View style={styles.selectedMarker}>
              <Ionicons name="location" size={40} color="#FF6B6B" />
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.topBar}>
        <View style={styles.statsCard}>
          <Ionicons name="leaf-outline" size={24} color="#000" />
          <Text style={styles.statsText}>{trees.length} Trees</Text>
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.recenterButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#000" />
      </TouchableOpacity>

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={[styles.fab, !selectedCoords && styles.fabDisabled]}
          onPress={handleAddTree}
          disabled={!selectedCoords}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="#000" />
        </TouchableOpacity>
      </Animated.View>

      {!selectedCoords && (
        <View style={styles.tooltip}>
          <Ionicons name="hand-left-outline" size={20} color="#000" />
          <Text style={styles.tooltipText}>Tap on map to select location</Text>
        </View>
      )}

      {/* Fixed pin at the center */}
      <View style={styles.centerPin}>
        <Ionicons name="location" size={40} color="#FF6B6B" />
      </View>

      {/* Confirm button */}
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPin}>
        <Text style={styles.confirmButtonText}>Confirm Location</Text>
      </TouchableOpacity>

      {/* OpenStreetMap Attribution (legally required) */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  statsText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  menuButton: {
    backgroundColor: 'rgb(255, 255, 255)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 120,
    right: 50, // Shifted slightly more to the left
    backgroundColor: '#ffffff',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 110, // Move the Add Tree button higher
    alignSelf: 'center',
  },
  fab: {
    backgroundColor: '#ffffff',
    height: 70, // Increased height
    width: 70, // Keep width the same for now
    borderRadius: 35, // Keep circular shape
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  fabDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Transparent white
    shadowColor: '#000',
  },
  tooltip: {
    position: 'absolute',
    bottom: 200, // Raised higher
    left: 20,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  tooltipText: {
    color: '#000',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  userMarker: {
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  treeMarker: {
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4CAF50',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  selectedMarker: {
    alignItems: 'center',
  },
  attribution: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  attributionText: {
    fontSize: 10,
    color: '#000',
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20, // Half the width of the pin icon
    marginTop: -40, // Half the height of the pin icon
  },
  confirmButton: {
    position: 'absolute',
    bottom: 45, // Raised higher by 10
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  confirmButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MapScreen;
