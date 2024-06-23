import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
// import RecordScreen from './RecordScreen';
import RecordingScreen from './RecordingScreen2';
import ProfileScreen from './ProfileScreen';
import BottomNav from './BottomNav';
import LoginScreen from './LoginScreen';
import InviteScreen from './InviteScreen';
import LandingScreen from './LandingScreen';
import { TenantProvider } from './TenantContext';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './ProtectedRoute';
import theme from './theme'; // Adjust the path according to your project structure
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export type RootStackParamList = {
  BottomNav: undefined;
  LoginScreen: undefined;
  InviteScreen: undefined;
  LandingScreen: undefined;
  RecordingScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* <NavigationContainer> */}
        <PaperProvider theme={theme}>
          <AuthProvider>
            <TenantProvider>
              <Stack.Navigator initialRouteName="InviteScreen">
                <Stack.Screen name="LandingScreen" component={LandingScreen} options={{ headerShown: false }} />
                <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }} />
                <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="BottomNav" options={{ 
                  headerShown: true,
                  title: '', // Set your custom title here
                  headerLeft: () => '', // Disable the back button
                  }}>
                  {props => (
                    <ProtectedRoute>
                      <BottomNav />
                    </ProtectedRoute>
                  )}
                </Stack.Screen>
              </Stack.Navigator>
            </TenantProvider>
          </AuthProvider>
        </PaperProvider>
      {/* </NavigationContainer> */}
    </GestureHandlerRootView>
  );
}
