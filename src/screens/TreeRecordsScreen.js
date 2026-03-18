import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTreeById, getTreeVersions } from '../database/db';
import { useTranslation } from '../utils/useTranslation';

const TreeRecordsScreen = ({ route, navigation }) => {
  const { treeId } = route.params || {};
  const { t } = useTranslation();

  const [originalTree, setOriginalTree] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const tree = await getTreeById(treeId);
        const vers = await getTreeVersions(treeId);
        if (cancelled) return;
        setOriginalTree(tree);
        setVersions(vers);
      } catch {
        Alert.alert(t('records.error'), t('records.failedLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [treeId, t]);

  const records = useMemo(() => {
    const list = [];
    if (originalTree) {
      list.push({ key: 'original', recordType: 'original', versionNumber: null, ...originalTree });
    }

    versions.forEach(v => {
      list.push({
        key: `v-${v.version_number}`,
        recordType: 'version',
        versionNumber: Number(v.version_number),
        ...v,
      });
    });

    return list;
  }, [originalTree, versions]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>{t('records.loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={40} color="#00D9A5" />
        </View>
        <Text style={styles.title}>{t('records.title')}</Text>
        <Text style={styles.subtitle}>Tree ID: {treeId}</Text>
      </View>

      {records.map(r => {
        const isOriginal = r.recordType === 'original';
        return (
          <View key={r.key} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>
                {isOriginal ? t('records.original') : t('records.editVersion')(r.versionNumber)}
              </Text>
              <Text style={styles.cardDate}>{r.date}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('treeDetail.treeHeight')}: </Text>
              <Text style={styles.summaryValue}>{r.tree_height} {t('treeDetail.meters')}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('treeDetail.dbh')}: </Text>
              <Text style={styles.summaryValue}>{r.dbh != null ? `${r.dbh} cm` : 'N/A'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('treeDetail.crownHeight')}: </Text>
              <Text style={styles.summaryValue}>{r.crown_height != null ? `${r.crown_height} m` : 'N/A'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('treeDetail.crownRadius')}: </Text>
              <Text style={styles.summaryValue}>{r.crown_radius != null ? `${r.crown_radius} m` : 'N/A'}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t('treeDetail.tags')}: </Text>
              <Text style={styles.summaryValue}>{r.tags || 'N/A'}</Text>
            </View>

            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigation.navigate('TreeDetail', { treeId, versionNumber: isOriginal ? null : r.versionNumber })}
            >
              <Ionicons name="eye-outline" size={18} color="#000" />
              <Text style={styles.viewButtonText}>{t('records.viewRecord')}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

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

  header: { alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 217, 165, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0, 217, 165, 0.3)' },
  title: { fontSize: 24, fontWeight: '900', color: '#222', marginTop: 14 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 6 },

  card: { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#00D9A5' },
  cardDate: { fontSize: 12, color: '#888', fontWeight: '700' },

  summaryRow: { flexDirection: 'row', marginBottom: 8 },
  summaryLabel: { fontSize: 12, color: '#888', fontWeight: '800', width: 110 },
  summaryValue: { fontSize: 13, color: '#222', fontWeight: '600', flex: 1 },

  viewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00D9A5', paddingVertical: 12, borderRadius: 14, marginTop: 10, gap: 8 },
  viewButtonText: { fontSize: 14, fontWeight: '900', color: '#000' },

  backButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 217, 165, 0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)', marginTop: 10 },
  backButtonText: { color: '#00D9A5', fontSize: 16, fontWeight: '700', marginLeft: 10 },
});

export default TreeRecordsScreen;

