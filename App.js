import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapScreen from './src/screens/MapScreen';
import AddTreeScreen from './src/screens/AddTreeScreen';
import TreeDetailScreen from './src/screens/TreeDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TreeHeightMeasurementScreen from './src/screens/TreeHeightMeasurementScreen';
import TreeTrunkMeasurementScreen from './src/screens/TreeTrunkMeasurementScreen';
import RegionDownloadScreen from './src/screens/RegionDownloadScreen';
import { initDatabase } from './src/database/db';

const Stack = createStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(error => {
        console.error('Failed to initialize database:', error);
        setDbReady(true); // still render app, let screens handle errors gracefully
      });
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#00D9A5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Map"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#fff',
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: '#00D9A5',
          },
          headerTintColor: '#00D9A5',
          headerTitleStyle: {
            fontWeight: '800',
            fontSize: 20,
          },
        }}
      >
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddTree"
          component={AddTreeScreen}
          options={{ title: 'New Tree', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="MeasureHeight"
          component={TreeHeightMeasurementScreen}
          options={{
            title: 'Measure Tree Height',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="MeasureTrunk"
          component={TreeTrunkMeasurementScreen}
          options={{
            title: 'Measure Trunk (DBH)',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="TreeDetail"
          component={TreeDetailScreen}
          options={{ title: 'Tree Details', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="RegionDownload"
          component={RegionDownloadScreen}
          options={{ title: 'Offline Maps', headerBackTitle: 'Back' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}