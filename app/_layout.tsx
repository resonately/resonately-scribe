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


export type RootStackParamList = {
  InviteScreen: undefined;
  DrawerNavigator: undefined;
  LoginScreen: undefined;
  LandingScreen: undefined;
  RecordingScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootLayoutComponent = () => {
  const { isAuthenticated, loading, tenantDetails } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {(!tenantDetails || !tenantDetails.tenantName) ? (
        <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }} />
      ) : (!isAuthenticated) ? (
        <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="DrawerNavigator" options={{ headerShown: false }}>
          {props => (
            <ProtectedRoute>
              <DrawerNavigator />
            </ProtectedRoute>
          )}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );  
};

const RootLayout = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <RootLayoutComponent />
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
