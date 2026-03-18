import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Alert, ScrollView, Dimensions, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from '../utils/useTranslation';

const CREDIT_CARD_WIDTH_MM = 85.6;

const TreeTrunkMeasurementScreen = ({ route, navigation }) => {
  const { latitude, longitude, returnTo, treeIndex } = route.params || {};
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [imageUri,              setImageUri]              = useState(null);
  const [points,                setPoints]                = useState([]);
  const [selectedPointIndex,    setSelectedPointIndex]    = useState(null);
  const [calculatedDbh,         setCalculatedDbh]         = useState(null);
  const [calculatedCircumference, setCalculatedCircumference] = useState(null);

  const step = points.length;
  const stepLabels = t('trunkMeasure.stepLabels'); // returns the array from translations

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('trunkMeasure.permissionNeeded'), t('trunkMeasure.cameraPermissionBody'));
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    if (!(await requestPermissions())) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPoints([]); setCalculatedDbh(null); setCalculatedCircumference(null);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPoints([]); setCalculatedDbh(null); setCalculatedCircumference(null);
    }
  };

  const distance = (p1, p2) => {
    if (!p1 || !p2) return 0;
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  };

  const computeFromPoints = useCallback((pts) => {
    if (pts.length !== 4) return;
    const cardDist  = distance(pts[0], pts[1]);
    const trunkDist = distance(pts[2], pts[3]);
    if (cardDist < 5)  { Alert.alert(t('trunkMeasure.invalidReference'),  t('trunkMeasure.invalidReferenceBody'));  return; }
    if (trunkDist < 5) { Alert.alert(t('trunkMeasure.invalidMeasurement'), t('trunkMeasure.invalidMeasurementBody')); return; }
    const diameterMm  = (trunkDist / cardDist) * CREDIT_CARD_WIDTH_MM;
    const diameterCm  = diameterMm / 10;
    const dbhRounded  = Math.round(diameterCm * 10) / 10;
    const circRounded = Math.round(Math.PI * diameterCm * 10) / 10;
    if (dbhRounded <= 0 || dbhRounded > 500) {
      Alert.alert(t('trunkMeasure.unusualResult'), t('trunkMeasure.unusualResultBody')(dbhRounded));
    }
    setCalculatedDbh(dbhRounded);
    setCalculatedCircumference(circRounded);
  }, [t]);

  const handleImagePress = (event) => {
    if (!imageUri) return;
    const { locationX, locationY } = event.nativeEvent;

    if (selectedPointIndex !== null) {
      const newPoints = [...points];
      newPoints[selectedPointIndex] = { x: locationX, y: locationY };
      setPoints(newPoints);
      setSelectedPointIndex(null);
      setCalculatedDbh(null); setCalculatedCircumference(null);
      if (newPoints.length === 4) computeFromPoints(newPoints);
      return;
    }
    if (calculatedDbh !== null) return;
    const newPoints = [...points, { x: locationX, y: locationY }];
    setPoints(newPoints);
    if (newPoints.length === 4) computeFromPoints(newPoints);
  };

  const handleReset  = () => { setPoints([]); setSelectedPointIndex(null); setCalculatedDbh(null); setCalculatedCircumference(null); };
  const handleRetake = () => { setImageUri(null); setPoints([]); setCalculatedDbh(null); setCalculatedCircumference(null); };

  const handleUseDbh = () => {
    if (calculatedDbh != null && calculatedDbh > 0) {
      if (returnTo === 'PatternMatch' && typeof treeIndex === 'number') {
        navigation.navigate({
          name: 'PatternMatch',
          params: { measuredDbh: calculatedDbh, treeIndex },
          merge: true,
        });
        return;
      }

      navigation.navigate('AddTree', { latitude, longitude, measuredDbh: calculatedDbh });
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
        <View style={styles.headerIcon}><Ionicons name="card-outline" size={26} color="#00D9A5" /></View>
        <Text style={styles.headerTitle}>{t('trunkMeasure.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('trunkMeasure.subtitle')}</Text>
      </View>

      {!imageUri ? (
        <View style={styles.photoSection}>
          <Text style={styles.photoSectionLabel}>{t('trunkMeasure.addPhoto')}</Text>
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto} activeOpacity={0.85}>
              <View style={styles.photoButtonIcon}><Ionicons name="camera" size={36} color="#00D9A5" /></View>
              <Text style={styles.photoButtonTitle}>{t('trunkMeasure.takePhoto')}</Text>
              <Text style={styles.photoButtonHint}>{t('trunkMeasure.takePhotoHint')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={handlePickImage} activeOpacity={0.85}>
              <View style={styles.photoButtonIcon}><Ionicons name="images" size={36} color="#00D9A5" /></View>
              <Text style={styles.photoButtonTitle}>{t('trunkMeasure.fromLibrary')}</Text>
              <Text style={styles.photoButtonHint}>{t('trunkMeasure.fromLibraryHint')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.stepProgress}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.stepDot, i < step && styles.stepDotDone, i === step && styles.stepDotActive]} />
            ))}
            <Text style={styles.stepProgressText}>{step < 4 ? t('trunkMeasure.step')(step + 1) : t('trunkMeasure.allDone')}</Text>
          </View>

          <View style={styles.imageCard}>
            <View style={styles.imageContainer}>
              <ScrollView style={styles.zoomScroll} contentContainerStyle={styles.zoomContent} maximumZoomScale={5} minimumZoomScale={1} bounces={false} centerContent showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                <Pressable style={styles.imagePressable} onPress={handleImagePress}>
                  <Image source={{ uri: imageUri }} style={[styles.image, { width: screenWidth }]} resizeMode="contain" />
                  {points.map((p, i) => (
                    <Pressable key={i} style={[styles.pointMarkerTouch, { left: p.x - 14, top: p.y - 14 }]} onPress={() => setSelectedPointIndex(i)}>
                      <View style={[styles.pointMarkerRing, i < 2 ? styles.pointMarkerCard : styles.pointMarkerTrunk, selectedPointIndex === i && styles.pointMarkerSelected]}>
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
                  ? t('trunkMeasure.movePoint')(selectedPointIndex + 1)
                  : step < 4
                    ? stepLabels[step] + (points.length > 0 ? t('trunkMeasure.tapToMove') : '')
                    : t('trunkMeasure.allPointsSet')}
              </Text>
              {selectedPointIndex !== null && (
                <TouchableOpacity style={styles.deselectButton} onPress={() => setSelectedPointIndex(null)} activeOpacity={0.8}>
                  <Text style={styles.deselectButtonText}>{t('trunkMeasure.cancelMove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset} activeOpacity={0.85}>
              <Ionicons name="refresh-outline" size={20} color="#00D9A5" />
              <Text style={styles.secondaryButtonText}>{t('trunkMeasure.resetPoints')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleRetake} activeOpacity={0.85}>
              <Ionicons name="camera-reverse-outline" size={20} color="#00D9A5" />
              <Text style={styles.secondaryButtonText}>{t('trunkMeasure.newPhoto')}</Text>
            </TouchableOpacity>
          </View>

          {calculatedDbh !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>{t('trunkMeasure.dbhResult')}</Text>
              <Text style={styles.resultValue}>{calculatedDbh} cm</Text>
              <Text style={styles.resultSub}>{t('trunkMeasure.circumference')(calculatedCircumference)}</Text>
              <TouchableOpacity style={styles.useButton} onPress={handleUseDbh} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={24} color="#000" />
                <Text style={styles.useButtonText}>{t('trunkMeasure.useDbh')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf9' },
  content: { paddingHorizontal: 20 },
  header: { marginBottom: 24 },
  headerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,217,165,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#000', marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: '#555', lineHeight: 20 },
  photoSection: { marginBottom: 24 },
  photoSectionLabel: { fontSize: 13, fontWeight: '700', color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  photoButtons: { flexDirection: 'row', gap: 14 },
  photoButton: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(0,217,165,0.4)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }) },
  photoButtonIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,217,165,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  photoButtonTitle: { fontSize: 16, fontWeight: '800', color: '#000', marginBottom: 4 },
  photoButtonHint: { fontSize: 12, color: '#666' },
  stepProgress: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  stepDotDone: { backgroundColor: '#00D9A5' },
  stepDotActive: { backgroundColor: '#00D9A5', width: 10, height: 10, borderRadius: 5 },
  stepProgressText: { fontSize: 13, fontWeight: '700', color: '#555', marginLeft: 6 },
  imageCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(0,217,165,0.25)', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }) },
  imageContainer: { minHeight: 220, backgroundColor: '#f0f0f0' },
  zoomScroll: { width: '100%' },
  zoomContent: { alignItems: 'center', justifyContent: 'center' },
  imagePressable: { minHeight: 220 },
  image: { width: '100%', aspectRatio: 4 / 3, maxHeight: 380 },
  stepPill: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(0,217,165,0.08)', borderTopWidth: 1, borderTopColor: 'rgba(0,217,165,0.2)' },
  stepPillText: { fontSize: 14, color: '#333', fontWeight: '600', textAlign: 'center' },
  deselectButton: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'center' },
  deselectButtonText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  pointMarkerTouch: { position: 'absolute', width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  pointMarkerRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  pointMarkerCard: { backgroundColor: 'rgba(0,217,165,0.4)', borderColor: '#00D9A5' },
  pointMarkerTrunk: { backgroundColor: 'rgba(5,150,105,0.4)', borderColor: '#059669' },
  pointMarkerSelected: { borderWidth: 2.5, borderColor: '#fff', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 2 }, android: { elevation: 6 } }) },
  pointMarkerDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#fff' },
  pointLabel: { position: 'absolute', top: -10, fontSize: 10, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  secondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#00D9A5', gap: 8, backgroundColor: '#fff' },
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: '#00D9A5' },
  resultCard: { backgroundColor: '#fff', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,217,165,0.3)', alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 3 } }) },
  resultLabel: { fontSize: 13, color: '#666', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultValue: { fontSize: 40, fontWeight: '800', color: '#00D9A5', marginBottom: 6 },
  resultSub: { fontSize: 15, color: '#444', marginBottom: 20, fontWeight: '600' },
  useButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00D9A5', paddingVertical: 16, paddingHorizontal: 28, borderRadius: 14, gap: 10 },
  useButtonText: { color: '#000', fontSize: 17, fontWeight: '800' },
});

export default TreeTrunkMeasurementScreen;