import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { BottomNavigation } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AudioChunkUpload from './Record'; // Ensure this points to your Record screen
import ProfileScreen from './ProfileScreen'; // Ensure this points to your Profile screen
import MyTabs from './BottomNav'; // Ensure this points to your Profile screen
import LoginScreen from './LoginScreen'; // Ensure this points to your Login screen
import { Provider as PaperProvider } from 'react-native-paper';
import theme from './theme'; // Adjust the path according to your project structure
import InviteScreen from './InviteScreen';
import { TenantProvider } from './TenantContext';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from './ProtectedRoute'; // Adjust the path


type RootStackParamList = {
  MyTabs: undefined;
  LoginScreen: undefined;
  InviteScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RecordRoute = () => <AudioChunkUpload />;
const ProfileRoute = () => <ProfileScreen />;
const LoginRoute = () => <LoginScreen />;

// const MyTabs = () => {
//   const [index, setIndex] = useState(0);
//   const [routes] = useState([
//     { key: 'record', title: 'Record', icon: 'microphone' },
//     { key: 'profile', title: 'Profile', icon: 'account' },
//   ]);

//   const renderScene = BottomNavigation.SceneMap({
//     record: RecordRoute,
//     profile: ProfileRoute,
//   });

//   const renderIcon = ({ route, color }: { route: { key: string }, color: string }) => {
//     let iconName: string;

//     if (route.key === 'record') {
//       iconName = 'microphone';
//     } else if (route.key === 'profile') {
//       iconName = 'account';
//     }

//     return <MaterialCommunityIcons name={iconName} size={24} color={color} />;
//   };

//   return (
//     <BottomNavigation
//       navigationState={{ index, routes }}
//       onIndexChange={setIndex}
//       renderScene={renderScene}
//       renderIcon={renderIcon}
//     />
//   );
// };

export default function RootLayout() {
  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
      <TenantProvider>
      {/* <NavigationContainer> */}
      <Stack.Navigator initialRouteName="InviteScreen">
              <Stack.Screen name="InviteScreen" component={InviteScreen} options={{ headerShown: false }} />
              <Stack.Screen name="LoginScreen" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="BottomNav" options={{ headerShown: false }}>
                {() => (
                  // <ProtectedRoute>
                    <MyTabs />
                  // </ProtectedRoute>
                )}
              </Stack.Screen>
            </Stack.Navigator>
        {/* </NavigationContainer> */}
      </TenantProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
