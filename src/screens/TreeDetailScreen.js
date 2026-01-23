import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAllTrees } from '../database/db';

const TreeDetailScreen = ({ route, navigation }) => {
  const { treeId } = route.params;
  const [tree, setTree] = useState(null);

  useEffect(() => {
    loadTreeData();
  }, [treeId]);

  const loadTreeData = async () => {
    try {
      const trees = await getAllTrees();
      const foundTree = trees.find(t => t.tree_id === treeId);
      setTree(foundTree);
    } catch (error) {
      Alert.alert('Error', 'Failed to load tree data');
    }
  };

  if (!tree) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="leaf" size={40} color="#00D9A5" />
        </View>
        <Text style={styles.speciesName}>{tree.species}</Text>
        <Text style={styles.subtitle}>Tree ID: {tree.tree_id}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tree Properties</Text>
        
        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}>
            <Ionicons name="resize-outline" size={20} color="#00D9A5" />
          </View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>Tree Height</Text>
            <Text style={styles.propertyValue}>{tree.tree_height} meters</Text>
          </View>
        </View>

        {tree.dbh && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="ellipse-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>DBH</Text>
              <Text style={styles.propertyValue}>{tree.dbh} cm</Text>
            </View>
          </View>
        )}

        {tree.crown_height && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="arrow-up-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Crown Height</Text>
              <Text style={styles.propertyValue}>{tree.crown_height} m</Text>
            </View>
          </View>
        )}

        {tree.crown_radius && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="radio-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Crown Radius</Text>
              <Text style={styles.propertyValue}>{tree.crown_radius} m</Text>
            </View>
          </View>
        )}

        {tree.crown_completeness !== null && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="pie-chart-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Crown Completeness</Text>
              <Text style={styles.propertyValue}>{tree.crown_completeness}</Text>
            </View>
          </View>
        )}

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}>
            <Ionicons name="location-outline" size={20} color="#00D9A5" />
          </View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>Northing</Text>
            <Text style={styles.propertyValue}>{tree.northing.toFixed(6)}</Text>
          </View>
        </View>

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}>
            <Ionicons name="location-outline" size={20} color="#00D9A5" />
          </View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>Easting</Text>
            <Text style={styles.propertyValue}>{tree.easting.toFixed(6)}</Text>
          </View>
        </View>

        <View style={styles.propertyRow}>
          <View style={styles.propertyIcon}>
            <Ionicons name="calendar-outline" size={20} color="#00D9A5" />
          </View>
          <View style={styles.propertyContent}>
            <Text style={styles.propertyLabel}>Date Recorded</Text>
            <Text style={styles.propertyValue}>{tree.date}</Text>
          </View>
        </View>

        {tree.tags && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="pricetags-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Tags</Text>
              <Text style={styles.propertyValue}>{tree.tags}</Text>
            </View>
          </View>
        )}

        {tree.synced === 1 && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="cloud-done-outline" size={20} color="#00D9A5" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Cloud Status</Text>
              <Text style={[styles.propertyValue, styles.syncedText]}>Synced</Text>
            </View>
          </View>
        )}

        {tree.synced === 0 && (
          <View style={styles.propertyRow}>
            <View style={styles.propertyIcon}>
              <Ionicons name="cloud-offline-outline" size={20} color="#FF6B6B" />
            </View>
            <View style={styles.propertyContent}>
              <Text style={styles.propertyLabel}>Cloud Status</Text>
              <Text style={[styles.propertyValue, styles.unsyncedText]}>Not Synced</Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back-circle" size={24} color="#00D9A5" />
        <Text style={styles.backButtonText}>Back to Map</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0E27',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
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
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'rgba(0, 217, 165, 0.3)',
  },
  speciesName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00D9A5',
    marginBottom: 20,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  propertyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 217, 165, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  propertyContent: {
    flex: 1,
  },
  propertyLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  propertyValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  syncedText: {
    color: '#00D9A5',
  },
  unsyncedText: {
    color: '#FF6B6B',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 217, 165, 0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 165, 0.2)',
    marginTop: 10,
  },
  backButtonText: {
    color: '#00D9A5',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
});

export default TreeDetailScreen;
