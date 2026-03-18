import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapScreen from './src/screens/MapScreen';
import AddTreeScreen from './src/screens/AddTreeScreen';
import TreeDetailScreen from './src/screens/TreeDetailScreen';
import EditTreeScreen from './src/screens/EditTreeScreen';
import TreeRecordsScreen from './src/screens/TreeRecordsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TreeHeightMeasurementScreen from './src/screens/TreeHeightMeasurementScreen';
import TreeTrunkMeasurementScreen from './src/screens/TreeTrunkMeasurementScreen';
import RegionDownloadScreen from './src/screens/RegionDownloadScreen';
import PatternMatchScreen from './src/screens/PatternMatchScreen';
import { initDatabase } from './src/database/db';
import { LanguageProvider } from './src/utils/useTranslation'; // New 

const Stack = createStackNavigator();

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch(error => {
        console.error('Failed to initialize database:', error);
        setDbReady(true);
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
    // LanguageProvider must wrap NavigationContainer so every screen
    // has access to the same language context.
    <LanguageProvider>
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
            options={{ title: 'Measure Tree Height', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="MeasureTrunk"
            component={TreeTrunkMeasurementScreen}
            options={{ title: 'Measure Trunk (DBH)', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="TreeDetail"
            component={TreeDetailScreen}
            options={{ title: 'Tree Details', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="TreeRecords"
            component={TreeRecordsScreen}
            options={{ title: 'Tree Records', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="EditTree"
            component={EditTreeScreen}
            options={{ title: 'Edit Tree', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings', headerBackTitle: 'Back' }}
          />
          {/*
            detachPreviousScreen: false keeps MapScreen (and its WebView) fully
            mounted and alive while RegionDownload is on top of the stack.
            Without this, navigating back from RegionDownload causes the WebView
            to remount and reload leaflet-map-bundled.html via the RN local HTTP
            server — which iOS blocks when the device is offline (NSURLErrorDomain -1009).
          */}
          <Stack.Screen
            name="RegionDownload"
            component={RegionDownloadScreen}
            options={{
              title: 'Offline Maps',
              headerBackTitle: 'Back',
              detachPreviousScreen: false,
            }}
          />
          <Stack.Screen
            name="PatternMatch"
            component={PatternMatchScreen}
            options={{ title: 'Pattern Match', headerBackTitle: 'Back' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </LanguageProvider>
  );
}