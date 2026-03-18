import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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

const PatternMatchScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const [observations, setObservations] = useState([
    { id: 1, latitude: null, longitude: null, species: '', dbh: '' },
    { id: 2, latitude: null, longitude: null, species: '', dbh: '' },
    { id: 3, latitude: null, longitude: null, species: '', dbh: '' },
    { id: 4, latitude: null, longitude: null, species: '', dbh: '' },
    { id: 5, latitude: null, longitude: null, species: '', dbh: '' },
  ]);

  const [activeTreeIndex, setActiveTreeIndex] = useState(0);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
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

  const updateObservation = (index, field, value) => {
    const newObs = [...observations];
    newObs[index][field] = value;
    setObservations(newObs);
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

  const allTreesLogged = observations.every(
    obs => obs.latitude !== null && obs.longitude !== null && obs.species !== ''
  );

  const handleMatchPattern = async () => {
    if (!allTreesLogged) {
      Alert.alert(t('patternMatch.incompleteData'), t('patternMatch.incompleteDataBody'));
      return;
    }

    setIsMatching(true);
    setMatchResult(null);

    try {
      const dbTrees = await getAllTrees();
      if (dbTrees.length < 5) {
        Alert.alert(t('patternMatch.databaseTooSmall'), t('patternMatch.databaseTooSmallBody'));
        setIsMatching(false);
        return;
      }

      const formattedObs = observations.map(obs => ({
        latitude: obs.latitude,
        longitude: obs.longitude,
        species: obs.species,
        dbh: obs.dbh ? parseFloat(obs.dbh) : null,
      }));

      setTimeout(() => {
        const matches = findPatternMatch(formattedObs, dbTrees);
        setIsMatching(false);

        if (matches) {
          setMatchResult(matches);
        } else {
          Alert.alert(t('patternMatch.noMatchFound'), t('patternMatch.noMatchFoundBody'));
        }
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
            <Ionicons name="ellipse-outline" size={16} color="#888" /> {t('patternMatch.dbhOptional')}
          </Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder={t('patternMatch.dbhPlaceholder')}
              placeholderTextColor="#666"
              value={obs.dbh}
              onChangeText={(text) => updateObservation(activeTreeIndex, 'dbh', text)}
              keyboardType="decimal-pad"
            />
          </View>
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

          <TouchableOpacity
            style={[styles.navBtn, activeTreeIndex === 4 && styles.navBtnDisabled]}
            disabled={activeTreeIndex === 4}
            onPress={() => setActiveTreeIndex(prev => prev + 1)}
          >
            <Text style={[styles.navBtnText, activeTreeIndex === 4 && { color: '#ccc' }]}>{t('patternMatch.nextTree')}</Text>
            <Ionicons name="arrow-forward" size={20} color={activeTreeIndex === 4 ? "#ccc" : "#00D9A5"} />
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  const renderResult = () => {
    if (!matchResult) return null;

    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultTitle}>{t('patternMatch.patternMatchFound')}</Text>
        {matchResult.map((match, i) => (
          <View key={i} style={styles.resultRow}>
            <Text style={styles.resultObsText}>{t('patternMatch.obsTree')(match.observationIndex + 1)}</Text>
            <Ionicons name="arrow-forward" size={16} color="#00D9A5" style={{ marginHorizontal: 10 }} />
            <View style={styles.resultDbCard}>
              <Text style={styles.resultDbText}>{t('patternMatch.dbId')(match.dbTree.tree_id.substring(0, 8))}</Text>
              <Text style={styles.resultDbSubText}>{match.dbTree.species}</Text>
              <Text style={styles.resultDbSubText}>{t('patternMatch.lat')(match.dbTree.northing)}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneBtnText}>{t('patternMatch.returnToMap')}</Text>
        </TouchableOpacity>
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
              const isComplete = obs.latitude !== null && obs.species !== '';
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

          {!matchResult ? renderCurrentObservationForm() : renderResult()}

          {!matchResult && (
            <TouchableOpacity
              style={[styles.matchButton, !allTreesLogged && styles.matchButtonDisabled]}
              onPress={handleMatchPattern}
              disabled={!allTreesLogged || isMatching}
            >
              {isMatching ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="search" size={24} color="#000" />
                  <Text style={styles.matchButtonText}>{t('patternMatch.findMatch')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

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
