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
import { Ionicons } from '@expo/vector-icons';
import { getAllTrees } from '../database/db';

const TILE_BASE = FileSystem.documentDirectory + 'tiles/';

const MapScreen = ({ navigation }) => {
  const [trees, setTrees] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const webViewRef = useRef(null);
  const fabScale = useRef(new Animated.Value(0)).current;

  const mapSource = require('../../assets/leaflet-map.html');

  useEffect(() => {
    requestLocationPermission();
    loadTrees();

    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTrees();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!mapReady) return;
    // Tell the WebView where local tiles are stored
    sendToMap('setLocalTileBase', { path: TILE_BASE });
    if (userLocation) {
      sendToMap('setUserLocation', {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
    }
    sendToMap('addTreeMarkers', { trees });
  }, [mapReady, userLocation, trees]);

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

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setLoading(false);
    } catch (error) {
      console.error('Location error:', error);
      setLoading(false);
    }
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