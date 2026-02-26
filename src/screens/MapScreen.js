import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrees } from '../database/db';

const TILE_BASE = FileSystem.documentDirectory + 'tiles/'; // base path for locally cached tiles
const FORESTRY_ACCURACY_THRESHOLD = 20;

const calculateDistance = (loc1, loc2) => {
  const R = 6371000;
  const lat1 = loc1.latitude * Math.PI / 180;
  const lat2 = loc2.latitude * Math.PI / 180;
  const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Build tile index by scanning the tile directory tree.
// Returns { "z/x/y": "file:///full/path/z/x/y.png" }
// Paths are kept in RN memory so we can read them on demand.
// Only presence flags { "z/x/y": true } are sent to the WebView (tiny payload).
const buildTileIndex = async () => {
  const index = {};
  try {
    const zoomDirs = await FileSystem.readDirectoryAsync(TILE_BASE); // returns [] if TILE_BASE doesn't exist, so we catch that separately to avoid noisy logs
    for (const z of zoomDirs) { // zoom level directories
      try {
        const xDirs = await FileSystem.readDirectoryAsync(`${TILE_BASE}${z}/`); // x coordinate directories
        for (const x of xDirs) {
          try {
            const yFiles = await FileSystem.readDirectoryAsync(`${TILE_BASE}${z}/${x}/`); // y coordinate files
            for (const yFile of yFiles) { 
              if (!yFile.endsWith('.png')) continue; // ignore any non-png files just in case
              const y = yFile.replace('.png', '');
              index[`${z}/${x}/${y}`] = `${TILE_BASE}${z}/${x}/${yFile}`; // store full path for later reading, but only send presence to WebView
            } 
          } catch { /* not a directory */ }
        }
      } catch { /* not a directory */ }
    }
  } catch {
    // tiles folder doesn't exist yet — network will be used
  }
  console.log(`Tile index built: ${Object.keys(index).length} tiles`); // log count for debugging, but avoid printing the whole index which can be huge
  return index;
};

// Defined outside component so the require() call is stable and never changes.
// This prevents the WebView from thinking its source changed and reloading.
const MAP_SOURCE = require('../../assets/leaflet-map.html');

const MapScreen = ({ navigation, route }) => { 
  const [trees, setTrees] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [tileIndex, setTileIndex] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null); // crucial for offline location (GPS CHIP)
  const [isOnline, setIsOnline] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(null);

  const webViewRef = useRef(null);
  const fabScale = useRef(new Animated.Value(0)).current;
  const locationIntervalRef = useRef(null);

  // Refs that mirror state — lets focus/message callbacks always read the
  // latest value without needing to be re-registered (avoids stale closures).
  const mapReadyRef = useRef(false);
  const tileIndexRef = useRef(null); // store tile index in a ref so we can read it in the WebView message handler
  const treesRef = useRef([]);
  const userLocationRef = useRef(null);
  const pendingGoTo = useRef(null);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const sendToMap = useCallback((type, data = {}) => { // send messages to the WebView with a consistent format
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type, ...data })); 
    }
  }, []);

  const sendTileIndex = useCallback((index) => { // send tile index presence flags to the WebView so it knows which tiles we have cached locally.
  //  The WebView will request tiles by key when it needs them, and we'll read from disk and respond with the data URI.
    if (!webViewRef.current || !index) return;
    const presenceFlags = {};
    Object.keys(index).forEach(k => { presenceFlags[k] = true; });
    webViewRef.current.postMessage(JSON.stringify({
      type: 'setTileIndex',
      index: presenceFlags,
    }));
  }, []);

  const getActiveTreeId = useCallback((location, treeList) => {
    if (!location || !treeList || treeList.length === 0) return null;
    let minDist = Infinity;
    let activeId = null;
    treeList.forEach(tree => {
      if (tree.northing && tree.easting) {
        const dist = calculateDistance(location, { latitude: tree.northing, longitude: tree.easting });
        if (dist < 10 && dist < minDist) { minDist = dist; activeId = tree.tree_id; }
      }
    });
    return activeId;
  }, []);

  // ─── Initial mount ────────────────────────────────────────────────────────
  useEffect(() => {
    buildTileIndex().then(index => {
      setTileIndex(index);
      tileIndexRef.current = index;
    });
    checkConnectivity();
    requestLocationPermission();
    loadTrees();
    Animated.spring(fabScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    return () => {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    };
  }, []);

  // ─── Keep refs in sync with state ────────────────────────────────────────
  useEffect(() => { mapReadyRef.current = mapReady; }, [mapReady]);
  useEffect(() => { tileIndexRef.current = tileIndex; }, [tileIndex]);
  useEffect(() => { treesRef.current = trees; }, [trees]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  // ─── Send tile index once map is ready and index is available ────────────
  useEffect(() => {
    if (!mapReady || !tileIndex) return;
    sendTileIndex(tileIndex);
  }, [mapReady, tileIndex, sendTileIndex]);

  // ─── Send trees when map becomes ready ───────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    sendToMap('addTreeMarkers', {
      trees,
      activeTreeId: getActiveTreeId(userLocationRef.current, trees),
    });
  }, [mapReady, trees, sendToMap, getActiveTreeId]);

  // ─── Send user location when it changes ──────────────────────────────────
  useEffect(() => {
    if (!mapReady || !userLocation) return;
    sendToMap('setUserLocation', { // send user location to WebView so it can show the blue dot, only send when map is ready.
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    });
  }, [mapReady, userLocation, sendToMap]);

  // ─── Focus listener — uses refs so callbacks never have stale closures ───
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrees();
      checkConnectivity();

      // Handle goTo params from RegionDownload "View on Map"
      const params = route.params || {};
      if (params.goToLat != null && params.goToLng != null) {
        const goTo = {
          lat: params.goToLat,
          lng: params.goToLng,
          zoom: params.goToZoom || 14,
        };
        // Clear params so a subsequent focus doesn't repeat the jump
        navigation.setParams({ goToLat: null, goToLng: null, goToZoom: null });

        if (mapReadyRef.current) {
          // WebView is alive (detachPreviousScreen:false kept it mounted) — fire now
          sendToMap('goToLocation', {
            latitude: goTo.lat,
            longitude: goTo.lng,
            zoom: goTo.zoom,
          });
        } else {
          // WebView not ready yet — store and fire from the mapReady handler
          pendingGoTo.current = goTo;
        }
      }

      // Rebuild tile index — user may have downloaded new regions while away.
      buildTileIndex().then(index => {
        setTileIndex(index);
        tileIndexRef.current = index;
        if (mapReadyRef.current) sendTileIndex(index);
      });
    });
    return unsubscribe;
    // Intentionally minimal deps — refs handle current values internally.
  }, [navigation, sendToMap, sendTileIndex]);

  // ─── Data & location ─────────────────────────────────────────────────────

  const checkConnectivity = async () => {
    try {
      // Check if the device is online and has internet access
      const networkState = await Network.getNetworkStateAsync();
      setIsOnline(networkState.isConnected && networkState.isInternetReachable);
    } catch {
      setIsOnline(false); // Assume offline if there's an error
    }
  };

  const fetchLocation = async () => {
    try {
      // Get the current location with high accuracy (polling every 2s for demo purposes)
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // OS will implement best possible accuracy strategy based on device capabilities and conditions.
      });
      updateLocation(location); // Update state with the new location
    } catch {
      // Fail silently if location fetch fails
    }
  };

  const requestLocationPermission = async () => {
    try {
      // Request permission to access location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app');
        setLoading(false); // Stop loading if permission is denied
        return;
      }

      // Check if the device is online
      const networkState = await Network.getNetworkStateAsync();
      const online = networkState.isConnected && networkState.isInternetReachable;
      setIsOnline(online);

      if (!online) {
        try {
          // Get the last known location if offline (up to 30s old, with loose accuracy to show location marker )
          const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: 30000,
            requiredAccuracy: 15,
          });
          if (lastKnown) updateLocation(lastKnown); // Use last known location if available
        } catch {
          // No last known location available
        }
      }

      await fetchLocation(); // Fetch the current location
      setLoading(false); // Stop loading after fetching location
      locationIntervalRef.current = setInterval(fetchLocation, 2000); // Poll location every 2s FOR DEMO. In production, watchPositionAsync will be used in Production
    } catch (error) {
      console.error('Location error:', error);
      setLoading(false); // Stop loading on error
    }
  };

  const updateLocation = (location) => {
    // Update location state and round accuracy to nearest meter
    const { latitude, longitude, accuracy } = location.coords;
    setLocationAccuracy(Math.round(accuracy));
    setUserLocation(prev => {
      // Only update if the new location is significantly different
      if (prev &&
        Math.abs(prev.latitude - latitude) < 0.00001 &&
        Math.abs(prev.longitude - longitude) < 0.00001) return prev;
      return { latitude, longitude };
    });
  };

  const loadTrees = async () => {
    try {
      const allTrees = await getAllTrees();
      setTrees(allTrees);
    } catch (error) {
      console.error('Error loading trees:', error);
      Alert.alert('Error', 'Failed to load trees from database');
    }
  };

  // ─── WebView message handler ──────────────────────────────────────────────
  const handleWebViewMessage = (event) => { // handle messages from the WebView
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case 'mapReady': // initial message from WebView when its JS is ready to receive data
          // WebView is ready
          setMapReady(true);
          mapReadyRef.current = true;

          if (tileIndexRef.current) sendTileIndex(tileIndexRef.current);
          if (treesRef.current.length > 0) {
            sendToMap('addTreeMarkers', { // send trees to WebView so it can add markers, only send when map is ready.
              trees: treesRef.current,
              activeTreeId: getActiveTreeId(userLocationRef.current, treesRef.current),
            });
          }
          if (userLocationRef.current) {
            sendToMap('setUserLocation', { // send user location to WebView so it can show the blue dot, only send when map is ready.
              latitude: userLocationRef.current.latitude,
              longitude: userLocationRef.current.longitude,
            });
          }
          if (pendingGoTo.current) {
            sendToMap('goToLocation', { 
              latitude: pendingGoTo.current.lat,
              longitude: pendingGoTo.current.lng,
              zoom: pendingGoTo.current.zoom,
            });
            pendingGoTo.current = null;
          }
          break;

        case 'mapPress': 
          // User tapped on the map; update selected coordinates
          setSelectedCoords({ latitude: data.latitude, longitude: data.longitude });
          break;

        case 'treePress':
          // User tapped on a tree marker; navigate to tree details
          navigation.navigate('TreeDetail', { treeId: data.treeId });
          break;

        case 'connectivity':
          // Update offline/online status
          setIsOffline(data.isOffline);
          break;

        case 'tileIndexReceived':
          // WebView acknowledges cached tiles
          console.log(`WebView has ${data.count} cached tiles ready`);
          break;

        case 'tileRequest':
          // WebView requests a specific tile; respond with base64 data URI
          (async () => {
            try {
              const filePath = tileIndexRef.current ? tileIndexRef.current[data.key] : null;
              if (!filePath) {
                webViewRef.current?.postMessage(JSON.stringify({
                  type: 'tileResponse',
                  requestId: data.requestId,
                  error: 'not_found',
                }));
                return;
              }
              const base64 = await FileSystem.readAsStringAsync(filePath, {
                encoding: FileSystem.EncodingType.Base64,
              });
              webViewRef.current?.postMessage(JSON.stringify({
                type: 'tileResponse',
                requestId: data.requestId,
                dataUri: `data:image/png;base64,${base64}`,
              }));
            } catch {
              webViewRef.current?.postMessage(JSON.stringify({
                type: 'tileResponse',
                requestId: data.requestId,
                error: 'read_error',
              }));
            }
          })();
          break;

        case 'zoomLevel':
          // Update zoom level
          setZoomLevel(data.zoom);
          break;

        default:
          // Ignore unknown message types
          break;
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  // ─── UI handlers ─────────────────────────────────────────────────────────

  const handleAddTree = () => {
    if (!selectedCoords) {
      Alert.alert('No Location Selected', 'Tap on the map or use Confirm Location to select a spot');
      return;
    }
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
        zoom: 13,
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
    if (locationAccuracy <= 5) return '#00D9A5';
    if (locationAccuracy <= 20) return '#FFA500';
    return '#FF6B6B';
  };

  const getZoomColor = () => {
    if (zoomLevel >= 10 && zoomLevel <= 18) return '#00D9A5';
    return '#FFA500';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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
        source={MAP_SOURCE}
        style={styles.map}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        mixedContentMode="always"
        onError={(e) => console.error('WebView error:', e.nativeEvent)}
      />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.statsCard}>
          <Ionicons name="leaf-outline" size={24} color="#000" />
          <Text style={styles.statsText}>{trees.length} Trees</Text>
        </View>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Accuracy badge */}
      {locationAccuracy && (
        <View style={[styles.accuracyBadge, { borderColor: getAccuracyColor() }]}>
          <Ionicons name="navigate-circle-outline" size={14} color={getAccuracyColor()} />
          <Text style={[styles.badgeText, { color: getAccuracyColor() }]}>
            ±{locationAccuracy}m{!isOnline ? ' · GPS only' : ''}
          </Text>
        </View>
      )}

      {/* Zoom badge */}
      {zoomLevel && (
        <View style={[styles.zoomBadge, { borderColor: getZoomColor() }]}>
          <Ionicons name="layers-outline" size={14} color={getZoomColor()} />
          <Text style={[styles.badgeText, { color: getZoomColor() }]}>
            z{zoomLevel}
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
      <TouchableOpacity style={styles.offlineMapsBtn} onPress={() => navigation.navigate('RegionDownload')}>
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

      {/* Fixed centre pin */}
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
  zoomBadge: { position: 'absolute', top: 148, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, gap: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  offlineBanner: { position: 'absolute', bottom: 85, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,107,0.95)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
  offlineText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  offlineMapsBtn: { position: 'absolute', bottom: 200, right: 20, backgroundColor: '#fff', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  recenterButton: { position: 'absolute', bottom: 130, right: 20, backgroundColor: '#fff', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  fabContainer: { position: 'absolute', bottom: 110, alignSelf: 'center' },
  fab: { backgroundColor: '#fff', height: 70, width: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10 },
  fabDisabled: { backgroundColor: 'rgba(255,255,255,0.5)' },
  tooltip: { position: 'absolute', bottom: 230, left: 20, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  tooltipText: { color: '#000', fontSize: 14, marginLeft: 8, fontWeight: '500' },
  centerPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  confirmButton: { position: 'absolute', bottom: 45, alignSelf: 'center', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  confirmButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  attribution: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  attributionText: { fontSize: 10, color: '#000' },
});

export default MapScreen;