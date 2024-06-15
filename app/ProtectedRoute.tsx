import React, { useEffect, ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.log("isAuthenticated");
    console.log(isAuthenticated);
    if (!isAuthenticated) {
      navigation.dispatch(StackActions.replace('LoginScreen'));
    }
  }, [isAuthenticated, navigation]);

  if (!isAuthenticated) {
    return <View><Text></Text></View>; // Add a placeholder to avoid rendering null
  }

  return <>{children}</>;
};

export default ProtectedRoute;
