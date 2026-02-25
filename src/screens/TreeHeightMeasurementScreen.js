/**
 * Tree height clinometer — simple flow:
 * 1. Set distance to tree (slider).
 * 2. Point at base of tree → tap "Start".
 * 3. Tilt up to the top of the tree; height updates live.
 * 4. Tap "Done" when aimed at the top to use this height.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import * as Pitch from '../utils/pitchFromMotion';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AIM_DOT_SIZE = 10;
const DISTANCE_MIN = 1;
const DISTANCE_MAX = 80;
const DISTANCE_STEP = 0.5;

function computeTreeHeight(D, angleTopDeg, angleBaseDeg) {
  if (D <= 0 || angleTopDeg == null || angleBaseDeg == null) return null;
  const top = (angleTopDeg * Math.PI) / 180;
  const base = (angleBaseDeg * Math.PI) / 180;
  return D * (Math.tan(top) - Math.tan(base));
}

const TreeHeightMeasurementScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params;
  const insets = useSafeAreaInsets();
  const cleanupMotion = useRef(null);

  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(true);

  const [currentAngle, setCurrentAngle] = useState(0);
  const [baseAngle, setBaseAngle] = useState(null);
  const [distanceValue, setDistanceValue] = useState(10);

  const liveHeight =
    baseAngle != null && distanceValue > 0
      ? computeTreeHeight(distanceValue, currentAngle, baseAngle)
      : null;
  const displayHeight = liveHeight != null ? Math.max(0, liveHeight) : null;

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const { status } = await Camera.requestCameraPermissionsAsync();
        if (cancelled) return;
        setHasCameraPermission(status === 'granted');
      } catch (e) {
        if (!cancelled) setHasCameraPermission(false);
      } finally {
        if (!cancelled) setIsRequestingPermission(false);
      }
      cleanupMotion.current = Pitch.startPitchUpdates((deg) => setCurrentAngle(deg), {
        intervalMs: 50,
      });
    };
    setup();
    return () => {
      cancelled = true;
      if (cleanupMotion.current) cleanupMotion.current();
    };
  }, []);

  const handleStart = () => {
    setBaseAngle(Pitch.getLastPitchDegrees());
  };

  const handleStartOver = () => {
    setBaseAngle(null);
  };

  const handleCalibrate = () => {
    Pitch.setCalibrationOffset();
    setCurrentAngle(0);
    Alert.alert('Calibrated', 'Zero set. Hold phone level when you see 0°.');
  };

  const handleDone = () => {
    const h = displayHeight;
    if (h != null && h > 0) {
      navigation.navigate('AddTree', {
        latitude,
        longitude,
        measuredHeight: Math.round(h * 10) / 10,
      });
    } else {
      Alert.alert(
        'No height',
        'Point at the base and tap Start, then tilt to the top of the tree. Tap Done when aimed at the top.'
      );
    }
  };

  const isMeasuring = baseAngle != null;

  return (
    <View style={styles.container}>
      {isRequestingPermission ? (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Requesting camera…</Text>
        </View>
      ) : !hasCameraPermission ? (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera is required for the clinometer.</Text>
        </View>
      ) : (
        <>
          <CameraView style={StyleSheet.absoluteFillObject} facing="back" ratio="16:9" />

          <View
            style={[
              styles.overlay,
              {
                paddingTop: insets.top + 8,
                paddingBottom: insets.bottom + 16,
                paddingHorizontal: 20,
              },
            ]}
          >
            <View style={styles.aimContainer} pointerEvents="none">
              <View style={styles.aimDot} />
            </View>

            <View style={styles.topHud}>
              <Text style={styles.angleValue}>{currentAngle.toFixed(1)}°</Text>
              {isMeasuring && displayHeight != null && (
                <View style={styles.heightPill}>
                  <Text style={styles.heightValue}>{displayHeight.toFixed(1)} m</Text>
                  <Text style={styles.heightLabel}>height</Text>
                </View>
              )}
              <Text style={styles.hint}>
                {!isMeasuring
                  ? 'Point at base of tree, then tap Start'
                  : 'Tilt up to the top, then tap Done'}
              </Text>
              {!isMeasuring ? (
                <TouchableOpacity style={styles.primaryButton} onPress={handleStart} activeOpacity={0.85}>
                  <Ionicons name="play" size={24} color="#000" />
                  <Text style={styles.primaryButtonText}>Start</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.doneButton} onPress={handleDone} activeOpacity={0.85}>
                    <Ionicons name="checkmark-circle" size={24} color="#000" />
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleStartOver} activeOpacity={0.8}>
                    <Text style={styles.secondaryButtonText}>Start over</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.calibrateLink} onPress={handleCalibrate}>
                <Text style={styles.calibrateLinkText}>Calibrate 0°</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSheet}>
              <Text style={styles.sheetTitle}>Distance to tree</Text>
              <View style={styles.sliderRow}>
                <Text style={styles.sliderMin}>{DISTANCE_MIN}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={DISTANCE_MIN}
                  maximumValue={DISTANCE_MAX}
                  step={DISTANCE_STEP}
                  value={distanceValue}
                  onValueChange={setDistanceValue}
                  minimumTrackTintColor="#00D9A5"
                  maximumTrackTintColor="#ddd"
                  thumbTintColor="#00D9A5"
                />
                <Text style={styles.sliderMax}>{DISTANCE_MAX}</Text>
              </View>
              <Text style={styles.sliderValue}>{distanceValue.toFixed(1)} m</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#000',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  aimContainer: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - AIM_DOT_SIZE / 2,
    top: SCREEN_HEIGHT / 2 - AIM_DOT_SIZE / 2,
    width: AIM_DOT_SIZE,
    height: AIM_DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aimDot: {
    width: AIM_DOT_SIZE,
    height: AIM_DOT_SIZE,
    borderRadius: AIM_DOT_SIZE / 2,
    backgroundColor: '#00D9A5',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 2 },
      android: { elevation: 4 },
    }),
  },
  topHud: {
    alignItems: 'center',
  },
  angleValue: {
    fontSize: 42,
    fontWeight: '800',
    color: '#00D9A5',
    letterSpacing: 0.5,
  },
  heightPill: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  heightValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00D9A5',
  },
  heightLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  hint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    gap: 10,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
  },
  doneButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '700',
  },
  calibrateLink: {
    marginTop: 20,
    padding: 8,
  },
  calibrateLinkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,217,165,0.3)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  slider: {
    flex: 1,
    height: 36,
  },
  sliderMin: {
    fontSize: 12,
    color: '#666',
    width: 24,
    textAlign: 'left',
  },
  sliderMax: {
    fontSize: 12,
    color: '#666',
    width: 24,
    textAlign: 'right',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00D9A5',
  },
});

export default TreeHeightMeasurementScreen;
export { computeTreeHeight };
