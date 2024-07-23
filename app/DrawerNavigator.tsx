import React, { useEffect, useRef } from 'react';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { useTheme } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';
import RecordingScreen from './RecordingScreen2';
import ProfileScreen from './ProfileScreen';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import * as SecureStore from 'expo-secure-store';
import { useNavigation, StackActions } from '@react-navigation/native';

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: any) => {
  const theme = useTheme();
  const navigation = useNavigation();
  const { logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.dispatch(StackActions.replace('LoginScreen'));
    }
  }, [isAuthenticated, navigation]);

  const handleSignOut = async () => {
    try {
      // Perform logout logic
      logout();
      console.log('User signed out');
      
      // Clear stored session data
      await SecureStore.deleteItemAsync('sessionCookie');
      await SecureStore.deleteItemAsync('sessionExpiry');
      
      console.log('Secure store cleared');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={styles.signOutButtonContainer}>
        <DrawerItem
          label="Sign Out"
          icon={({ color, size }) => (
            <MaterialCommunityIcons name="logout" color={color} size={size} />
          )}
          onPress={() => {
            handleSignOut();

            console.log('User signed out');
          }}
        />
      </View>
    </DrawerContentScrollView>
  );
};

const DrawerNavigator = () => {
  const theme = useTheme();
  const recordingScreenRef = useRef(null);

  return (
    <Drawer.Navigator
      initialRouteName="Recording"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.onPrimary, // Making it a lighter tone
        },
        headerTintColor: theme.colors.primary,
        drawerStyle: {
          backgroundColor: theme.colors.surface,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.onSurface,
      }}
    >
      <Drawer.Screen
        name="My Appointments"
        component={RecordingScreen}
        options={{ drawerLabel: 'My Appointments', 
        drawerIcon: ({ focused, color, size }) => (
            <MaterialCommunityIcons name="calendar" color={color} size={size} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

const styles = StyleSheet.create({
  signOutButtonContainer: {
    marginTop: 'auto', // Positions the button at the bottom of the drawer
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
});

export default DrawerNavigator;
