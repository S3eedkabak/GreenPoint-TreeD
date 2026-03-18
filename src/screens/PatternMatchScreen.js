import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import * as Location from 'expo-location';

import { getAllTrees } from '../database/db';
import { findPatternMatch } from '../utils/patternMatching';
import { useTranslation } from '../utils/useTranslation';

const SPECIES_OPTIONS = [
  { label: 'Oak', value: 'Oak' },
  { label: 'Pine', value: 'Pine' },
  { label: 'Eucalyptus', value: 'Eucalyptus' },
  { label: 'Maple', value: 'Maple' },
  { label: 'Birch', value: 'Birch' },
];

const MAX_TREES = 5;
const CLOSE_MATCH_AVG_COST_THRESHOLD = 35;
const CLOSE_MATCH_SPECIES_THRESHOLD = 4;

const isObservationComplete = (obs) => (
  obs.latitude !== null &&
  obs.longitude !== null &&
  obs.species !== '' &&
  typeof obs.dbh === 'number' &&
  obs.dbh > 0
);

const PatternMatchScreen = ({ navigation, route }) => {
  const { t } = useTranslation();

  const [observations, setObservations] = useState([
    { id: 1, latitude: null, longitude: null, species: '', dbh: null },
    { id: 2, latitude: null, longitude: null, species: '', dbh: null },
    { id: 3, latitude: null, longitude: null, species: '', dbh: null },
    { id: 4, latitude: null, longitude: null, species: '', dbh: null },
    { id: 5, latitude: null, longitude: null, species: '', dbh: null },
  ]);

  const [activeTreeIndex, setActiveTreeIndex] = useState(0);
  const [isMatching, setIsMatching] = useState(false);
  const [speciesDropdownOpen, setSpeciesDropdownOpen] = useState(false);
  const [speciesOptions, setSpeciesOptions] = useState(SPECIES_OPTIONS);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Receive measured DBH back from TreeTrunkMeasurementScreen
  useEffect(() => {
    const measuredDbh = route?.params?.measuredDbh;
    const treeIndex = route?.params?.treeIndex;
    if (typeof measuredDbh !== 'number' || typeof treeIndex !== 'number') return;
    if (treeIndex < 0 || treeIndex >= MAX_TREES) {
      navigation.setParams({ measuredDbh: undefined, treeIndex: undefined });
      return;
    }
    setObservations(prev => {
      const next = [...prev];
      next[treeIndex] = { ...next[treeIndex], dbh: measuredDbh };
      return next;
    });
    navigation.setParams({ measuredDbh: undefined, treeIndex: undefined });
  }, [route?.params?.measuredDbh, route?.params?.treeIndex, navigation]);

  const updateObservation = (index, field, value) => {
    setObservations(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const currentObservation = observations[activeTreeIndex];

  const currentTreeComplete = useMemo(
    () => isObservationComplete(currentObservation),
    [currentObservation]
  );

  const allTreesComplete = useMemo(
    () => observations.every(isObservationComplete),
    [observations]
  );

  const openStemMeasurement = (index) => {
    navigation.navigate('MeasureTrunk', {
      returnTo: 'PatternMatch',
      treeIndex: index,
    });
  };

  const handleNextTree = () => {
    if (!currentTreeComplete) {
      Alert.alert(
        t('patternMatch.incompleteData'),
        `Please fill coordinate, species, and stem diameter for Tree ${activeTreeIndex + 1}.`
      );
      return;
    }
    if (activeTreeIndex < MAX_TREES - 1) {
      setActiveTreeIndex(prev => prev + 1);
      setSpeciesDropdownOpen(false);
    }
  };

  const handleGetLocation = async (index) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('patternMatch.permissionDenied'), t('patternMatch.locationPermissionRequired'));
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      updateObservation(index, 'latitude', location.coords.latitude);
      updateObservation(index, 'longitude', location.coords.longitude);
      Alert.alert(t('patternMatch.locationFetched'), t('patternMatch.locationRecorded')(index + 1));
    } catch (error) {
      console.error('Error fetching location', error);
      Alert.alert(t('patternMatch.error'), t('patternMatch.couldNotFetchLocation'));
    }
  };

  const handleMatchPattern = async () => {
    if (!allTreesComplete) {
      Alert.alert(t('patternMatch.incompleteData'), t('patternMatch.incompleteDataBody'));
      return;
    }

    setIsMatching(true);

    try {
      const dbTrees = await getAllTrees();
      if (dbTrees.length < MAX_TREES) {
        Alert.alert(t('patternMatch.databaseTooSmall'), t('patternMatch.databaseTooSmallBody'));
        setIsMatching(false);
        return;
      }

      const formattedObs = observations.map(obs => ({
        latitude: obs.latitude,
        longitude: obs.longitude,
        species: obs.species,
        dbh: obs.dbh,
      }));

      setTimeout(() => {
        const matches = findPatternMatch(formattedObs, dbTrees);
        setIsMatching(false);

        if (!matches || matches.length !== MAX_TREES) {
          Alert.alert(t('patternMatch.noMatchFound'), t('patternMatch.noMatchFoundBody'));
          return;
        }

        const avgCost = matches.reduce((sum, m) => sum + (m.cost || 0), 0) / matches.length;
        const speciesMatches = matches.filter((m, i) => {
          const observedSpecies = formattedObs[i]?.species || '';
          const dbSpecies = m?.dbTree?.species || '';
          return observedSpecies.toLowerCase() === dbSpecies.toLowerCase();
        }).length;

        const isCloseMatch = (
          avgCost <= CLOSE_MATCH_AVG_COST_THRESHOLD &&
          speciesMatches >= CLOSE_MATCH_SPECIES_THRESHOLD
        );

        if (!isCloseMatch) {
          Alert.alert(t('patternMatch.noMatchFound'), t('patternMatch.noMatchFoundBody'));
          return;
        }

        const validCoords = matches
          .map(m => ({ latitude: m?.dbTree?.northing, longitude: m?.dbTree?.easting }))
          .filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number');

        if (validCoords.length === 0) {
          Alert.alert(t('patternMatch.noMatchFound'), t('patternMatch.noMatchFoundBody'));
          return;
        }

        const centerLat = validCoords.reduce((sum, c) => sum + c.latitude, 0) / validCoords.length;
        const centerLng = validCoords.reduce((sum, c) => sum + c.longitude, 0) / validCoords.length;

        navigation.navigate('Map', {
          goToLat: centerLat,
          goToLng: centerLng,
          goToZoom: 18,
        });
      }, 100);

    } catch (error) {
      console.error('Match error:', error);
      Alert.alert(t('patternMatch.error'), t('patternMatch.matchErrorBody'));
      setIsMatching(false);
    }
  };

  const renderCurrentObservationForm = () => {
    const obs = observations[activeTreeIndex];
    return (
      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>{t('patternMatch.treeDetails')(activeTreeIndex + 1)}</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            <Ionicons name="location-outline" size={16} color="#00D9A5" /> {t('patternMatch.gpsLocation')}
          </Text>
          <TouchableOpacity
            style={[styles.locationBtn, obs.latitude && styles.locationBtnSuccess]}
            onPress={() => handleGetLocation(activeTreeIndex)}
          >
            <Ionicons name={obs.latitude ? "checkmark-circle" : "locate"} size={20} color={obs.latitude ? "#fff" : "#00D9A5"} />
            <Text style={[styles.locationBtnText, obs.latitude && { color: '#fff' }]}>
              {obs.latitude
                ? t('patternMatch.coords')(obs.latitude, obs.longitude)
                : t('patternMatch.getCurrentLocation')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.inputContainer, { zIndex: 1000 }]}>
          <Text style={styles.label}>
            <Ionicons name="flower-outline" size={16} color="#00D9A5" /> {t('patternMatch.species')}
          </Text>
          <DropDownPicker
            open={speciesDropdownOpen}
            value={obs.species}
            items={speciesOptions}
            setOpen={setSpeciesDropdownOpen}
            setValue={(callback) => {
              const val = typeof callback === 'function' ? callback(obs.species) : callback;
              updateObservation(activeTreeIndex, 'species', val);
            }}
            setItems={setSpeciesOptions}
            placeholder={t('patternMatch.selectSpecies')}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
            zIndex={1000}
            zIndexInverse={1000}
          />
        </View>

        <View style={[styles.inputContainer, { zIndex: 1 }]}>
          <Text style={styles.label}>
            <Ionicons name="ellipse-outline" size={16} color="#00D9A5" /> {t('patternMatch.stemDiameter')}
          </Text>
          <TouchableOpacity
            style={[styles.locationBtn, typeof obs.dbh === 'number' && styles.locationBtnSuccess]}
            onPress={() => openStemMeasurement(activeTreeIndex)}
          >
            <Ionicons
              name={typeof obs.dbh === 'number' ? 'checkmark-circle' : 'camera'}
              size={20}
              color={typeof obs.dbh === 'number' ? '#fff' : '#00D9A5'}
            />
            <Text style={[styles.locationBtnText, typeof obs.dbh === 'number' && { color: '#fff' }]}>
              {typeof obs.dbh === 'number'
                ? `${obs.dbh.toFixed(1)} cm ${t('patternMatch.captured')}`
                : t('patternMatch.measureWithCamera')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.treeNavContainer}>
          <TouchableOpacity
            style={[styles.navBtn, activeTreeIndex === 0 && styles.navBtnDisabled]}
            disabled={activeTreeIndex === 0}
            onPress={() => setActiveTreeIndex(prev => prev - 1)}
          >
            <Ionicons name="arrow-back" size={20} color={activeTreeIndex === 0 ? "#ccc" : "#00D9A5"} />
            <Text style={[styles.navBtnText, activeTreeIndex === 0 && { color: '#ccc' }]}>{t('patternMatch.prevTree')}</Text>
          </TouchableOpacity>

          <Text style={styles.treeCountText}>{activeTreeIndex + 1} / 5</Text>

          {activeTreeIndex < 4 ? (
            <TouchableOpacity
              style={[styles.navBtn, !currentTreeComplete && styles.navBtnDisabled]}
              onPress={handleNextTree}
            >
              <Text style={[styles.navBtnText, !currentTreeComplete && { color: '#ccc' }]}>{t('patternMatch.nextTree')}</Text>
              <Ionicons name="arrow-forward" size={20} color={!currentTreeComplete ? '#ccc' : '#00D9A5'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, (!allTreesComplete || isMatching) && styles.navBtnDisabled]}
              onPress={handleMatchPattern}
              disabled={!allTreesComplete || isMatching}
            >
              {isMatching ? (
                <ActivityIndicator size="small" color="#00D9A5" />
              ) : (
                <>
                  <Text style={[styles.navBtnText, !allTreesComplete && { color: '#ccc' }]}>{t('patternMatch.findMatch')}</Text>
                  <Ionicons name="search" size={20} color={!allTreesComplete ? '#ccc' : '#00D9A5'} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="git-merge" size={40} color="#00D9A5" />
            </View>
            <Text style={styles.title}>{t('patternMatch.title')}</Text>
            <Text style={styles.subtitle}>{t('patternMatch.subtitle')}</Text>
          </View>

          <View style={styles.progressContainer}>
            {observations.map((obs, i) => {
              const isComplete = isObservationComplete(obs);
              const isActive = i === activeTreeIndex;
              return (
                <TouchableOpacity key={obs.id} onPress={() => setActiveTreeIndex(i)}>
                  <View style={[
                    styles.progressDot,
                    isComplete && styles.progressDotComplete,
                    isActive && styles.progressDotActive
                  ]}>
                    <Text style={[
                      styles.progressText,
                      (isComplete || isActive) && { color: '#fff' }
                    ]}>{i + 1}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {renderCurrentObservationForm()}

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 20 },
  header: { alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#00D9A5' },
  title: { fontSize: 24, fontWeight: '800', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', fontWeight: '500', textAlign: 'center' },

  progressContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 30 },
  progressDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#eee' },
  progressDotComplete: { backgroundColor: '#00D9A5', borderColor: '#00D9A5' },
  progressDotActive: { borderColor: '#000', borderWidth: 3 },
  progressText: { fontSize: 16, fontWeight: '700', color: '#888' },

  formContainer: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 20, textAlign: 'center' },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 10 },

  inputWrapper: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#00D9A5' },
  input: { padding: 16, fontSize: 16, color: '#000' },

  locationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#00D9A5', backgroundColor: '#fff' },
  locationBtnSuccess: { backgroundColor: '#00D9A5' },
  locationBtnText: { fontSize: 16, fontWeight: '600', color: '#00D9A5', marginLeft: 8 },

  dropdown: { backgroundColor: '#ffffff', borderColor: '#00D9A5', borderRadius: 16 },
  dropdownContainer: { backgroundColor: '#ffffff', borderColor: '#00D9A5', borderRadius: 16 },

  treeNavContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingVertical: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { fontSize: 16, fontWeight: '700', color: '#00D9A5', marginHorizontal: 5 },
  treeCountText: { fontSize: 16, fontWeight: '700', color: '#000' },

  matchButton: { backgroundColor: '#00D9A5', flexDirection: 'row', paddingVertical: 18, borderRadius: 16, marginTop: 40, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#00D9A5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  matchButtonDisabled: { backgroundColor: '#ccc', shadowOpacity: 0 },
  matchButtonText: { color: '#000', fontSize: 18, fontWeight: '800', marginLeft: 10 },

  resultContainer: { alignItems: 'center', marginTop: 10, padding: 20, backgroundColor: '#f9f9f9', borderRadius: 16, borderWidth: 1, borderColor: '#00D9A5' },
  resultTitle: { fontSize: 20, fontWeight: '800', color: '#00D9A5', marginBottom: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 15 },
  resultObsText: { fontSize: 16, fontWeight: '700', color: '#000', flex: 1 },
  resultDbCard: { flex: 2, backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  resultDbText: { fontSize: 14, fontWeight: '700', color: '#000' },
  resultDbSubText: { fontSize: 12, color: '#666', marginTop: 2 },
  doneBtn: { backgroundColor: '#000', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25, marginTop: 20 },
  doneBtnText: { color: '#00D9A5', fontSize: 16, fontWeight: '700' },
});

export default PatternMatchScreen;
