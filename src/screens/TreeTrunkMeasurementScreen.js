/**
 * Tree Trunk Measurement Screen
 *
 * Uses a credit card as a reference (85.6 mm × 53.98 mm, ISO/IEC 7810) to measure
 * trunk diameter at breast height via photo and tap-to-measure.
 * Formula: diameter_mm = (trunk_pixels / card_pixels) × 85.6
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

const CREDIT_CARD_WIDTH_MM = 85.6; // ISO/IEC 7810 ID-1 long edge

const TreeTrunkMeasurementScreen = ({ route, navigation }) => {
  const { latitude, longitude } = route.params || {};

  const [imageUri, setImageUri] = useState(null);
  const [points, setPoints] = useState([]);
  const [calculatedDbh, setCalculatedDbh] = useState(null);
  const [calculatedCircumference, setCalculatedCircumference] = useState(null);

  const step = points.length;
  const stepLabels = [
    'Tap first end of credit card',
    'Tap second end of credit card (along the long edge)',
    'Tap left edge of trunk at breast height',
    'Tap right edge of trunk',
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

  const handleImagePress = (event) => {
    if (calculatedDbh !== null || !imageUri) return;
    const { locationX, locationY } = event.nativeEvent;
    const newPoints = [...points, { x: locationX, y: locationY }];
    setPoints(newPoints);

    if (newPoints.length === 4) {
      const cardDist = distance(newPoints[0], newPoints[1]);
      const trunkDist = distance(newPoints[2], newPoints[3]);
      if (cardDist < 5) {
        Alert.alert('Invalid reference', 'Credit card taps too close. Please retake and tap both ends.');
        setPoints([]);
        return;
      }
      // diameter_mm = (trunk_px / card_px) * 85.6
      const diameterMm = (trunkDist / cardDist) * CREDIT_CARD_WIDTH_MM;
      const diameterCm = diameterMm / 10;
      const circumferenceCm = Math.PI * diameterCm;
      setCalculatedDbh(Math.round(diameterCm * 10) / 10);
      setCalculatedCircumference(Math.round(circumferenceCm * 10) / 10);
    }
  };

  const handleReset = () => {
    setPoints([]);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Ionicons name="card-outline" size={28} color="#00D9A5" />
        <View style={styles.instructionText}>
          <Text style={styles.instructionTitle}>Credit card reference</Text>
          <Text style={styles.instructionBody}>
            Take a photo of the trunk at breast height (1.3 m) with a credit card held flat against it. Use the long edge of the card (85.6 mm) as reference.
          </Text>
        </View>
      </View>

      {!imageUri ? (
        <View style={styles.photoButtons}>
          <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
            <Ionicons name="camera" size={32} color="#00D9A5" />
            <Text style={styles.photoButtonText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={handlePickImage}>
            <Ionicons name="images" size={32} color="#00D9A5" />
            <Text style={styles.photoButtonText}>Choose from library</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.imageContainer}>
            <Pressable
              style={styles.imagePressable}
              onPress={handleImagePress}
            >
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { width: screenWidth }]}
                resizeMode="contain"
              />
              {points.map((p, i) => (
                <View
                  key={i}
                  style={[
                    styles.pointMarker,
                    {
                      left: p.x - 12,
                      top: p.y - 12,
                    },
                  ]}
                >
                  <Text style={styles.pointLabel}>{i + 1}</Text>
                </View>
              ))}
            </Pressable>
          </View>

          <Text style={styles.stepLabel}>
            {step < 4 ? stepLabels[step] : 'All points set'}
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>Reset points</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake}>
              <Text style={styles.secondaryButtonText}>Retake photo</Text>
            </TouchableOpacity>
          </View>

          {calculatedDbh !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Diameter (DBH)</Text>
              <Text style={styles.resultValue}>{calculatedDbh} cm</Text>
              <Text style={styles.resultSub}>Circumference: {calculatedCircumference} cm</Text>
              <TouchableOpacity style={styles.useButton} onPress={handleUseDbh}>
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
  photoButtons: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 20,
  },
  photoButton: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00D9A5',
  },
  photoButtonText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#00D9A5',
  },
  imageContainer: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePressable: {
    minHeight: 200,
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 400,
  },
  pointMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00D9A5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointLabel: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
  },
  stepLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00D9A5',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00D9A5',
  },
  resultCard: {
    marginTop: 8,
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
    marginBottom: 4,
  },
  resultSub: {
    fontSize: 14,
    color: '#333',
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

export default TreeTrunkMeasurementScreen;
