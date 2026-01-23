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

const AddTreeScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params;
  
  // Required fields (CSV spec)
  const [species, setSpecies] = useState('');
  const [treeHeight, setTreeHeight] = useState('');
  
  // Optional fields (CSV spec)
  const [dbh, setDbh] = useState('');
  const [crownHeight, setCrownHeight] = useState('');
  const [crownRadius, setCrownRadius] = useState('');
  const [crownCompleteness, setCrownCompleteness] = useState('');
  const [tags, setTags] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSave = async () => {
    // Validate required fields
    if (!species.trim()) {
      Alert.alert('⚠️ Missing Info', 'Species is required');
      return;
    }

    const heightValue = parseFloat(treeHeight);
    if (!treeHeight || isNaN(heightValue) || heightValue <= 0) {
      Alert.alert('⚠️ Invalid Height', 'Tree height is required and must be greater than 0');
      return;
    }

    // Validate optional numeric fields
    if (dbh && (isNaN(parseFloat(dbh)) || parseFloat(dbh) < 0)) {
      Alert.alert('⚠️ Invalid DBH', 'DBH must be a positive number');
      return;
    }

    if (crownHeight && (isNaN(parseFloat(crownHeight)) || parseFloat(crownHeight) < 0)) {
      Alert.alert('⚠️ Invalid Crown Height', 'Crown height must be a positive number');
      return;
    }

    if (crownRadius && (isNaN(parseFloat(crownRadius)) || parseFloat(crownRadius) < 0)) {
      Alert.alert('⚠️ Invalid Crown Radius', 'Crown radius must be a positive number');
      return;
    }

    if (crownCompleteness && (isNaN(parseFloat(crownCompleteness)) || parseFloat(crownCompleteness) < 0 || parseFloat(crownCompleteness) > 1)) {
      Alert.alert('⚠️ Invalid Crown Completeness', 'Crown completeness must be between 0 and 1');
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
        '✅ Success',
        'Tree added successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error saving tree:', error);
      Alert.alert('❌ Error', 'Failed to save tree to database');
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
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="leaf" size={40} color="#00D9A5" />
            </View>
            <Text style={styles.title}>Add New Tree</Text>
            <Text style={styles.subtitle}>CSV-Compatible Data Entry</Text>
          </View>

          {/* Location Card */}
          <View style={styles.locationCard}>
            <Ionicons name="location-sharp" size={24} color="#00D9A5" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Selected Location</Text>
              <Text style={styles.locationText}>
                N: {latitude.toFixed(6)} | E: {longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          {/* Required Fields */}
          <Text style={styles.sectionTitle}>Required Information *</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="flower-outline" size={16} color="#00D9A5" /> Species *
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g., Oak, Pine, Eucalyptus"
                placeholderTextColor="#666"
                value={species}
                onChangeText={setSpecies}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="resize-outline" size={16} color="#00D9A5" /> Tree Height (m) *
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="e.g., 15.5"
                placeholderTextColor="#666"
                value={treeHeight}
                onChangeText={setTreeHeight}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Optional Fields */}
          <Text style={styles.sectionTitle}>Optional Measurements</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="ellipse-outline" size={16} color="#888" /> DBH (cm)
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder="Diameter at breast height"
                placeholderTextColor="#666"
                value={dbh}
                onChangeText={setDbh}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>Stem diameter at breast height (1.3m) in centimeters</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="arrow-up-outline" size={16} color="#888" /> Crown Height (m)
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder="Height to crown base"
                placeholderTextColor="#666"
                value={crownHeight}
                onChangeText={setCrownHeight}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>Height from ground to bottom of crown in meters</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="radio-outline" size={16} color="#888" /> Crown Radius (m)
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder="Crown radius from trunk"
                placeholderTextColor="#666"
                value={crownRadius}
                onChangeText={setCrownRadius}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>Average radius of the tree crown in meters</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="pie-chart-outline" size={16} color="#888" /> Crown Completeness (0-1)
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder="0.0 to 1.0 (1 = 100% complete)"
                placeholderTextColor="#666"
                value={crownCompleteness}
                onChangeText={setCrownCompleteness}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>Decimal value: 0 = no crown, 1 = full crown</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Ionicons name="pricetags-outline" size={16} color="#888" /> Tags
            </Text>
            <View style={[styles.inputWrapper, styles.inputOptional]}>
              <TextInput
                style={styles.input}
                placeholder="diseased;marked;boundary"
                placeholderTextColor="#666"
                value={tags}
                onChangeText={setTags}
              />
            </View>
            <Text style={styles.hint}>Separate multiple tags with semicolon (;)</Text>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Tree'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 217, 165, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 217, 165, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D9A5',
    marginBottom: 16,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
  },
  inputOptional: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    padding: 16,
    fontSize: 16,
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#00D9A5',
    flexDirection: 'row',
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#00D9A5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#555',
    shadowColor: '#000',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default AddTreeScreen;
