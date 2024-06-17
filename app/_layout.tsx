import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import AudioChunkUpload from './Record';
import ProfileScreen from './ProfileScreen';
import BottomNav from './BottomNav';
import LoginScreen from './LoginScreen';
import InviteScreen from './InviteScreen';
import LandingScreen from './LandingScreen';
import { TenantProvider } from './TenantContext';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import theme from './theme'; // Adjust the path according to your project structure

export type RootStackParamList = {
  BottomNav: undefined;
  LoginScreen: undefined;
  InviteScreen: undefined;
  LandingScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <TenantProvider>
          {/* <NavigationContainer> */}
            <Stack.Navigator initialRouteName="LandingScreen">
              <Stack.Screen name="LandingScreen" component={LandingScreen} options={{ headerShown: false }} />
              <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }} />
              <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="BottomNav" options={{ headerShown: false }}>
                {props => (
                  <ProtectedRoute>
                    <BottomNav />
                  </ProtectedRoute>
                )}
              </Stack.Screen>
            </Stack.Navigator>
          {/* </NavigationContainer> */}
        </TenantProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
