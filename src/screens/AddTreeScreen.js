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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insertTree } from '../database/db';
import DropDownPicker from 'react-native-dropdown-picker';
import Slider from '@react-native-community/slider';
import { useTranslation } from '../utils/useTranslation';

const AddTreeScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params;
  const { t } = useTranslation();

  const [species, setSpecies] = useState('');
  const [dbh, setDbh] = useState('');
  const [crownHeight, setCrownHeight] = useState('');
  const [crownRadius, setCrownRadius] = useState('');
  const [crownCompleteness, setCrownCompleteness] = useState('');
  const [tags, setTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [treeHeightSlider, setTreeHeightSlider] = useState(10);
  const [speciesDropdownOpen, setSpeciesDropdownOpen] = useState(false);
  const [speciesOptions, setSpeciesOptions] = useState([
    { label: 'Oak', value: 'Oak' },
    { label: 'Pine', value: 'Pine' },
    { label: 'Eucalyptus', value: 'Eucalyptus' },
  ]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const measured = route.params?.measuredHeight;
    if (measured != null && !isNaN(measured) && measured > 0) {
      setTreeHeightSlider(Math.max(1, Math.min(50, measured)));
    }
  }, [route.params?.measuredHeight]);

  useEffect(() => {
    const measured = route.params?.measuredDbh;
    if (measured != null && !isNaN(measured) && measured > 0) {
      setDbh(String(measured));
    }
  }, [route.params?.measuredDbh]);

  const handleSave = async () => {
    if (!species.trim()) {
      Alert.alert(t('addTree.missingInfo'), t('addTree.speciesRequired'));
      return;
    }
    const heightValue = parseFloat(treeHeightSlider);
    if (!heightValue || isNaN(heightValue) || heightValue <= 0) {
      Alert.alert(t('addTree.invalidHeight'), t('addTree.heightRequired'));
      return;
    }
    if (dbh && (isNaN(parseFloat(dbh)) || parseFloat(dbh) < 0)) {
      Alert.alert(t('addTree.invalidDBH'), t('addTree.dbhMustBePositive'));
      return;
    }
    if (crownHeight && (isNaN(parseFloat(crownHeight)) || parseFloat(crownHeight) < 0)) {
      Alert.alert(t('addTree.invalidCrownHeight'), t('addTree.crownHeightMustBePositive'));
      return;
    }
    if (crownRadius && (isNaN(parseFloat(crownRadius)) || parseFloat(crownRadius) < 0)) {
      Alert.alert(t('addTree.invalidCrownRadius'), t('addTree.crownRadiusMustBePositive'));
      return;
    }
    if (crownCompleteness && (isNaN(parseFloat(crownCompleteness)) || parseFloat(crownCompleteness) < 0 || parseFloat(crownCompleteness) > 1)) {
      Alert.alert(t('addTree.invalidCrownCompleteness'), t('addTree.crownCompletenessMustBe'));
      return;
    }

    setIsSaving(true);
    try {
      await insertTree(
        species.trim(),
        heightValue,
        latitude,
        longitude,
        dbh ? parseFloat(dbh) : null,
        crownHeight ? parseFloat(crownHeight) : null,
        crownRadius ? parseFloat(crownRadius) : null,
        crownCompleteness ? parseFloat(crownCompleteness) : null,
        tags.trim() || null
      );
      Alert.alert(
        t('addTree.success'),
        t('addTree.treeAdded'),
        [{ text: t('addTree.ok'), onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error saving tree:', error);
      Alert.alert(t('addTree.error'), t('addTree.errorSave'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[styles.formContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="leaf" size={40} color="#00D9A5" />
            </View>
            <Text style={styles.title}>{t('addTree.title')}</Text>
            <Text style={styles.subtitle}>{t('addTree.subtitle')}</Text>
          </View>

          {/* Location Card */}
          <View style={styles.locationCard}>
            <Ionicons name="location-sharp" size={24} color="#00D9A5" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>{t('addTree.selectedLocation')}</Text>
              <Text style={styles.locationText}>
                N: {latitude.toFixed(6)} | E: {longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          {/* Required Fields */}
          <Text style={styles.sectionTitle}>{t('addTree.required')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="flower-outline" size={16} color="#00D9A5" /> {t('addTree.species')}
            </Text>
            <DropDownPicker
              open={speciesDropdownOpen}
              value={species}
              items={speciesOptions}
              setOpen={setSpeciesDropdownOpen}
              setValue={setSpecies}
              setItems={setSpeciesOptions}
              placeholder={t('addTree.selectSpecies')}
              searchable={true}
              searchPlaceholder={t('addTree.searchSpecies')}
              style={{ backgroundColor: '#ffffff', borderColor: '#00D9A5' }}
              dropDownContainerStyle={{ backgroundColor: '#ffffff', borderColor: '#00D9A5' }}
              searchContainerStyle={{ borderBottomColor: '#00D9A5' }}
              searchTextInputStyle={{ color: '#000' }}
              placeholderStyle={{ color: '#ffffff' }}
              textStyle={{ color: '#000' }}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="resize-outline" size={16} color="#00D9A5" /> {t('addTree.treeHeight')}
            </Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{treeHeightSlider.toFixed(1)} m</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={50}
                step={0.1}
                value={treeHeightSlider}
                onValueChange={setTreeHeightSlider}
                minimumTrackTintColor="#00D9A5"
                maximumTrackTintColor="#888"
              />
            </View>
            <TouchableOpacity
              style={styles.measureButton}
              onPress={() => navigation.navigate('MeasureHeight', { latitude, longitude })}
            >
              <Ionicons name="phone-portrait-outline" size={18} color="#00D9A5" />
              <Text style={styles.measureButtonText}>{t('addTree.measureClinometer')}</Text>
            </TouchableOpacity>
          </View>

          {/* Optional Fields */}
          <Text style={styles.sectionTitle}>{t('addTree.optional')}</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="ellipse-outline" size={16} color="#888" /> {t('addTree.dbh')}
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder={t('addTree.dbhPlaceholder')}
                placeholderTextColor="#666"
                value={dbh}
                onChangeText={setDbh}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity
              style={styles.measureButton}
              onPress={() => navigation.navigate('MeasureTrunk', { latitude, longitude })}
            >
              <Ionicons name="camera-outline" size={18} color="#00D9A5" />
              <Text style={styles.measureButtonText}>{t('addTree.measureCreditCard')}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>{t('addTree.dbhHint')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="arrow-up-outline" size={16} color="#888" /> {t('addTree.crownHeight')}
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder={t('addTree.crownHeightPlaceholder')}
                placeholderTextColor="#666"
                value={crownHeight}
                onChangeText={setCrownHeight}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>{t('addTree.crownHeightHint')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="radio-outline" size={16} color="#888" /> {t('addTree.crownRadius')}
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder={t('addTree.crownRadiusPlaceholder')}
                placeholderTextColor="#666"
                value={crownRadius}
                onChangeText={setCrownRadius}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>{t('addTree.crownRadiusHint')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="pie-chart-outline" size={16} color="#888" /> {t('addTree.crownCompleteness')}
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder={t('addTree.crownCompletenessPlaceholder')}
                placeholderTextColor="#666"
                value={crownCompleteness}
                onChangeText={setCrownCompleteness}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>{t('addTree.crownCompletenessHint')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="pricetags-outline" size={16} color="#888" /> {t('addTree.tags')}
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder={t('addTree.tagsPlaceholder')}
                placeholderTextColor="#666"
                value={tags}
                onChangeText={setTags}
              />
            </View>
            <Text style={styles.hint}>{t('addTree.tagsHint')}</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={24} color="#000" />
            <Text style={styles.saveButtonText}>
              {isSaving ? t('addTree.saving') : t('addTree.save')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>{t('addTree.cancel')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 20 },
  formContainer: { flex: 1 },
  header: { alignItems: 'center', marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#00D9A5' },
  title: { fontSize: 28, fontWeight: '800', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888', fontWeight: '500' },
  locationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#00D9A5' },
  locationInfo: { marginLeft: 12, flex: 1 },
  locationLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase', fontWeight: '600' },
  locationText: { fontSize: 14, color: '#000', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 16, marginTop: 8 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 12 },
  inputWrapper: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#00D9A5' },
  inputOptional: { borderColor: '#00D9A5' },
  input: { padding: 16, fontSize: 16, color: '#000' },
  hint: { fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic' },
  saveButton: { backgroundColor: '#00D9A5', flexDirection: 'row', paddingVertical: 18, borderRadius: 16, marginTop: 20, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#00D9A5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  saveButtonDisabled: { backgroundColor: '#555', shadowColor: '#000' },
  saveButtonText: { color: '#000', fontSize: 18, fontWeight: '800', marginLeft: 10 },
  cancelButton: { backgroundColor: '#fff', paddingVertical: 16, borderRadius: 16, marginTop: 12, marginBottom: 40, borderWidth: 1, borderColor: '#00D9A5' },
  cancelButtonText: { color: '#888', fontSize: 16, textAlign: 'center', fontWeight: '600' },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sliderValue: { fontSize: 16, color: '#000', minWidth: 50, textAlign: 'right' },
  measureButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#00D9A5', gap: 8 },
  measureButtonText: { fontSize: 14, fontWeight: '600', color: '#00D9A5' },
  slider: { flex: 1, height: 40, marginLeft: 10, marginRight: 10 },
});

export default AddTreeScreen;