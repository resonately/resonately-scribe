import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { useTenant } from './TenantContext';
import { useAuth } from './AuthContext';

interface LogoutCheckerProps {
  isRecordingInProgress: boolean;
}

const LogoutChecker: React.FC<LogoutCheckerProps> = ({ isRecordingInProgress }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  
  const { logout } = useAuth();
  const expiryCheckFrequency = 10 * 1000; // Every 10 minutes.

  const { tenantDetails } = useTenant();

  const checkSessionExpiry = async () => {
    try {
      const sessionExpiryString = await SecureStore.getItemAsync('sessionExpiry');
      if (sessionExpiryString) {
        const sessionExpiry = new Date(sessionExpiryString);
        const currentTime = new Date();
        const timeDifference = sessionExpiry.getTime() - currentTime.getTime();
        console.log(currentTime.toISOString());
        console.log(sessionExpiry.toISOString());
        const twoHoursInMilliseconds = 2 * 60 * 60 * 1000;

        if (timeDifference <= twoHoursInMilliseconds) {
          // Log out the user
          await handleLogout();
          
        }
      }
    } catch (error) {
      console.error('Error checking session expiry:', error);
    }
  };

  const handleLogout = async () => {

    // Clear any stored session data
    await SecureStore.deleteItemAsync('sessionCookie');
    await SecureStore.deleteItemAsync('sessionExpiry');
    logout();
    // Navigate to the login screen
    navigation.navigate('LoginScreen'); // Use navigate instead of replace
  };

  useEffect(() => {
    if (!isRecordingInProgress) {
      const id = setInterval(() => {
        checkSessionExpiry();
      }, expiryCheckFrequency); // Check every 10 mins

      setIntervalId(id);

      return () => {
        if (id) {
          clearInterval(id);
        }
      };
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [isRecordingInProgress]);

  return null;
};

export default LogoutChecker;
