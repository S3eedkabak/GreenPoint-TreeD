import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllTrees, syncUnsyncedTrees, exportToCSV } from '../database/db';

const SettingsScreen = ({ navigation }) => {
  const [treeCount, setTreeCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false); // Calibration state

  useEffect(() => {
    loadTreeCount();
  }, []);

  const loadTreeCount = async () => {
    try {
      const trees = await getAllTrees();
      setTreeCount(trees.length);
      
      const unsynced = trees.filter(t => t.synced === 0);
      setUnsyncedCount(unsynced.length);
    } catch (error) {
      console.error('Error loading tree count:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncUnsyncedTrees();
      
      if (result.synced > 0) {
        Alert.alert('✅ Sync Complete', `${result.synced} trees synced to cloud`);
        loadTreeCount();
      } else {
        Alert.alert('ℹ️ Info', result.message);
      }
    } catch (error) {
      Alert.alert('❌ Sync Failed', 'No internet connection. Data saved locally.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const trees = await getAllTrees();
      
      if (trees.length === 0) {
        Alert.alert('📭 No Data', 'There are no trees to export');
        setIsExporting(false);
        return;
      }

      // Generate CSV using the database function
      const csvContent = await exportToCSV();

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const fileUri = FileSystem.documentDirectory + `trees_${timestamp}.csv`;
      
      // Write file
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });

      console.log('✅ CSV file created:', fileUri);

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('✅ Export Complete', `CSV saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('❌ Export Failed', `Could not export CSV file: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCalibration = () => {
    setIsCalibrated(true);
    Alert.alert('Calibration Complete', 'Position has been calibrated successfully.');
  };

  const MenuItem = ({ icon, title, subtitle, onPress, color = '#00D9A5', danger = false, badge = null, disabled = false }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={danger ? '#FF6B6B' : color} />
      </View>
      <View style={styles.menuContent}>
        <View style={styles.menuTitleRow}>
          <Text style={[styles.menuTitle, danger && { color: '#FF6B6B' }]}>{title}</Text>
          {badge !== null && badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats Card */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="leaf" size={32} color="#00D9A5" />
          <Text style={styles.statNumber}>{treeCount}</Text>
          <Text style={styles.statLabel}>Trees Recorded</Text>
        </View>
      </View>

      {/* Offline Mode Notice */}
      {process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'false' && (
        <View style={styles.offlineNotice}>
          <Ionicons name="airplane" size={20} color="#00D9A5" />
          <Text style={styles.offlineText}>Offline-First Mode: All data saved locally</Text>
        </View>
      )}

      {/* Data Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        {process.env.EXPO_PUBLIC_ENABLE_CLOUD_SYNC === 'true' && (
          <MenuItem
            icon="cloud-upload-outline"
            title="Sync to Cloud"
            subtitle={unsyncedCount > 0 ? `${unsyncedCount} trees waiting to sync` : 'All trees synced'}
            onPress={handleSync}
            color="#4A90E2"
            badge={unsyncedCount}
          />
        )}

        <MenuItem
          icon="download-outline"
          title="Export to CSV"
          subtitle="Download all tree data"
          onPress={handleExportCSV}
          color="#00D9A5"
        />
      </View>

      {/* Calibration Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Calibration</Text>
        
        <MenuItem
          icon="compass-outline"
          title="Calibrate Position"
          subtitle="Required before adding measurements"
          onPress={handleCalibration}
          color="#FFA500"
        />

        <MenuItem
          icon="add-circle-outline"
          title="Add New Measurement"
          subtitle="Calibrate position to enable"
          onPress={() => Alert.alert('Action', 'Add new measurement action')}
          color="#00D9A5"
          disabled={!isCalibrated} // Disable until calibrated
        />
      </View>

      {/* App Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Application</Text>
        
        <MenuItem
          icon="information-circle-outline"
          title="About Tree-D"
          subtitle="Version 1.0.0 - Offline-First"
          onPress={() => Alert.alert('Tree-D', 'Forestry Data Collection App\nVersion 1.0.0\n\nWorks 100% offline!')}
          color="#9B59B6"
        />
        
        <MenuItem
          icon="help-circle-outline"
          title="How It Works"
          subtitle="Offline-first architecture"
          onPress={() => Alert.alert(
            'Offline-First Mode',
            'Your data is:\n\n✅ Always saved locally on your device\n✅ Works without internet\n☁️ Optionally synced to cloud when online\n\nYou never lose data!'
          )}
          color="#F39C12"
        />
      </View>
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
  },
  statsContainer: {
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: 'rgba(0, 217, 165, 0.08)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
  },
  statNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: '#00D9A5',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 16,
    color: '#888',
    marginTop: 8,
    fontWeight: '600',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.08)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
  },
  offlineText: {
    color: '#00D9A5',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  badge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  unmatchedBackground: {
    backgroundColor: '#FFF3E0', // Light orange background for unmatched records
  },
});

export default SettingsScreen;
