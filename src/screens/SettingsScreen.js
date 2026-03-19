import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getAllTrees, getTreeCount, syncUnsyncedTrees, exportToCSV, importFromCSV } from '../database/db';
import { useTranslation } from '../utils/useTranslation';

const SettingsScreen = ({ navigation }) => {
  const { t, language, toggleLanguage } = useTranslation();
  const [treeCount, setTreeCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  useEffect(() => {
    loadTreeCount();
  }, []);

  const loadTreeCount = async () => {
    try {
      const count = await getTreeCount();
      setTreeCount(count);
      if (process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true') {
        const trees = await getAllTrees();
        setUnsyncedCount(trees.filter(tr => tr.synced === 0).length);
      }
    } catch (error) {
      console.error('Error loading tree count:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncUnsyncedTrees();
      if (result.synced > 0) {
        Alert.alert(t('settings.syncComplete'), t('settings.syncedCount')(result.synced));
        loadTreeCount();
      } else {
        Alert.alert('Info', result.message);
      }
    } catch (error) {
      Alert.alert(t('settings.syncFailed'), t('settings.syncNoInternet'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const count = await getTreeCount();
      if (count === 0) {
        Alert.alert(t('settings.noData'), t('settings.noDataBody'));
        setIsExporting(false);
        return;
      }
      const csvContent = await exportToCSV();
      const timestamp = new Date().toISOString().split('T')[0];
      const fileUri = FileSystem.documentDirectory + `trees_${timestamp}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: 'utf8' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert(t('settings.exportComplete'), t('settings.exportSaved')(fileUri));
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert(t('settings.exportFailed'), t('settings.exportError')(error.message));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      setIsImporting(true);
      setImportProgress(null);

      const fileUri = result.assets[0].uri;
      const csvContent = await FileSystem.readAsStringAsync(fileUri, { encoding: 'utf8' });

      const importResult = await importFromCSV(csvContent, ({ processed, total }) => {
        setImportProgress({ processed, total });
      });

      let message = t('settings.importComplete');
      message += t('settings.importedCount')(importResult.imported);
      message += t('settings.totalRows')(importResult.total);
      if (importResult.errors > 0) {
        message += t('settings.errorsCount')(importResult.errors);
        message += t('settings.errorDetails');
        message += importResult.errorDetails.slice(0, 5).join('\n');
        if (importResult.errorDetails.length > 5) {
          message += t('settings.moreErrors')(importResult.errorDetails.length - 5);
        }
      }
      Alert.alert(t('settings.importResults'), message, [
        { text: t('common.ok'), onPress: () => loadTreeCount() },
      ]);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert(t('settings.importFailed'), t('settings.importError')(error.message));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const MenuItem = ({ icon, title, subtitle, onPress, color = '#00D9A5', danger = false, badge = null, disabled = false, rightElement = null }) => (
    <TouchableOpacity
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={disabled ? '#666' : (danger ? '#FF6B6B' : color)} />
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuTitleRow}>
          <Text style={[styles.menuTitle, danger && { color: '#FF6B6B' }, disabled && { color: '#666' }]}>
            {title}
          </Text>
          {badge !== null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && (
          <Text style={[styles.menuSubtitle, disabled && { color: '#555' }]}>{subtitle}</Text>
        )}
      </View>
      {rightElement ? rightElement : disabled
        ? <ActivityIndicator size="small" color="#666" />
        : <Ionicons name="chevron-forward" size={20} color="#666" />
      }
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Stats Card */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="leaf" size={32} color="#00D9A5" />
          <Text style={styles.statNumber}>{treeCount}</Text>
          <Text style={styles.statLabel}>{t('settings.treesRecorded')}</Text>
        </View>
      </View>

      {/* Offline Mode Notice */}
      {process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'false' && (
        <View style={styles.offlineNotice}>
          <Ionicons name="airplane" size={20} color="#00D9A5" />
          <Text style={styles.offlineText}>{t('settings.offlineNotice')}</Text>
        </View>
      )}

      {/* ── Import CTA Card ─────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.importCard, isImporting && styles.importCardDisabled]}
        onPress={handleImportCSV}
        activeOpacity={0.85}
        disabled={isImporting}
      >
        <View style={styles.importCardLeft}>
          <View style={styles.importIconCircle}>
            {isImporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
            }
          </View>
          <View style={styles.importCardText}>
            <Text style={styles.importCardTitle}>
              {isImporting ? t('settings.importImporting') : t('settings.importCSV')}
            </Text>
            <Text style={styles.importCardSubtitle}>
              {t('settings.importSubtitle')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Import progress bar */}
      {importProgress !== null && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {importProgress.processed} / {importProgress.total} rows
            </Text>
            <Text style={styles.progressPct}>
              {importProgress.total > 0
                ? `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                : '0%'}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: importProgress.total > 0
                    ? `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                    : '0%',
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Data Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.dataManagement')}</Text>

        {process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true' && (
          <MenuItem
            icon="cloud-upload-outline"
            title={t('settings.syncCloud')}
            subtitle={unsyncedCount > 0 ? t('settings.syncWaiting')(unsyncedCount) : t('settings.syncAllDone')}
            onPress={handleSync}
            color="#4A90E2"
            badge={unsyncedCount}
          />
        )}

        <MenuItem
          icon="download-outline"
          title={t('settings.exportCSV')}
          subtitle={isExporting ? t('settings.exportExporting') : t('settings.exportSubtitle')}
          onPress={handleExportCSV}
          color="#00D9A5"
          disabled={isExporting}
        />

        <MenuItem
          icon="upload-outline"
          title={t('settings.importCSV')}
          subtitle={isImporting ? t('settings.importImporting') : t('settings.importSubtitle')}
          onPress={handleImportCSV}
          color="#FF6B6B"
          disabled={isImporting}
        />
      </View>

      {/* App Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.application')}</Text>

        <MenuItem
          icon="language-outline"
          title={t('settings.language')}
          subtitle={t('settings.languageSubtitle')}
          onPress={toggleLanguage}
          color="#9B59B6"
          rightElement={
            <View style={styles.langToggle}>
              <Text style={[styles.langOption, language === 'en' && styles.langOptionActive]}>EN</Text>
              <Text style={styles.langSeparator}>/</Text>
              <Text style={[styles.langOption, language === 'de' && styles.langOptionActive]}>DE</Text>
            </View>
          }
        />

        <MenuItem
          icon="information-circle-outline"
          title={t('settings.about')}
          subtitle={t('settings.aboutSubtitle')} // (t(key)) references the translation function.
          onPress={() => Alert.alert('Tree-D', t('settings.aboutBody'))}
          color="#9B59B6"
        />

        <MenuItem
          icon="help-circle-outline"
          title={t('settings.howItWorks')}
          subtitle={t('settings.howItWorksSubtitle')}
          onPress={() => Alert.alert(t('settings.howItWorks'), t('settings.howItWorksBody'))}
          color="#F39C12"
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },

  // Stats
  statsContainer: { marginBottom: 20 },
  statCard: { backgroundColor: 'rgba(0, 217, 165, 0.08)', borderRadius: 20, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)' },
  statNumber: { fontSize: 48, fontWeight: '800', color: '#00D9A5', marginTop: 12 },
  statLabel: { fontSize: 16, color: '#888', marginTop: 8, fontWeight: '600' },

  // Offline notice
  offlineNotice: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 217, 165, 0.08)', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 217, 165, 0.2)' },
  offlineText: { color: '#00D9A5', fontSize: 14, marginLeft: 10, fontWeight: '600' },

  // ── Import CTA card ────────────────────────────────────────────────────────
  importCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  importCardDisabled: { backgroundColor: '#ccc', shadowColor: '#000', shadowOpacity: 0.1 },
  importCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  importIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  importCardText: { flex: 1 },
  importCardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 3 },
  importCardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },

  // Progress bar
  progressContainer: {
    backgroundColor: '#fff5f5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.2)',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 13, color: '#555', fontWeight: '600' },
  progressPct: { fontSize: 13, color: '#FF6B6B', fontWeight: '700' },
  progressBarBg: { height: 6, backgroundColor: '#eee', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: 6, backgroundColor: '#FF6B6B', borderRadius: 3 },

  // Sections
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 },

  // Menu items
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 217, 165, 0.03)', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  menuIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuContent: { flex: 1 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center' },
  menuTitle: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 4 },
  menuSubtitle: { fontSize: 13, color: '#888', fontWeight: '500' },
  badge: { backgroundColor: '#FF6B6B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  menuItemDisabled: { opacity: 0.5 },

  // Language toggle
  langToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(155,89,182,0.1)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  langOption: { fontSize: 14, fontWeight: '700', color: '#bbb' },
  langOptionActive: { color: '#9B59B6' },
  langSeparator: { fontSize: 14, color: '#ccc', marginHorizontal: 4 },
});

export default SettingsScreen;