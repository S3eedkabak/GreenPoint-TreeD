import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

// ─── Tile math helpers ───────────────────────────────────────────────────────

const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom)); // converts longitude to tile X at a given zoom level
const lat2tile = (lat, zoom) => Math.floor(
  (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) // converts latitude to tile Y at a given zoom level
  / 2 * Math.pow(2, zoom)
);

const countTiles = (bbox, minZoom, maxZoom) => { // counts the total number of tiles in a bounding box across a range of zoom levels
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(bbox.west, z);
    const xMax = lon2tile(bbox.east, z);
    const yMin = lat2tile(bbox.north, z);
    const yMax = lat2tile(bbox.south, z);
    total += (xMax - xMin + 1) * (yMax - yMin + 1);
  }
  return total;
};

// ─── Download modes ───────────────────────────────────────────────────────────

const MODES = {
  navigation: {
    id: 'navigation',
    label: 'Navigation',
    icon: 'navigate-outline',
    description: 'Large areas for getting to the site. Good for regions, states, districts.',
    minZoom: 10,
    maxZoom: 13,
    tileLimit: 50000,
    color: '#00D9A5',
  },
  fieldwork: {
    id: 'fieldwork',
    label: 'Field Work',
    icon: 'leaf-outline',
    description: 'Small areas with high detail for precise tree marking on the ground.',
    minZoom: 14,
    maxZoom: 18,
    tileLimit: 20000,
    color: '#4CAF50',
  },
};

// ─── Nominatim geocoding ─────────────────────────────────────────────────────

const geocodeRegion = async (query) => { // uses OpenStreetMap's Nominatim API to search for a place and return its bounding box
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TreeDApp/1.0' } });
  const data = await res.json();
  return data.map(item => ({
    name: item.display_name,
    bbox: {
      south: parseFloat(item.boundingbox[0]),
      north: parseFloat(item.boundingbox[1]),
      west: parseFloat(item.boundingbox[2]),
      east: parseFloat(item.boundingbox[3]),
    },
  }));
};

// ─── Storage helpers ─────────────────────────────────────────────────────────

const REGIONS_FILE = () => FileSystem.documentDirectory + 'downloaded_regions.json'; // file to store metadata about downloaded regions
const TILE_BASE = () => FileSystem.documentDirectory + 'tiles/'; // base directory for storing downloaded tiles, organized by zoom/x/y.png
const tilePath = (z, x, y) => `${TILE_BASE()}${z}/${x}/${y}.png`; 

const loadRegions = async () => { // loads the list of downloaded regions from storage, returning an empty array if the file doesn't exist or can't be read
  try {
    const info = await FileSystem.getInfoAsync(REGIONS_FILE()); // check if the regions file exists
    if (!info.exists) return []; 
    const raw = await FileSystem.readAsStringAsync(REGIONS_FILE());
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const saveRegions = async (regions) => { // saves the list of downloaded regions to storage, overwriting any existing file
  await FileSystem.writeAsStringAsync(REGIONS_FILE(), JSON.stringify(regions));
};

// ─── Cache checker (uses region's own zoom range) ─────────────────────────────

const checkCachedTiles = async (region) => { // checks how many tiles for a given region are already downloaded and cached, by iterating through the expected tile coordinates and checking if the file exists
  const { bbox, minZoom, maxZoom } = region;
  let cached = 0;
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(bbox.west, z);
    const xMax = lon2tile(bbox.east, z);
    const yMin = lat2tile(bbox.north, z);
    const yMax = lat2tile(bbox.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        total++;
        const info = await FileSystem.getInfoAsync(tilePath(z, x, y));
        if (info.exists) cached++;
      }
    }
  }
  return { cached, total };
};

const TILE_URL = 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

// ─── Main component ───────────────────────────────────────────────────────────

const RegionDownloadScreen = ({ navigation }) => { 
  const [selectedMode, setSelectedMode] = useState('navigation');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tileCount, setTileCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [downloadedRegions, setDownloadedRegions] = useState([]);
  const [checkingRegion, setCheckingRegion] = useState(null);
  const cancelRef = useRef(false);

  const mode = MODES[selectedMode];

  useEffect(() => {
    loadRegions().then(setDownloadedRegions);
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      const count = countTiles(selectedRegion.bbox, mode.minZoom, mode.maxZoom);
      setTileCount(count);
    }
  }, [selectedRegion, selectedMode]);

  const handleSearch = async () => { // performs a search using the geocoding function, updating state with results and handling loading/error states
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    setSelectedRegion(null);
    try {
      const found = await geocodeRegion(query.trim()); // call the geocoding function with the user's query
      if (found.length === 0) Alert.alert('Not Found', 'No results found. Try a different search term.');
      setResults(found);
    } catch (e) {
      Alert.alert('Error', 'Could not search. Check your internet connection.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectResult = (item) => { // when a user selects a search result, set it as the selected region and calculate the tile count for that region
    setSelectedRegion(item);
    setResults([]);
    setQuery(item.name.split(',')[0]);
  };

  const estimateMB = (count) => ((count * 15) / 1024).toFixed(1); // rough estimate of MB size based on average OSM tile size (15 KB)

  const handleDownload = async () => { // before starting the download, check if the tile count exceeds the mode's limit and show a confirmation alert with details about the download
    if (!selectedRegion) return;
    if (tileCount > mode.tileLimit) {
      Alert.alert(
        'Region Too Large',
        selectedMode === 'navigation'
          ? `${tileCount.toLocaleString()} tiles is too large for Navigation mode. Try a smaller region.`
          : `${tileCount.toLocaleString()} tiles is too large for Field Work mode. Field Work is designed for small areas like a single forest block. Try zooming into a specific location.`
      );
      return;
    }
    Alert.alert(
      'Download Region',
      `Download "${selectedRegion.name.split(',')[0]}" (${mode.label})?\n\nZoom: ${mode.minZoom}–${mode.maxZoom}\nTiles: ~${tileCount.toLocaleString()}\nSize: ~${estimateMB(tileCount)} MB`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: startDownload },
      ]
    );
  };

  const startDownload = async () => {
  // Show the user that downloading has started
  setDownloading(true);
  setProgress(0);
  cancelRef.current = false;

  const { bbox } = selectedRegion; // Get the map area boundaries (north, south, east, west)
  const { minZoom, maxZoom } = mode; // Get the zoom range (e.g., zoom 10 to 13)

  let downloaded = 0;
  let failed = 0;
  const total = tileCount;

  try {
    // Create folders to store the tiles before we start downloading
    await FileSystem.makeDirectoryAsync(TILE_BASE(), { intermediates: true });

    // Loop through each zoom level (zoom 10, then 11, then 12, etc.)
    for (let z = minZoom; z <= maxZoom; z++) {
      if (cancelRef.current) break;

      // Convert the map boundaries into tile grid numbers for this zoom level
      const xMin = lon2tile(bbox.west, z);
      const xMax = lon2tile(bbox.east, z);
      const yMin = lat2tile(bbox.north, z);
      const yMax = lat2tile(bbox.south, z);

      // Loop through each column of tiles (left to right)
      for (let x = xMin; x <= xMax; x++) {
        if (cancelRef.current) break;

        // Create a folder for this column (e.g., /tiles/13/5123/)
        await FileSystem.makeDirectoryAsync(`${TILE_BASE()}${z}/${x}/`, { intermediates: true });

        // Loop through each tile in this column (top to bottom)
        for (let y = yMin; y <= yMax; y++) {
          if (cancelRef.current) break;

          const path = tilePath(z, x, y);
          const info = await FileSystem.getInfoAsync(path);

          // Only download if we don't already have this tile
          if (!info.exists) {
            const url = TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
            try {
              await FileSystem.downloadAsync(url, path);
            } catch {
              failed++; // If download fails, just keep count and move on
            }
          }

          downloaded++;
          setProgress(Math.round((downloaded / total) * 100));
          setProgressText(`Zoom ${z} — ${downloaded}/${total} tiles`);
        }
      }
    }

    // If the user didn't cancel, save the downloaded region to the list
    if (!cancelRef.current) {
      const regionData = {
        id: Date.now().toString(),
        name: selectedRegion.name.split(',')[0],
        fullName: selectedRegion.name,
        bbox: selectedRegion.bbox,
        minZoom,
        maxZoom,
        mode: mode.id,
        modeLabel: mode.label,
        tileCount: downloaded,
        downloadedAt: new Date().toISOString(),
        sizeMB: estimateMB(downloaded),
      };

      // Load existing regions, remove any duplicate, add the new one, and save
      const existing = await loadRegions();
      const updated = [...existing.filter(r => !(r.name === regionData.name && r.mode === regionData.mode)), regionData];
      await saveRegions(updated);
      setDownloadedRegions(updated);

      // Show success message
      Alert.alert(
        'Download Complete',
        `${regionData.name} (${mode.label}) downloaded!\n${downloaded.toLocaleString()} tiles, ~${regionData.sizeMB} MB${failed > 0 ? `\n(${failed} tiles failed)` : ''}`,
        [{ text: 'OK' }]
      );
    }
  } catch (e) {
    Alert.alert('Download Failed', e.message);
  } finally {
    // Clean up: turn off downloading mode and hide progress bar
    setDownloading(false);
    setProgress(0);
    setProgressText('');
  }
};

  const handleCancel = () => {
    cancelRef.current = true;
    setDownloading(false);
    setProgressText('Cancelling...');
  };

  const handleCheckCache = async (region) => { // checks how many tiles for a downloaded region are actually present in the cache
    setCheckingRegion(region.id);
    try {
      const { cached, total } = await checkCachedTiles(region);
      const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
      let status = '';
      if (cached === 0) status = '❌ No tiles found — try re-downloading';
      else if (cached >= total * 0.95) status = '✅ Fully cached and ready for offline use';
      else status = `⚠️ Partially cached — ${(total - cached).toLocaleString()} tiles missing`;

      Alert.alert(
        `${region.name} — Cache Status`,
        `${cached.toLocaleString()} of ${total.toLocaleString()} tiles cached (${pct}%)\n\n${status}`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not check cache: ' + e.message);
    } finally {
      setCheckingRegion(null);
    }
  };

  const handleDeleteRegion = (region) => {
    Alert.alert(
      'Delete Region',
      `Delete cached tiles for "${region.name}" (${region.modeLabel || 'Navigation'})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { // to delete a region, we need to iterate through all the tiles that belong to that region (based on its bounding box and zoom levels) and delete the corresponding files from storage, then remove the region from the saved list
              const { bbox, minZoom, maxZoom } = region;
              for (let z = minZoom; z <= maxZoom; z++) {
                const xMin = lon2tile(bbox.west, z);
                const xMax = lon2tile(bbox.east, z);
                const yMin = lat2tile(bbox.north, z);
                const yMax = lat2tile(bbox.south, z);
                for (let x = xMin; x <= xMax; x++) {
                  for (let y = yMin; y <= yMax; y++) {
                    const path = tilePath(z, x, y);
                    const info = await FileSystem.getInfoAsync(path);
                    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
                  }
                }
              }
              const updated = downloadedRegions.filter(r => r.id !== region.id);
              await saveRegions(updated);
              setDownloadedRegions(updated);
            } catch (e) {
              Alert.alert('Error', 'Could not delete all tiles.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

      {/* Mode selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Download Mode</Text>
        <View style={styles.modeRow}>
          {Object.values(MODES).map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeCard, selectedMode === m.id && { borderColor: m.color, backgroundColor: m.color + '10' }]}
              onPress={() => { setSelectedMode(m.id); setSelectedRegion(null); setResults([]); setQuery(''); }}
            >
              <Ionicons name={m.icon} size={24} color={selectedMode === m.id ? m.color : '#999'} />
              <Text style={[styles.modeLabel, selectedMode === m.id && { color: m.color }]}>{m.label}</Text>
              <Text style={styles.modeZoom}>Zoom {m.minZoom}–{m.maxZoom}</Text>
              <Text style={styles.modeDesc}>{m.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Region</Text>
        <Text style={styles.sectionSubtitle}>
          {selectedMode === 'navigation'
            ? 'Search for a region, state, or district to download for navigation.'
            : 'Search for a specific forest, village, or small area for precise field work.'}
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder={selectedMode === 'navigation' ? 'e.g. Saxony, Bavaria, Leipzig...' : 'e.g. Tharandter Wald, Grunewald...'}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: mode.color }]} onPress={handleSearch} disabled={searching}>
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="search" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {results.length > 0 && (
          <View style={styles.resultsList}>
            {results.map((item, index) => (
              <TouchableOpacity key={index} style={styles.resultItem} onPress={() => handleSelectResult(item)}>
                <Ionicons name="location-outline" size={18} color={mode.color} />
                <Text style={styles.resultText} numberOfLines={2}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Selected region */}
      {selectedRegion && !downloading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selected Region</Text>
          <View style={styles.regionCard}>
            <View style={[styles.modeBadge, { backgroundColor: mode.color + '20' }]}>
              <Ionicons name={mode.icon} size={14} color={mode.color} />
              <Text style={[styles.modeBadgeText, { color: mode.color }]}>{mode.label}</Text>
            </View>
            <Text style={styles.regionName}>{selectedRegion.name.split(',')[0]}</Text>
            <Text style={styles.regionMeta} numberOfLines={2}>{selectedRegion.name}</Text>
            <View style={styles.regionStats}>
              <View style={styles.stat}>
                <Ionicons name="layers-outline" size={16} color="#666" />
                <Text style={styles.statText}>Zoom {mode.minZoom}–{mode.maxZoom}</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="grid-outline" size={16} color="#666" />
                <Text style={styles.statText}>{tileCount.toLocaleString()} tiles</Text>
              </View>
              <View style={styles.stat}>
                <Ionicons name="save-outline" size={16} color="#666" />
                <Text style={styles.statText}>~{estimateMB(tileCount)} MB</Text>
              </View>
            </View>
            {tileCount > mode.tileLimit && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                <Text style={styles.warningText}>
                  {selectedMode === 'fieldwork'
                    ? 'Area too large for Field Work. Try a smaller forest block.'
                    : 'Region too large. Try a smaller region.'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: tileCount > mode.tileLimit ? '#ccc' : mode.color }]}
              onPress={handleDownload}
              disabled={tileCount > mode.tileLimit}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Download for Offline Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Download progress */}
      {downloading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Downloading...</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: mode.color }]} />
            </View>
            <Text style={[styles.progressPct, { color: mode.color }]}>{progress}%</Text>
            <Text style={styles.progressDetail}>{progressText}</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Downloaded regions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Downloaded Regions</Text>
        {downloadedRegions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>No regions downloaded yet</Text>
            <Text style={styles.emptySubtext}>Search for a region above to download it</Text>
          </View>
        ) : (
          downloadedRegions.map((region) => {
            const regionMode = MODES[region.mode] || MODES.navigation;
            return (
              <View key={region.id} style={styles.downloadedCard}>
                <View style={styles.downloadedInfo}>
                  <View style={styles.downloadedHeader}>
                    <Text style={styles.downloadedName}>{region.name}</Text>
                    <View style={[styles.modeBadgeSmall, { backgroundColor: regionMode.color + '20' }]}>
                      <Text style={[styles.modeBadgeSmallText, { color: regionMode.color }]}>{region.modeLabel || 'Navigation'}</Text>
                    </View>
                  </View>
                  <Text style={styles.downloadedMeta}>
                    Zoom {region.minZoom}–{region.maxZoom} · {region.tileCount?.toLocaleString()} tiles · {region.sizeMB} MB
                  </Text>
                  <Text style={styles.downloadedDate}>
                    {new Date(region.downloadedAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.downloadedActions}>
                  <TouchableOpacity
                    style={styles.checkBtn}
                    onPress={() => handleCheckCache(region)}
                    disabled={checkingRegion === region.id}
                  >
                    {checkingRegion === region.id
                      ? <ActivityIndicator size="small" color="#00D9A5" />
                      : <Ionicons name="checkmark-circle-outline" size={22} color="#00D9A5" />
                    }
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteRegion(region)}>
                    <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  section: { marginTop: 20, marginHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 18 },
  modeRow: { flexDirection: 'row', gap: 12 },
  modeCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 2, borderColor: '#eee' },
  modeLabel: { fontSize: 15, fontWeight: '700', color: '#999', marginTop: 8, marginBottom: 2 },
  modeZoom: { fontSize: 12, color: '#999', marginBottom: 6 },
  modeDesc: { fontSize: 11, color: '#bbb', lineHeight: 15 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8 },
  modeBadgeText: { fontSize: 12, fontWeight: '600' },
  modeBadgeSmall: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  modeBadgeSmallText: { fontSize: 11, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: '#eee', color: '#000' },
  searchBtn: { borderRadius: 12, width: 48, justifyContent: 'center', alignItems: 'center' },
  resultsList: { backgroundColor: '#fff', borderRadius: 12, marginTop: 8, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 10 },
  resultText: { flex: 1, fontSize: 14, color: '#000' },
  regionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eee' },
  regionName: { fontSize: 20, fontWeight: '700', color: '#000' },
  regionMeta: { fontSize: 12, color: '#999', marginTop: 2, marginBottom: 12 },
  regionStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#666' },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff5f5', padding: 10, borderRadius: 8, marginBottom: 12, gap: 8 },
  warningText: { flex: 1, fontSize: 13, color: '#FF6B6B' },
  downloadBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  downloadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  progressCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#eee', alignItems: 'center' },
  progressBarBg: { width: '100%', height: 12, backgroundColor: '#f0f0f0', borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', borderRadius: 6 },
  progressPct: { fontSize: 28, fontWeight: '800' },
  progressDetail: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  cancelBtn: { borderWidth: 1, borderColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  cancelBtnText: { color: '#FF6B6B', fontWeight: '600', fontSize: 15 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#bbb', marginTop: 4, textAlign: 'center' },
  downloadedCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  downloadedInfo: { flex: 1 },
  downloadedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  downloadedName: { fontSize: 16, fontWeight: '700', color: '#000' },
  downloadedMeta: { fontSize: 12, color: '#666', marginTop: 2 },
  downloadedDate: { fontSize: 11, color: '#bbb', marginTop: 2 },
  downloadedActions: { flexDirection: 'row', gap: 8 },
  checkBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
});

export default RegionDownloadScreen;