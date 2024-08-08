import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import DrawerNavigator from './DrawerNavigator';
import LoginScreen from './LoginScreen';
import InviteScreen from './InviteScreen';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import theme from './theme'; // Adjust the path according to your project structure
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MeetingControlsScreen from './MeetingControlsScreen';
import AppointmentManager from './AppointmentManager';
import PermissionScreen from './PermissionScreen'; // Import your PermissionScreen component
import WelcomeScreen from './WelcomeScreen'; // Import your WelcomeScreen component
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { SQLiteProvider } from 'expo-sqlite';
import LiveAudioManager from './LiveAudioManager';

const loadDatabase = async () => {
  const dbName = "mySQLite.db";
  const dbAsset = require('../assets/mySQLiteDB.db');

  const dbUri =  Asset.fromModule(dbAsset).uri;
  const dbFilePath = `${FileSystem.documentDirectory}SQLite/${dbName}`;

  const fileInfo = await FileSystem.getInfoAsync(dbFilePath);
  if(!fileInfo) {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}SQLite/`, {intermediates: true});
    await FileSystem.downloadAsync(dbUri, dbFilePath);
  }
  
};

export type RootStackParamList = {
  PermissionScreen: undefined;
  InviteScreen: undefined;
  DrawerNavigator: undefined;
  LoginScreen: undefined;
  LandingScreen: undefined;
  RecordingScreen: undefined;
  MeetingControlsScreen: { isMuted?: boolean; isPaused?: boolean; appointment?: any, collapseSheet?: () => void; } | undefined;
  WelcomeScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootLayoutComponent = () => {
  const { isAuthenticated, loading, tenantDetails } = useAuth();
  const [arePermissionsGranted, setArePermissionsGranted] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);

  useEffect(() => {
    if (tenantDetails && tenantDetails.tenantName) {
      LiveAudioManager.getInstance().setTenantName(tenantDetails.tenantName);
    }
  }, [tenantDetails]);

  const checkPermissions = async () => {
    const cameraStatus = await Camera.getCameraPermissionsAsync();
    const audioStatus = await Audio.getPermissionsAsync();
    const notificationsStatus = await Notifications.getPermissionsAsync();
    if (cameraStatus.status === 'granted' && audioStatus.status === 'granted' && notificationsStatus.status === 'granted' ) {
        setArePermissionsGranted(true);
    }
  };

  const checkAcceptedTerms = async () => {
    const accepted = await AsyncStorage.getItem('hasAcceptedTerms');
    setHasAcceptedTerms(accepted === 'true');
  };

  useEffect(() => {
    checkAcceptedTerms();
    checkPermissions();
  }, []);

  if (loading || hasAcceptedTerms === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {!hasAcceptedTerms ? (
        <Stack.Screen name="WelcomeScreen" options={{ headerShown: false }}>
          {props => <WelcomeScreen {...props} updateHasAcceptedTermsInLayout={checkAcceptedTerms} />}
        </Stack.Screen>
      ) : (!tenantDetails || !tenantDetails.tenantName) ? (
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }} />
      ) : (!isAuthenticated) ? (
        <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }} />
      ) : !arePermissionsGranted ? (
        <Stack.Screen name="PermissionScreen" options={{ headerShown: false }}>
          {props => <PermissionScreen {...props} updatePermissionsGrantedInLayout={checkPermissions} />}
        </Stack.Screen>
      )
       : 
      (
        <>
          <Stack.Screen name="DrawerNavigator" options={{ headerShown: false }}>
            {props => (
              <ProtectedRoute>
                <DrawerNavigator />
              </ProtectedRoute>
            )}
          </Stack.Screen>
          <Stack.Screen name="MeetingControlsScreen" options={{ headerShown: false, gestureEnabled: false }}>
            {props => (
              <ProtectedRoute>
                <MeetingControlsScreen />
              </ProtectedRoute>
            )}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
};


const RootLayout = () => {

  useEffect(() => {
    loadDatabase()
      .then(() => {
        console.log('Database loaded');
      }).catch((err) => console.error('Error loading database:', err));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <SQLiteProvider databaseName='mySQLite.db'>
            <RootLayoutComponent />
          </SQLiteProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
