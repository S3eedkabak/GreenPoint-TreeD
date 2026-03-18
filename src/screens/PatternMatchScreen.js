import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DropDownPicker from 'react-native-dropdown-picker';
import * as Location from 'expo-location';

import { getAllTrees } from '../database/db';
import { findPatternMatch } from '../utils/patternMatching';

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

const createInitialObservation = (id) => ({
  id,
  latitude: null,
  longitude: null,
  species: '',
  dbh: null,
});

const PatternMatchScreen = ({ navigation, route }) => {
  const [observations, setObservations] = useState([
    createInitialObservation(1),
    createInitialObservation(2),
    createInitialObservation(3),
    createInitialObservation(4),
    createInitialObservation(5),
  ]);

  const [activeTreeIndex, setActiveTreeIndex] = useState(0);
  const [isMatching, setIsMatching] = useState(false);
  const [speciesDropdownOpen, setSpeciesDropdownOpen] = useState(false);
  const [speciesOptions, setSpeciesOptions] = useState(SPECIES_OPTIONS);

  useEffect(() => {
    const measuredDbh = route?.params?.measuredDbh;
    const treeIndex = route?.params?.treeIndex;

    if (typeof measuredDbh !== 'number' || typeof treeIndex !== 'number') {
      return;
    }

    if (treeIndex < 0 || treeIndex >= MAX_TREES) {
      navigation.setParams({ measuredDbh: undefined, treeIndex: undefined });
      return;
    }

    setObservations(prev => {
      const next = [...prev];
      next[treeIndex] = {
        ...next[treeIndex],
        dbh: measuredDbh,
      };
      return next;
    });

    navigation.setParams({ measuredDbh: undefined, treeIndex: undefined });
  }, [route?.params?.measuredDbh, route?.params?.treeIndex, navigation]);

  const updateObservation = (index, field, value) => {
    setObservations(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const handleGetLocation = async (index) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      updateObservation(index, 'latitude', location.coords.latitude);
      updateObservation(index, 'longitude', location.coords.longitude);
      Alert.alert('Coordinate Captured', `Tree ${index + 1} coordinate recorded.`);
    } catch (error) {
      console.error('Error fetching location', error);
      Alert.alert('Error', 'Could not fetch location.');
    }
  };

  const openStemMeasurement = (index) => {
    navigation.navigate('MeasureTrunk', {
      returnTo: 'PatternMatch',
      treeIndex: index,
    });
  };

  const isObservationComplete = (obs) => (
    obs.latitude !== null
    && obs.longitude !== null
    && obs.species !== ''
    && typeof obs.dbh === 'number'
    && obs.dbh > 0
  );

  const currentObservation = observations[activeTreeIndex];

  const currentTreeComplete = useMemo(
    () => isObservationComplete(currentObservation),
    [currentObservation]
  );

  const allTreesComplete = useMemo(
    () => observations.every(isObservationComplete),
    [observations]
  );

  const handleNextTree = () => {
    if (!currentTreeComplete) {
      Alert.alert(
        'Incomplete Tree Data',
        `Please fill coordinate, species, and stem diameter for Tree ${activeTreeIndex + 1}.`
      );
      return;
    }

    if (activeTreeIndex < MAX_TREES - 1) {
      setActiveTreeIndex(prev => prev + 1);
      setSpeciesDropdownOpen(false);
    }
  };

  const handleFindPattern = async () => {
    if (!allTreesComplete) {
      Alert.alert('Incomplete Data', 'Please complete all 5 trees first.');
      return;
    }

    setIsMatching(true);

    try {
      const dbTrees = await getAllTrees();
      if (dbTrees.length < MAX_TREES) {
        Alert.alert('Database too small', 'Need at least 5 trees in the database to find a pattern.');
        setIsMatching(false);
        return;
      }

      const formattedObservations = observations.map(obs => ({
        latitude: obs.latitude,
        longitude: obs.longitude,
        species: obs.species,
        dbh: obs.dbh,
      }));

      setTimeout(() => {
        const matches = findPatternMatch(formattedObservations, dbTrees);
        setIsMatching(false);

        if (!matches || matches.length !== MAX_TREES) {
          Alert.alert('No close match found', 'No close match found.');
          return;
        }

        const avgCost = matches.reduce((sum, m) => sum + (m.cost || 0), 0) / matches.length;
        const speciesMatches = matches.filter((m, i) => {
          const observedSpecies = formattedObservations[i]?.species || '';
          const dbSpecies = m?.dbTree?.species || '';
          return observedSpecies.toLowerCase() === dbSpecies.toLowerCase();
        }).length;

        const isCloseMatch = (
          avgCost <= CLOSE_MATCH_AVG_COST_THRESHOLD
          && speciesMatches >= CLOSE_MATCH_SPECIES_THRESHOLD
        );

        if (!isCloseMatch) {
          Alert.alert('No close match found', 'No close match found.');
          return;
        }

        const validCoords = matches
          .map(m => ({
            latitude: m?.dbTree?.northing,
            longitude: m?.dbTree?.easting,
          }))
          .filter(c => typeof c.latitude === 'number' && typeof c.longitude === 'number');

        if (validCoords.length === 0) {
          Alert.alert('No close match found', 'No close match found.');
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
      Alert.alert('Error', 'An error occurred during pattern matching.');
      setIsMatching(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="git-merge" size={40} color="#00D9A5" />
          </View>
          <Text style={styles.title}>Pattern Match</Text>
          <Text style={styles.subtitle}>Complete Tree 1 to Tree 5</Text>
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
                  isActive && styles.progressDotActive,
                ]}>
                  <Text style={[
                    styles.progressText,
                    (isComplete || isActive) && { color: '#fff' },
                  ]}>{i + 1}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tree {activeTreeIndex + 1}</Text>

          <View style={styles.segment}>
            <Text style={styles.segmentTitle}>Coordinate</Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                currentObservation.latitude !== null && styles.actionButtonSuccess,
              ]}
              onPress={() => handleGetLocation(activeTreeIndex)}
            >
              <Ionicons
                name={currentObservation.latitude !== null ? 'checkmark-circle' : 'locate'}
                size={20}
                color={currentObservation.latitude !== null ? '#fff' : '#00D9A5'}
              />
              <Text style={[
                styles.actionButtonText,
                currentObservation.latitude !== null && styles.actionButtonTextSuccess,
              ]}>
                {currentObservation.latitude !== null
                  ? `${currentObservation.latitude.toFixed(5)}, ${currentObservation.longitude.toFixed(5)}`
                  : 'Capture Current Coordinate'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.segment, { zIndex: 10 }]}> 
            <Text style={styles.segmentTitle}>Species</Text>
            <DropDownPicker
              open={speciesDropdownOpen}
              value={currentObservation.species}
              items={speciesOptions}
              setOpen={setSpeciesDropdownOpen}
              setValue={(callback) => {
                const selected = typeof callback === 'function'
                  ? callback(currentObservation.species)
                  : callback;
                updateObservation(activeTreeIndex, 'species', selected);
              }}
              setItems={setSpeciesOptions}
              placeholder="Select species"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={2000}
              zIndexInverse={1000}
            />
          </View>

          <View style={[styles.segment, { zIndex: 1 }]}>
            <Text style={styles.segmentTitle}>Stem Diameter</Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                typeof currentObservation.dbh === 'number' && styles.actionButtonSuccess,
              ]}
              onPress={() => openStemMeasurement(activeTreeIndex)}
            >
              <Ionicons
                name={typeof currentObservation.dbh === 'number' ? 'checkmark-circle' : 'camera'}
                size={20}
                color={typeof currentObservation.dbh === 'number' ? '#fff' : '#00D9A5'}
              />
              <Text style={[
                styles.actionButtonText,
                typeof currentObservation.dbh === 'number' && styles.actionButtonTextSuccess,
              ]}>
                {typeof currentObservation.dbh === 'number'
                  ? `${currentObservation.dbh.toFixed(1)} cm captured`
                  : 'Measure with camera'}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTreeIndex < MAX_TREES - 1 ? (
            <TouchableOpacity
              style={[styles.nextButton, !currentTreeComplete && styles.nextButtonDisabled]}
              onPress={handleNextTree}
              disabled={!currentTreeComplete}
            >
              <Text style={styles.nextButtonText}>Next (Tree {activeTreeIndex + 2})</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.matchButton, (!allTreesComplete || isMatching) && styles.matchButtonDisabled]}
              onPress={handleFindPattern}
              disabled={!allTreesComplete || isMatching}
            >
              {isMatching ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="search" size={22} color="#000" />
                  <Text style={styles.matchButtonText}>Start Pattern Matching</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 20 },
  header: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#00D9A5',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', fontWeight: '500', textAlign: 'center' },

  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
  },
  progressDotComplete: { backgroundColor: '#00D9A5', borderColor: '#00D9A5' },
  progressDotActive: { borderColor: '#000', borderWidth: 3 },
  progressText: { fontSize: 16, fontWeight: '700', color: '#888' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#00D9A5',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    marginBottom: 14,
    textAlign: 'center',
  },
  segment: { marginBottom: 16 },
  segmentTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 8 },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#00D9A5',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  actionButtonSuccess: {
    backgroundColor: '#00D9A5',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00D9A5',
    marginLeft: 8,
  },
  actionButtonTextSuccess: {
    color: '#fff',
  },

  dropdown: { backgroundColor: '#ffffff', borderColor: '#00D9A5', borderRadius: 14 },
  dropdownContainer: { backgroundColor: '#ffffff', borderColor: '#00D9A5', borderRadius: 14 },

  nextButton: {
    backgroundColor: '#00D9A5',
    minHeight: 54,
    borderRadius: 14,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: { backgroundColor: '#ccc' },
  nextButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
  },

  matchButton: {
    backgroundColor: '#00D9A5',
    minHeight: 56,
    borderRadius: 14,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchButtonDisabled: { backgroundColor: '#ccc' },
  matchButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 8,
  },
});

export default PatternMatchScreen;
