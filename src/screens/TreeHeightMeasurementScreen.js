/**
 * Tree Height Measurement Screen
 *
 * Uses the device accelerometer as a clinometer to measure tree height
 * via trigonometry: height = distance × tan(angle) + eye_height
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';

const TreeHeightMeasurementScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params;

  const [angleLocked, setAngleLocked] = useState(false);
  const [lockedAngle, setLockedAngle] = useState(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [distance, setDistance] = useState('');
  const [eyeHeight, setEyeHeight] = useState('1.6');
  const [calculatedHeight, setCalculatedHeight] = useState(null);

  useEffect(() => {
    // Request faster updates for responsive clinometer
    Accelerometer.setUpdateInterval(50);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (angleLocked) return;

      // Calculate elevation angle from horizontal (in degrees)
      // Phone held in portrait: y-axis points to top of screen
      // When tilted up to sight treetop, we get the angle above horizontal
      const yClamped = Math.max(-1, Math.min(1, -y));
      const angleFromVertical = Math.acos(yClamped);
      const elevationRad = Math.PI / 2 - angleFromVertical;
      const elevationDeg = (elevationRad * 180) / Math.PI;
      setCurrentAngle(elevationDeg);
    });

    return () => subscription.remove();
  }, [angleLocked]);

  const handleLockAngle = () => {
    setAngleLocked(true);
    setLockedAngle(currentAngle);
    setCalculatedHeight(null);
  };

  const handleReset = () => {
    setAngleLocked(false);
    setLockedAngle(null);
    setCalculatedHeight(null);
    setDistance('');
  };

  const handleCalculate = () => {
    const dist = parseFloat(distance);
    const eye = parseFloat(eyeHeight) || 1.6;

    if (!dist || dist <= 0) {
      Alert.alert('Invalid Distance', 'Please enter a valid distance in meters');
      return;
    }

    const angleToUse = angleLocked ? lockedAngle : currentAngle;
    const angleRad = (angleToUse * Math.PI) / 180;

    // height = distance × tan(angle) + eye_height
    const heightAboveEye = dist * Math.tan(angleRad);
    const totalHeight = heightAboveEye + eye;

    if (totalHeight < 0 || totalHeight > 100) {
      Alert.alert(
        'Unusual Result',
        `Calculated height: ${totalHeight.toFixed(1)} m. This may be due to an incorrect angle or distance.`
      );
    }

    setCalculatedHeight(totalHeight);
  };

  const handleUseHeight = () => {
    if (calculatedHeight !== null && calculatedHeight > 0) {
      navigation.navigate('AddTree', {
        latitude,
        longitude,
        measuredHeight: Math.round(calculatedHeight * 10) / 10,
      });
    } else {
      Alert.alert('No Height', 'Calculate a height first');
    }
  };

  const angleToUse = angleLocked ? lockedAngle : currentAngle;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Ionicons name="information-circle" size={24} color="#00D9A5" />
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>How to measure</Text>
          <Text style={styles.instructionBody}>
            1. Stand at a known distance from the tree{'\n'}
            2. Hold your phone vertically and tilt it up to sight the treetop{'\n'}
            3. Tap "Lock Angle" when aligned{'\n'}
            4. Enter distance and eye height, then calculate
          </Text>
        </View>
      </View>

      {/* Clinometer display */}
      <View style={styles.clinometerCard}>
        <Text style={styles.clinometerLabel}>Elevation angle</Text>
        <Text style={styles.clinometerValue}>
          {angleToUse.toFixed(1)}°
        </Text>
        <Text style={styles.clinometerHint}>
          {angleLocked ? 'Angle locked' : 'Tilt phone to sight treetop'}
        </Text>
        <TouchableOpacity
          style={[styles.lockButton, angleLocked && styles.lockButtonActive]}
          onPress={handleLockAngle}
        >
          <Ionicons
            name={angleLocked ? 'lock-closed' : 'lock-open'}
            size={20}
            color="#fff"
          />
          <Text style={styles.lockButtonText}>
            {angleLocked ? 'Angle locked' : 'Lock angle'}
          </Text>
        </TouchableOpacity>
        {angleLocked && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inputs */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Distance to tree (m) *</Text>
        <TextInput
          style={styles.input}
          value={distance}
          onChangeText={setDistance}
          placeholder="e.g. 15"
          placeholderTextColor="#888"
          keyboardType="decimal-pad"
          editable={angleLocked}
        />
        <Text style={styles.hint}>Horizontal distance from you to the tree base</Text>

        <Text style={[styles.inputLabel, { marginTop: 16 }]}>Eye height (m)</Text>
        <TextInput
          style={styles.input}
          value={eyeHeight}
          onChangeText={setEyeHeight}
          placeholder="1.6"
          placeholderTextColor="#888"
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>Height of your eye above ground (default 1.6m)</Text>
      </View>

      {/* Calculate button */}
      <TouchableOpacity
        style={[styles.calculateButton, !angleLocked && styles.buttonDisabled]}
        onPress={handleCalculate}
        disabled={!angleLocked}
      >
        <Ionicons name="calculator" size={22} color="#000" />
        <Text style={styles.calculateButtonText}>Calculate height</Text>
      </TouchableOpacity>

      {/* Result */}
      {calculatedHeight !== null && (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Estimated tree height</Text>
          <Text style={styles.resultValue}>{calculatedHeight.toFixed(1)} m</Text>
          <TouchableOpacity style={styles.useButton} onPress={handleUseHeight}>
            <Ionicons name="checkmark-circle" size={24} color="#000" />
            <Text style={styles.useButtonText}>Use this height</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  instructionCard: {
    flexDirection: 'row',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00D9A5',
  },
  instructionText: {
    flex: 1,
    marginLeft: 12,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  instructionBody: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  clinometerCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#00D9A5',
    alignItems: 'center',
  },
  clinometerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  clinometerValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#00D9A5',
  },
  clinometerHint: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    marginBottom: 16,
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  lockButtonActive: {
    backgroundColor: '#059669',
  },
  lockButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  resetButton: {
    marginTop: 12,
  },
  resetButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#00D9A5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#bbb',
    opacity: 0.7,
  },
  calculateButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  resultCard: {
    marginTop: 24,
    backgroundColor: '#f0fdf4',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00D9A5',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00D9A5',
    marginBottom: 16,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  useButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});

export default TreeHeightMeasurementScreen;
