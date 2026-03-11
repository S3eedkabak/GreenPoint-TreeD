import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../utils/useTranslation';

const lon2tile = (lon, zoom) => Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
const lat2tile = (lat, zoom) => Math.floor(
  (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)
  / 2 * Math.pow(2, zoom)
);

const countTiles = (bbox, minZoom, maxZoom) => {
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    total += (lon2tile(bbox.east, z) - lon2tile(bbox.west, z) + 1) *
             (lat2tile(bbox.south, z) - lat2tile(bbox.north, z) + 1);
  }
  return total;
};

const MODES = {
  navigation: { id: 'navigation', icon: 'navigate-outline', minZoom: 10, maxZoom: 13, tileLimit: 50000, color: '#00D9A5' },
  fieldwork:  { id: 'fieldwork',  icon: 'leaf-outline',     minZoom: 14, maxZoom: 18, tileLimit: 20000, color: '#4CAF50' },
};

const geocodeRegion = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TreeDApp/1.0' } });
  const data = await res.json();
  return data.map(item => ({
    name: item.display_name,
    bbox: {
      south: parseFloat(item.boundingbox[0]),
      north: parseFloat(item.boundingbox[1]),
      west:  parseFloat(item.boundingbox[2]),
      east:  parseFloat(item.boundingbox[3]),
    },
  }));
};

const REGIONS_FILE = () => FileSystem.documentDirectory + 'downloaded_regions.json';
const TILE_BASE    = () => FileSystem.documentDirectory + 'tiles/';
const tilePath = (z, x, y) => `${TILE_BASE()}${z}/${x}/${y}.png`;

const loadRegions  = async () => { try { return JSON.parse(await FileSystem.readAsStringAsync(REGIONS_FILE())); } catch { return []; } };
const saveRegions  = async (r) => FileSystem.writeAsStringAsync(REGIONS_FILE(), JSON.stringify(r));

const checkCachedTiles = async (region, cancelSignal) => {
  const { bbox, minZoom, maxZoom } = region;
  let cached = 0, total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lon2tile(bbox.west, z), xMax = lon2tile(bbox.east, z);
    const yMin = lat2tile(bbox.north, z), yMax = lat2tile(bbox.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        if (cancelSignal?.cancelled) return null;
        total++;
        try { const info = await FileSystem.getInfoAsync(tilePath(z, x, y)); if (info.exists) cached++; } catch {}
      }
    }
  }
  return { cached, total };
};

const TILE_URL = 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

const RegionDownloadScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const [selectedMode, setSelectedMode]     = useState('navigation');
  const [query, setQuery]                   = useState('');
  const [results, setResults]               = useState([]);
  const [searching, setSearching]           = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [tileCount, setTileCount]           = useState(0);
  const [downloading, setDownloading]       = useState(false);
  const [progress, setProgress]             = useState(0);
  const [progressText, setProgressText]     = useState('');
  const [downloadedRegions, setDownloadedRegions] = useState([]);
  const [checkingRegion, setCheckingRegion] = useState(null);
  const cancelRef      = useRef(false);
  const checkCancelRef = useRef({ cancelled: false });

  const mode = MODES[selectedMode];

  // Derived translated labels — computed fresh every render so language changes apply
  const modeLabels = {
    navigation: { label: t('regionDownload.navigation'), desc: t('regionDownload.navigationDesc') },
    fieldwork:  { label: t('regionDownload.fieldWork'),  desc: t('regionDownload.fieldWorkDesc') },
  };

  useEffect(() => { loadRegions().then(setDownloadedRegions); }, []);
  useEffect(() => {
    if (selectedRegion) setTileCount(countTiles(selectedRegion.bbox, mode.minZoom, mode.maxZoom));
  }, [selectedRegion, selectedMode]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true); setResults([]); setSelectedRegion(null);
    try {
      const found = await geocodeRegion(query.trim());
      if (!found.length) Alert.alert(t('regionDownload.notFound'), t('regionDownload.notFoundBody'));
      setResults(found);
    } catch {
      Alert.alert(t('regionDownload.searchError'), t('regionDownload.searchErrorBody'));
    } finally { setSearching(false); }
  };

  const handleSelectResult = (item) => { setSelectedRegion(item); setResults([]); setQuery(item.name.split(',')[0]); };
  const estimateMB = (count) => ((count * 15) / 1024).toFixed(1);

  const handleDownload = async () => {
    if (!selectedRegion) return;
    if (tileCount > mode.tileLimit) {
      Alert.alert(
        t('regionDownload.downloadRegion'),
        selectedMode === 'navigation'
          ? t('regionDownload.tooLargeNav')(tileCount)
          : t('regionDownload.tooLargeField')(tileCount)
      );
      return;
    }
    Alert.alert(
      t('regionDownload.downloadRegion'),
      t('regionDownload.downloadConfirm')(
        selectedRegion.name.split(',')[0],
        modeLabels[selectedMode].label,
        mode.minZoom, mode.maxZoom, tileCount, estimateMB(tileCount)
      ),
      [
        { text: t('regionDownload.cancelBtn'), style: 'cancel' },
        { text: t('regionDownload.download'), onPress: startDownload },
      ]
    );
  };

  const startDownload = async () => {
    setDownloading(true); setProgress(0); cancelRef.current = false;
    const { bbox } = selectedRegion;
    const { minZoom, maxZoom } = mode;
    let downloaded = 0, failed = 0;
    const total = tileCount;

    try {
      await FileSystem.makeDirectoryAsync(TILE_BASE(), { intermediates: true });
      for (let z = minZoom; z <= maxZoom; z++) {
        if (cancelRef.current) break;
        const xMin = lon2tile(bbox.west, z), xMax = lon2tile(bbox.east, z);
        const yMin = lat2tile(bbox.north, z), yMax = lat2tile(bbox.south, z);
        for (let x = xMin; x <= xMax; x++) {
          if (cancelRef.current) break;
          await FileSystem.makeDirectoryAsync(`${TILE_BASE()}${z}/${x}/`, { intermediates: true });
          for (let y = yMin; y <= yMax; y++) {
            if (cancelRef.current) break;
            const path = tilePath(z, x, y);
            const info = await FileSystem.getInfoAsync(path);
            if (!info.exists) {
              try { await FileSystem.downloadAsync(TILE_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y), path); }
              catch { failed++; }
            }
            downloaded++;
            setProgress(Math.round((downloaded / total) * 100));
            setProgressText(`${t('regionDownload.zoom')(z, '')} — ${downloaded}/${total}`);
          }
        }
      }

      if (!cancelRef.current) {
        const regionData = {
          id: Date.now().toString(),
          name: selectedRegion.name.split(',')[0],
          fullName: selectedRegion.name,
          bbox: selectedRegion.bbox,
          minZoom, maxZoom,
          mode: mode.id,
          modeLabel: modeLabels[selectedMode].label,
          tileCount: downloaded,
          downloadedAt: new Date().toISOString(),
          sizeMB: estimateMB(downloaded),
        };
        const existing = await loadRegions();
        const updated = [
          ...existing.filter(r => !(r.name === regionData.name && r.mode === regionData.mode)),
          regionData,
        ];
        await saveRegions(updated);
        setDownloadedRegions(updated);
        Alert.alert(
          t('regionDownload.downloadComplete'),
          t('regionDownload.downloadCompleteBody')(
            regionData.name, modeLabels[selectedMode].label,
            downloaded, regionData.sizeMB, failed
          ),
          [{ text: t('common.ok') }]
        );
      }
    } catch (e) {
      Alert.alert(t('regionDownload.downloadFailed'), e.message);
    } finally {
      setDownloading(false); setProgress(0); setProgressText('');
    }
  };

  const handleCancel = () => { cancelRef.current = true; setDownloading(false); setProgressText(t('regionDownload.cancelling')); };

  const handleViewOnMap = (region) => {
    navigation.navigate('Map', {
      goToLat: (region.bbox.north + region.bbox.south) / 2,
      goToLng: (region.bbox.east  + region.bbox.west)  / 2,
      goToZoom: region.minZoom + 1,
    });
  };

  const handleCheckCache = async (region) => {
    checkCancelRef.current = { cancelled: false };
    setCheckingRegion(region.id);
    try {
      const result = await checkCachedTiles(region, checkCancelRef.current);
      if (!result) return;
      const { cached, total } = result;
      const pct = total > 0 ? Math.round((cached / total) * 100) : 0;
      const status = cached === 0
        ? t('regionDownload.cacheNone')
        : cached >= total * 0.95
          ? t('regionDownload.cacheFull')
          : t('regionDownload.cachePartial')(total - cached);
      Alert.alert(
        t('regionDownload.cacheStatus')(region.name),
        `${t('regionDownload.cacheBody')(cached, total, pct)}\n\n${status}`
      );
    } catch (e) {
      Alert.alert(t('regionDownload.cacheError'), t('regionDownload.cacheErrorBody')(e.message));
    } finally { setCheckingRegion(null); }
  };

  const handleDeleteRegion = (region) => {
    Alert.alert(
      t('regionDownload.deleteRegion'),
      t('regionDownload.deleteConfirm')(region.name, region.modeLabel || t('regionDownload.navigation')),
      [
        { text: t('regionDownload.cancelBtn'), style: 'cancel' },
        {
          text: t('regionDownload.delete'), style: 'destructive',
          onPress: async () => {
            try {
              const { bbox, minZoom, maxZoom } = region;
              for (let z = minZoom; z <= maxZoom; z++) {
                for (let x = lon2tile(bbox.west, z); x <= lon2tile(bbox.east, z); x++) {
                  for (let y = lat2tile(bbox.north, z); y <= lat2tile(bbox.south, z); y++) {
                    try { await FileSystem.deleteAsync(tilePath(z, x, y), { idempotent: true }); } catch {}
                  }
                }
              }
              const updated = downloadedRegions.filter(r => r.id !== region.id);
              await saveRegions(updated);
              setDownloadedRegions(updated);
              navigation.navigate('Map');
            } catch {
              Alert.alert(t('regionDownload.deleteError'), t('regionDownload.deleteErrorBody'));
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
        <Text style={styles.sectionTitle}>{t('regionDownload.downloadMode')}</Text>
        <View style={styles.modeRow}>
          {Object.values(MODES).map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modeCard, selectedMode === m.id && { borderColor: m.color, backgroundColor: m.color + '10' }]}
              onPress={() => { setSelectedMode(m.id); setSelectedRegion(null); setResults([]); setQuery(''); }}
            >
              <Ionicons name={m.icon} size={24} color={selectedMode === m.id ? m.color : '#999'} />
              <Text style={[styles.modeLabel, selectedMode === m.id && { color: m.color }]}>{modeLabels[m.id].label}</Text>
              <Text style={styles.modeZoom}>{t('regionDownload.zoom')(m.minZoom, m.maxZoom)}</Text>
              <Text style={styles.modeDesc}>{modeLabels[m.id].desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('regionDownload.searchRegion')}</Text>
        <Text style={styles.sectionSubtitle}>
          {selectedMode === 'navigation' ? t('regionDownload.searchNavSubtitle') : t('regionDownload.searchFieldSubtitle')}
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder={selectedMode === 'navigation' ? t('regionDownload.searchNavPlaceholder') : t('regionDownload.searchFieldPlaceholder')}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: mode.color }]} onPress={handleSearch} disabled={searching}>
            {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {results.length > 0 && (
          <View style={styles.resultsList}>
            {results.map((item, i) => (
              <TouchableOpacity key={i} style={styles.resultItem} onPress={() => handleSelectResult(item)}>
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
          <Text style={styles.sectionTitle}>{t('regionDownload.selectedRegion')}</Text>
          <View style={styles.regionCard}>
            <View style={[styles.modeBadge, { backgroundColor: mode.color + '20' }]}>
              <Ionicons name={mode.icon} size={14} color={mode.color} />
              <Text style={[styles.modeBadgeText, { color: mode.color }]}>{modeLabels[selectedMode].label}</Text>
            </View>
            <Text style={styles.regionName}>{selectedRegion.name.split(',')[0]}</Text>
            <Text style={styles.regionMeta} numberOfLines={2}>{selectedRegion.name}</Text>
            <View style={styles.regionStats}>
              <View style={styles.stat}><Ionicons name="layers-outline" size={16} color="#666" /><Text style={styles.statText}>{t('regionDownload.zoom')(mode.minZoom, mode.maxZoom)}</Text></View>
              <View style={styles.stat}><Ionicons name="grid-outline" size={16} color="#666" /><Text style={styles.statText}>{t('regionDownload.tiles')(tileCount)}</Text></View>
              <View style={styles.stat}><Ionicons name="save-outline" size={16} color="#666" /><Text style={styles.statText}>{t('regionDownload.estimatedSize')(estimateMB(tileCount))}</Text></View>
            </View>
            {tileCount > mode.tileLimit && (
              <View style={styles.warningBox}>
                <Ionicons name="warning-outline" size={16} color="#FF6B6B" />
                <Text style={styles.warningText}>
                  {selectedMode === 'fieldwork' ? t('regionDownload.tooLargeFieldShort') : t('regionDownload.tooLargeNavShort')}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.downloadBtn, { backgroundColor: tileCount > mode.tileLimit ? '#ccc' : mode.color }]}
              onPress={handleDownload}
              disabled={tileCount > mode.tileLimit}
            >
              <Ionicons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>{t('regionDownload.downloadForOffline')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress */}
      {downloading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('regionDownload.downloading')}</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: mode.color }]} />
            </View>
            <Text style={[styles.progressPct, { color: mode.color }]}>{progress}%</Text>
            <Text style={styles.progressDetail}>{progressText}</Text>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>{t('regionDownload.cancelBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Downloaded regions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('regionDownload.downloadedRegions')}</Text>
        {downloadedRegions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={40} color="#ccc" />
            <Text style={styles.emptyText}>{t('regionDownload.noRegions')}</Text>
            <Text style={styles.emptySubtext}>{t('regionDownload.noRegionsSubtitle')}</Text>
          </View>
        ) : (
          downloadedRegions.map((region) => {
            const regionMode = MODES[region.mode] || MODES.navigation;
            const regionModeLabel = modeLabels[region.mode]?.label || region.modeLabel || t('regionDownload.navigation');
            return (
              <View key={region.id} style={styles.downloadedCard}>
                <View style={styles.downloadedInfo}>
                  <View style={styles.downloadedHeader}>
                    <Text style={styles.downloadedName}>{region.name}</Text>
                    <View style={[styles.modeBadgeSmall, { backgroundColor: regionMode.color + '20' }]}>
                      <Text style={[styles.modeBadgeSmallText, { color: regionMode.color }]}>{regionModeLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.downloadedMeta}>
                    {t('regionDownload.zoom')(region.minZoom, region.maxZoom)} · {region.tileCount?.toLocaleString()} · {region.sizeMB} MB
                  </Text>
                  <Text style={styles.downloadedDate}>{new Date(region.downloadedAt).toLocaleDateString()}</Text>
                </View>
                <View style={styles.downloadedActions}>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => handleViewOnMap(region)}>
                    <Ionicons name="map-outline" size={22} color="#4A90E2" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.checkBtn} onPress={() => {
                    if (checkingRegion === region.id) { checkCancelRef.current.cancelled = true; setCheckingRegion(null); }
                    else handleCheckCache(region);
                  }}>
                    {checkingRegion === region.id
                      ? <ActivityIndicator size="small" color="#00D9A5" />
                      : <Ionicons name="checkmark-circle-outline" size={22} color="#00D9A5" />}
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
  viewBtn: { padding: 8 },
  checkBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
});

export default RegionDownloadScreen;