import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrees } from '../database/db';

const TILE_BASE = FileSystem.documentDirectory + 'tiles/';
const FORESTRY_ACCURACY_THRESHOLD = 20;

const MapScreen = ({ navigation }) => {
  const [trees, setTrees] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const webViewRef = useRef(null);
  const fabScale = useRef(new Animated.Value(0)).current;
  const locationIntervalRef = useRef(null); // polling for simulator demo

  const mapSource = require('../../assets/leaflet-map.html');

  useEffect(() => {
    checkConnectivity();
    requestLocationPermission();
    loadTrees();

    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrees();
      checkConnectivity();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!mapReady) return;
    sendToMap('setLocalTileBase', { path: TILE_BASE });
    if (userLocation) {
      sendToMap('setUserLocation', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    }
    sendToMap('addTreeMarkers', { trees });
  }, [mapReady, userLocation, trees]);

  const checkConnectivity = async () => {
    try {
      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected && networkState.isInternetReachable);
    } catch {
      setIsOnline(false);
    }
  };

  // Polling fetch — works on simulator for demo
  // In production (MapScreenPROD.js) this is replaced with watchPositionAsync
  const fetchLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // fused location when online, GPS-only when offline — handled by OS
      });
      updateLocation(location);
    } catch {
      // silently fail on poll
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app');
        setLoading(false);
        return;
      }

      // Check connectivity to show correct accuracy mode in badge
      const networkState = await Network.getNetworkStateAsync();
      const online = networkState.isConnected && networkState.isInternetReachable;
      setIsOnline(online);

      // Show last known position immediately while GPS warms up (offline scenario)
      if (!online) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 30000,        // only use if less than 30 seconds old
            requiredAccuracy: 15, // only use if within 15m — matches forestry threshold
          });
          if (lastKnown) updateLocation(lastKnown);
        } catch {
          // no last known position available
        }
      }

      // Get initial position
      await fetchLocation();
      setLoading(false);

      // Poll every 2 seconds — keeps simulator location changes working for demo
      // Production uses watchPositionAsync instead (see MapScreenPROD.js)
      locationIntervalRef.current = setInterval(fetchLocation, 2000);
    } catch (error) {
      console.error('Location error:', error);
      setLoading(false);
    }
  };

  const updateLocation = (location) => {
    const { latitude, longitude, accuracy } = location.coords;
    setLocationAccuracy(Math.round(accuracy));
    setUserLocation(prev => {
      if (
        prev &&
        Math.abs(prev.latitude - latitude) < 0.00001 &&
        Math.abs(prev.longitude - longitude) < 0.00001
      ) {
        return prev;
      }
      return { latitude, longitude };
    });
  };

  const loadTrees = async () => {
    try {
      const allTrees = await getAllTrees();
      console.log('Total trees loaded:', allTrees.length);
      setTrees(allTrees);
    } catch (error) {
      console.error('Error loading trees:', error);
      Alert.alert('Error', 'Failed to load trees from database');
    }
  };

  const sendToMap = (type, data = {}) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ type, ...data });
      webViewRef.current.postMessage(message);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'mapReady':
          setMapReady(true);
          break;
        case 'mapPress':
          setSelectedCoords({ latitude: data.latitude, longitude: data.longitude });
          break;
        case 'treePress':
          navigation.navigate('TreeDetail', { treeId: data.treeId });
          break;
        case 'connectivity':
          setIsOffline(data.isOffline);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  const handleAddTree = () => {
    if (!selectedCoords) {
      Alert.alert('No Location Selected', 'Tap on the map or use Confirm Location to select a spot');
      return;
    }

    // Warn forester if GPS accuracy is poor before logging a tree
    if (locationAccuracy && locationAccuracy > FORESTRY_ACCURACY_THRESHOLD) {
      Alert.alert(
        'Low GPS Accuracy',
        `Current accuracy is ~${locationAccuracy}m. For precise tree mapping, move to open sky and wait for a better fix.\n\nContinue anyway?`,
        [
          { text: 'Wait for better GPS', style: 'cancel' },
          { text: 'Continue', onPress: navigateToAddTree },
        ]
      );
      return;
    }

    navigateToAddTree();
  };

  const navigateToAddTree = () => {
    navigation.navigate('AddTree', {
      latitude: selectedCoords.latitude,
      longitude: selectedCoords.longitude,
    });
    setSelectedCoords(null);
    sendToMap('clearSelectedMarker');
  };

  const centerOnUser = () => {
    if (userLocation) {
      sendToMap('centerOnLocation', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    }
  };

  const handleConfirmPin = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          const center = map.getCenter();
          sendMessage({ type: 'mapPress', latitude: center.lat, longitude: center.lng });
        })();
        true;
      `);
    }
  };

  const getAccuracyColor = () => {
    if (!locationAccuracy) return '#999';
    if (locationAccuracy <= 5) return '#00D9A5';   // excellent
    if (locationAccuracy <= 20) return '#FFA500';  // acceptable for forestry
    return '#FF6B6B';                               // poor
  };

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
      <WebView
        ref={webViewRef}
        source={mapSource}
        style={styles.map}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        onError={(e) => console.error('WebView error:', e.nativeEvent)}
      />

      {/* Top bar */}
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

      {/* GPS accuracy badge */}
      {locationAccuracy && (
        <View style={[styles.accuracyBadge, { borderColor: getAccuracyColor() }]}>
          <Ionicons name="navigate-circle-outline" size={14} color={getAccuracyColor()} />
          <Text style={[styles.accuracyText, { color: getAccuracyColor() }]}>
            ±{locationAccuracy}m{!isOnline ? ' · GPS only' : ''}
          </Text>
        </View>
      )}

      {/* Offline banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
          <Text style={styles.offlineText}>Offline — Using Cached Map</Text>
        </View>
      )}

      {/* Offline maps button */}
      <TouchableOpacity
        style={styles.offlineMapsBtn}
        onPress={() => navigation.navigate('RegionDownload')}
      >
        <Ionicons name="map-outline" size={22} color="#000" />
      </TouchableOpacity>

      {/* Recenter button */}
      <TouchableOpacity style={styles.recenterButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color="#000" />
      </TouchableOpacity>

      {/* Add Tree FAB */}
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

      {/* Hint tooltip */}
      {!selectedCoords && (
        <View style={styles.tooltip}>
          <Ionicons name="hand-left-outline" size={20} color="#000" />
          <Text style={styles.tooltipText}>Tap map or use Confirm Location</Text>
        </View>
      )}

      {/* Fixed center pin */}
      <View pointerEvents="none" style={styles.centerPin}>
        <Ionicons name="location" size={40} color="#FF6B6B" />
      </View>

      {/* Confirm location button */}
      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPin}>
        <Text style={styles.confirmButtonText}>Confirm Location</Text>
      </TouchableOpacity>

      {/* OSM Attribution */}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#000', fontWeight: '600' },
  topBar: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(200,200,200,0.5)' },
  statsText: { color: '#000', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  menuButton: { backgroundColor: '#fff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(200,200,200,0.5)' },
  accuracyBadge: { position: 'absolute', top: 110, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, gap: 4 },
  accuracyText: { fontSize: 12, fontWeight: '600' },
  offlineBanner: { position: 'absolute', top: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  offlineText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  offlineMapsBtn: { position: 'absolute', bottom: 200, right: 20, backgroundColor: '#fff', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  recenterButton: { position: 'absolute', bottom: 130, right: 20, backgroundColor: '#fff', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  fabContainer: { position: 'absolute', bottom: 110, alignSelf: 'center' },
  fab: { backgroundColor: '#fff', height: 70, width: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10 },
  fabDisabled: { backgroundColor: 'rgba(255,255,255,0.5)' },
  tooltip: { position: 'absolute', bottom: 200, left: 20, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  tooltipText: { color: '#000', fontSize: 14, marginLeft: 8, fontWeight: '500' },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  confirmButton: { position: 'absolute', bottom: 45, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  confirmButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  attribution: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  attributionText: { fontSize: 10, color: '#000' },
});

export default MapScreen;