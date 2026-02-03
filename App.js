// Main entry point of the React Native application, setting up navigation and initializing the database.

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MapScreen from './src/screens/MapScreen';
import AddTreeScreen from './src/screens/AddTreeScreen';
import TreeDetailScreen from './src/screens/TreeDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { initDatabase } from './src/database/db';

const Stack = createStackNavigator();

export default function App() {
  useEffect(() => {
    // Initialize database on app start
    initDatabase().catch(error => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

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
          options={{
            title: 'New Tree',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="TreeDetail"
          component={TreeDetailScreen}
          options={{
            title: 'Tree Details',
            headerBackTitle: 'Back',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'Settings',
            headerBackTitle: 'Back',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
