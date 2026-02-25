/**
 * Tree Trunk Measurement Screen
 *
 * Uses a credit card as a reference (85.6 mm × 53.98 mm, ISO/IEC 7810) to measure
 * trunk diameter at breast height via photo and tap-to-measure.
 * Formula: diameter_mm = (trunk_pixels / card_pixels) × 85.6
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CREDIT_CARD_WIDTH_MM = 85.6; // ISO/IEC 7810 ID-1 long edge

const TreeTrunkMeasurementScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params || {};
  const insets = useSafeAreaInsets();

  const [imageUri, setImageUri] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPointIndex, setSelectedPointIndex] = useState(null);
  const [calculatedDbh, setCalculatedDbh] = useState(null);
  const [calculatedCircumference, setCalculatedCircumference] = useState(null);

  const step = points.length;
  const stepLabels = [
    'Tap left end of credit card (horizontal edge)',
    'Tap right end of credit card (same horizontal edge)',
    'Tap left edge of trunk at breast height',
    'Tap right edge of trunk (same horizontal line)',
  ];

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const ok = await requestPermissions();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPoints([]);
      setCalculatedDbh(null);
      setCalculatedCircumference(null);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPoints([]);
      setCalculatedDbh(null);
      setCalculatedCircumference(null);
    }
  };

  const distance = (p1, p2) => {
    if (!p1 || !p2) return 0;
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  };

  const computeFromPoints = useCallback((pts) => {
    if (pts.length !== 4) return;
    const cardDist = distance(pts[0], pts[1]);
    const trunkDist = distance(pts[2], pts[3]);
    if (cardDist < 5) {
      Alert.alert('Invalid reference', 'Credit card taps too close. Tap the two ends of the card\'s long edge.');
      return;
    }
    if (trunkDist < 5) {
      Alert.alert('Invalid measurement', 'Trunk edge taps too close. Tap the left and right edges of the trunk.');
      return;
    }
    const diameterMm = (trunkDist / cardDist) * CREDIT_CARD_WIDTH_MM;
    const diameterCm = diameterMm / 10;
    const circumferenceCm = Math.PI * diameterCm;
    const dbhRounded = Math.round(diameterCm * 10) / 10;
    const circRounded = Math.round(circumferenceCm * 10) / 10;
    if (dbhRounded <= 0 || dbhRounded > 500) {
      Alert.alert('Unusual result', `DBH ${dbhRounded} cm seems wrong. Check that card and trunk taps are correct.`);
    }
    setCalculatedDbh(dbhRounded);
    setCalculatedCircumference(circRounded);
  }, []);

  const handleImagePress = (event) => {
    if (!imageUri) return;
    const { locationX, locationY } = event.nativeEvent;

    if (selectedPointIndex !== null) {
      const newPoints = [...points];
      newPoints[selectedPointIndex] = { x: locationX, y: locationY };
      setPoints(newPoints);
      setSelectedPointIndex(null);
      setCalculatedDbh(null);
      setCalculatedCircumference(null);
      if (newPoints.length === 4) computeFromPoints(newPoints);
      return;
    }

    if (calculatedDbh !== null) return;
    const newPoints = [...points, { x: locationX, y: locationY }];
    setPoints(newPoints);

    if (newPoints.length === 4) {
      computeFromPoints(newPoints);
    }
  };

  const handleMarkerPress = (index) => {
    setSelectedPointIndex(index);
  };

  const handleReset = () => {
    setPoints([]);
    setSelectedPointIndex(null);
    setCalculatedDbh(null);
    setCalculatedCircumference(null);
  };

  const handleRetake = () => {
    setImageUri(null);
    setPoints([]);
    setCalculatedDbh(null);
    setCalculatedCircumference(null);
  };

  const handleUseDbh = () => {
    if (calculatedDbh !== null && calculatedDbh > 0) {
      navigation.navigate('AddTree', {
        latitude,
        longitude,
        measuredDbh: calculatedDbh,
      });
    }
  };

  const screenWidth = Dimensions.get('window').width - 40;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="card-outline" size={26} color="#00D9A5" />
        </View>
        <Text style={styles.headerTitle}>Measure DBH</Text>
        <Text style={styles.headerSubtitle}>
          Use a credit card (long edge 85.6 mm) at breast height as reference. Tap 4 points: card left → card right → trunk left → trunk right.
        </Text>
      </View>

      {!imageUri ? (
        <View style={styles.photoSection}>
          <Text style={styles.photoSectionLabel}>Add photo</Text>
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto} activeOpacity={0.85}>
              <View style={styles.photoButtonIcon}>
                <Ionicons name="camera" size={36} color="#00D9A5" />
              </View>
              <Text style={styles.photoButtonTitle}>Take photo</Text>
              <Text style={styles.photoButtonHint}>Trunk + card at 1.3 m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickImage} activeOpacity={0.85}>
              <View style={styles.photoButtonIcon}>
                <Ionicons name="images" size={36} color="#00D9A5" />
              </View>
              <Text style={styles.photoButtonTitle}>From library</Text>
              <Text style={styles.photoButtonHint}>Pick existing photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.stepProgress}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  i < step && styles.stepDotDone,
                  i === step && styles.stepDotActive,
                ]}
              />
            ))}
            <Text style={styles.stepProgressText}>{step < 4 ? `Step ${step + 1} of 4` : 'Done'}</Text>
          </View>

          <View style={styles.imageCard}>
            <View style={styles.imageContainer}>
              <ScrollView
                style={styles.zoomScroll}
                contentContainerStyle={styles.zoomContent}
                maximumZoomScale={5}
                minimumZoomScale={1}
                bounces={false}
                centerContent
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              >
                <Pressable style={styles.imagePressable} onPress={handleImagePress}>
                  <Image
                    source={{ uri: imageUri }}
                    style={[styles.image, { width: screenWidth }]}
                    resizeMode="contain"
                  />
                  {points.map((p, i) => (
                    <Pressable
                      key={i}
                      style={[
                        styles.pointMarkerTouch,
                        { left: p.x - 14, top: p.y - 14 },
                      ]}
                      onPress={() => handleMarkerPress(i)}
                    >
                      <View
                        style={[
                          styles.pointMarkerRing,
                          i < 2 ? styles.pointMarkerCard : styles.pointMarkerTrunk,
                          selectedPointIndex === i && styles.pointMarkerSelected,
                        ]}
                      >
                        <View style={styles.pointMarkerDot} />
                      </View>
                      <Text style={styles.pointLabel}>{i + 1}</Text>
                    </Pressable>
                  ))}
                </Pressable>
              </ScrollView>
            </View>
            <View style={styles.stepPill}>
              <Text style={styles.stepPillText} numberOfLines={3}>
                {selectedPointIndex !== null
                  ? `Point ${selectedPointIndex + 1} selected — tap on image to move it`
                  : step < 4
                    ? stepLabels[step] + (points.length > 0 ? ' • Tap a point to move it' : '')
                    : 'All points set — tap a point to move it, or see result below'}
              </Text>
              {selectedPointIndex !== null && (
                <TouchableOpacity
                  style={styles.deselectButton}
                  onPress={() => setSelectedPointIndex(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deselectButtonText}>Cancel move</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={20} color="#00D9A5" />
              <Text style={styles.secondaryButtonText}>Reset points</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake} activeOpacity={0.85}>
              <Ionicons name="camera-reverse-outline" size={20} color="#00D9A5" />
              <Text style={styles.secondaryButtonText}>New photo</Text>
            </TouchableOpacity>
          </View>

          {calculatedDbh !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Diameter at breast height</Text>
              <Text style={styles.resultValue}>{calculatedDbh} cm</Text>
              <Text style={styles.resultSub}>Circumference {calculatedCircumference} cm</Text>
              <TouchableOpacity style={styles.useButton} onPress={handleUseDbh} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={24} color="#000" />
                <Text style={styles.useButtonText}>Use this DBH</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf9',
  },
  content: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,217,165,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  photoSection: {
    marginBottom: 24,
  },
  photoSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 14,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,217,165,0.4)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  photoButtonIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,217,165,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoButtonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  photoButtonHint: {
    fontSize: 12,
    color: '#666',
  },
  stepProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
  },
  stepDotDone: {
    backgroundColor: '#00D9A5',
  },
  stepDotActive: {
    backgroundColor: '#00D9A5',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepProgressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginLeft: 6,
  },
  imageCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,217,165,0.25)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  imageContainer: {
    minHeight: 220,
    backgroundColor: '#f0f0f0',
  },
  zoomScroll: {
    width: '100%',
  },
  zoomContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePressable: {
    minHeight: 220,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 380,
  },
  stepPill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,217,165,0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,217,165,0.2)',
  },
  stepPillText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  deselectButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  deselectButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  pointMarkerTouch: {
    position: 'absolute',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointMarkerRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointMarkerCard: {
    backgroundColor: 'rgba(0,217,165,0.4)',
    borderColor: '#00D9A5',
  },
  pointMarkerTrunk: {
    backgroundColor: 'rgba(5,150,105,0.4)',
    borderColor: '#059669',
  },
  pointMarkerSelected: {
    borderWidth: 2.5,
    borderColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 2 },
      android: { elevation: 6 },
    }),
  },
  pointMarkerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#fff',
  },
  pointLabel: {
    position: 'absolute',
    top: -10,
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#00D9A5',
    gap: 8,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00D9A5',
  },
  resultCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,217,165,0.3)',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  resultLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: 40,
    fontWeight: '800',
    color: '#00D9A5',
    marginBottom: 6,
  },
  resultSub: {
    fontSize: 15,
    color: '#444',
    marginBottom: 20,
    fontWeight: '600',
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    gap: 10,
  },
  useButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
});

export default TreeTrunkMeasurementScreen;
