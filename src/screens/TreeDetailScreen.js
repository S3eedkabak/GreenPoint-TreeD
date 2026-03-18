import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTreeById, getTreeVersions } from '../database/db';
import { useTranslation } from '../utils/useTranslation';

const TreeDetailScreen = ({ route, navigation }) => {
  const { treeId, versionNumber: routeVersionNumber } = route.params || {};
  const { t } = useTranslation();
  const [originalTree, setOriginalTree] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadTreeData = async () => {
      try {
        const tree = await getTreeById(treeId);
        const vers = await getTreeVersions(treeId);

        if (cancelled) return;
        setOriginalTree(tree);
        setVersions(vers);

        // If caller requests a specific record, respect it.
        // `versionNumber` maps to `tree_versions.version_number`.
        // Pass `null` / `0` / `'original'` for the original record.
        if (routeVersionNumber !== undefined) {
          const normalized =
            routeVersionNumber === null
            || routeVersionNumber === 0
            || routeVersionNumber === '0'
            || routeVersionNumber === 'original'
              ? null
              : Number(routeVersionNumber);

          setSelectedVersionNumber(Number.isNaN(normalized) ? null : normalized);
        } else {
          // Default behavior: show latest edit if it exists, otherwise original.
          setSelectedVersionNumber(vers.length > 0 ? Number(vers[0].version_number) : null);
        }
      } catch {
        Alert.alert(t('treeDetail.error'), t('treeDetail.failedLoad'));
      }
    };

    // Refresh when coming back from edit/version screens.
    const unsubscribe = navigation.addListener('focus', loadTreeData);
    loadTreeData();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [treeId, navigation, t]);

  const isPreFilled = (value) => value && typeof value === 'string' && value.startsWith('auto:');

  const selectedVersion = selectedVersionNumber != null
    ? versions.find(v => Number(v.version_number) === Number(selectedVersionNumber)) || null
    : null;

  const displayTree = selectedVersion || originalTree;

  if (!displayTree) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('treeDetail.loading')}</Text>
      </View>
    );
  }

  const unmatchedStyle = displayTree.unmatched ? styles.unmatchedBackground : {};

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="leaf" size={40} color="#00D9A5" />
        </View>
        <Text style={styles.speciesName}>{displayTree.species}</Text>
        <Text style={styles.subtitle}>Tree ID: {displayTree.tree_id}</Text>
      </View>

      <View style={[styles.card, unmatchedStyle]}>
        <Text style={styles.cardTitle}>{t('treeDetail.treeProperties')}</Text>

        {versions.length > 0 && (
          <View style={styles.versionChooser}>
            <Text style={styles.versionChooserTitle}>{t('treeDetail.versions')}</Text>

            <View style={styles.versionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.versionButton,
                  selectedVersionNumber == null && styles.versionButtonActive,
                ]}
                onPress={() => setSelectedVersionNumber(null)}
              >
                <Text
                  style={[
                    styles.versionButtonText,
                    selectedVersionNumber == null && styles.versionButtonTextActive,
                  ]}
                >
                  {t('treeDetail.originalVersion')}
                </Text>
              </TouchableOpacity>

              {versions.map(v => (
                <TouchableOpacity
                  key={v.version_number}
                  style={[
                    styles.versionButton,
                    Number(selectedVersionNumber) === Number(v.version_number) && styles.versionButtonActive,
                  ]}
                  onPress={() => setSelectedVersionNumber(Number(v.version_number))}
                >
                  <Text
                    style={[
                      styles.versionButtonText,
                      Number(selectedVersionNumber) === Number(v.version_number) && styles.versionButtonTextActive,
                    ]}
                  >
                    {t('treeDetail.editVersion')(v.version_number)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}><Ionicons name="resize-outline" size={20} color="#00D9A5" /></View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>{t('treeDetail.treeHeight')}</Text>
            <Text style={[styles.propertyValue, isPreFilled(displayTree.tree_height) && styles.prefilledText]}>
              {displayTree.tree_height} {t('treeDetail.meters')}
            </Text>
          </View>
        </View>

        {displayTree.dbh && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="ellipse-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.dbh')}</Text>
              <Text style={styles.propertyValue}>{displayTree.dbh} cm</Text>
            </View>
          </View>
        )}

        {displayTree.crown_height && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="arrow-up-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.crownHeight')}</Text>
              <Text style={styles.propertyValue}>{displayTree.crown_height} m</Text>
            </View>
          </View>
        )}

        {displayTree.crown_radius && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="radio-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.crownRadius')}</Text>
              <Text style={styles.propertyValue}>{displayTree.crown_radius} m</Text>
            </View>
          </View>
        )}

        {displayTree.crown_completeness !== null && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="pie-chart-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.crownCompleteness')}</Text>
              <Text style={styles.propertyValue}>{displayTree.crown_completeness}</Text>
            </View>
          </View>
        )}

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}><Ionicons name="location-outline" size={20} color="#00D9A5" /></View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>{t('treeDetail.northing')}</Text>
            <Text style={styles.propertyValue}>{displayTree.northing.toFixed(6)}</Text>
          </View>
        </View>

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}><Ionicons name="location-outline" size={20} color="#00D9A5" /></View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>{t('treeDetail.easting')}</Text>
            <Text style={styles.propertyValue}>{displayTree.easting.toFixed(6)}</Text>
          </View>
        </View>

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}><Ionicons name="calendar-outline" size={20} color="#00D9A5" /></View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>{t('treeDetail.dateRecorded')}</Text>
            <Text style={styles.propertyValue}>{displayTree.date}</Text>
          </View>
        </View>

        {displayTree.tags && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="pricetags-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.tags')}</Text>
              <Text style={styles.propertyValue}>{displayTree.tags}</Text>
            </View>
          </View>
        )}

        {displayTree.synced === 1 && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="cloud-done-outline" size={20} color="#00D9A5" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.cloudStatus')}</Text>
              <Text style={[styles.propertyValue, styles.syncedText]}>{t('treeDetail.synced')}</Text>
            </View>
          </View>
        )}

        {displayTree.synced === 0 && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}><Ionicons name="cloud-offline-outline" size={20} color="#FF6B6B" /></View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>{t('treeDetail.cloudStatus')}</Text>
              <Text style={[styles.propertyValue, styles.unsyncedText]}>{t('treeDetail.notSynced')}</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => navigation.navigate('EditTree', { treeId })}
      >
        <Ionicons name="create-outline" size={24} color="#00D9A5" />
        <Text style={styles.editButtonText}>{t('treeDetail.editProperties')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.recordsButton}
        onPress={() => navigation.navigate('TreeRecords', { treeId })}
      >
        <Ionicons name="time-outline" size={24} color="#00D9A5" />
        <Text style={styles.recordsButtonText}>{t('treeDetail.viewRecords')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back-circle" size={24} color="#00D9A5" />
        <Text style={styles.backButtonText}>{t('treeDetail.backToMap')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { color: '#222', fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 30 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 217, 165, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 2, borderColor: 'rgba(0, 217, 165, 0.3)' },
  speciesName: { fontSize: 28, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 5 },
  card: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#00D9A5', marginBottom: 20 },
  versionChooser: { marginBottom: 14 },
  versionChooserTitle: { fontSize: 12, color: '#888', textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  versionButtonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  versionButton: {
    backgroundColor: 'rgba(0, 217, 165, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  versionButtonActive: { backgroundColor: 'rgba(0, 217, 165, 0.25)', borderColor: 'rgba(0, 217, 165, 0.55)' },
  versionButtonText: { color: '#00D9A5', fontSize: 12, fontWeight: '800' },
  versionButtonTextActive: { color: '#000' },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 217, 165, 0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)', marginTop: 10 },
  editButtonText: { color: '#00D9A5', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  recordsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 217, 165, 0.06)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)', marginTop: 10 },
  recordsButtonText: { color: '#00D9A5', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' },
  propertyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 217, 165, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  propertyContent: { flex: 1 },
  propertyLabel: { fontSize: 12, color: '#888', marginBottom: 4, textTransform: 'uppercase', fontWeight: '600' },
  propertyValue: { fontSize: 16, color: '#222', fontWeight: '600' },
  syncedText: { color: '#00D9A5' },
  unsyncedText: { color: '#FF6B6B' },
  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 217, 165, 0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)', marginTop: 10 },
  backButtonText: { color: '#00D9A5', fontSize: 16, fontWeight: '700', marginLeft: 10 },
  prefilledText: { color: '#FFA500', fontStyle: 'italic' },
  unmatchedBackground: { backgroundColor: '#FFEBEE' },
});

export default TreeDetailScreen;