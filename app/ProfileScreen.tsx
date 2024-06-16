import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, List, Avatar, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, StackActions } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import * as SecureStore from 'expo-secure-store';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { logout, isAuthenticated } = useAuth();

  const data = [
    // { key: '1', title: 'Edit Profile', icon: 'account-edit' },
    // { key: '2', title: 'Settings', icon: 'cog' },
    // { key: '3', title: 'Notifications', icon: 'bell' },
    // Add more items as needed
  ];

  const renderItem = ({ item }) => (
    <List.Item
      title={item.title}
      left={() => <Avatar.Icon size={40} icon={item.icon} />}
      onPress={() => console.log(`${item.title} pressed`)}
    />
  );

  const handleSignOut = async () => {
    try {
      // Perform logout logic
      logout();
      console.log('User signed out');
      
      // Clear stored session data
      await SecureStore.deleteItemAsync('sessionCookie');
      await SecureStore.deleteItemAsync('sessionExpiry');
      await SecureStore.deleteItemAsync('userEmail');
      await SecureStore.deleteItemAsync('password');
      
      console.log('Secure store cleared');
    } catch (error) {
      console.error('Error during sign out:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigation.dispatch(StackActions.replace('LoginScreen'));
    }
  }, [isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      {/* <Text variant="headlineMedium" style={styles.header}>Profile</Text> */}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={item => item.key}
      />
      <Button
        mode="outlined"
        onPress={handleSignOut}
        style={styles.signOutButton}
        icon={() => <MaterialCommunityIcons name="logout" size={24} color="#3949ab" />}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
      >
        Sign Out
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#e8eaf6', // Light Indigo background
  },
  header: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  signOutButton: {
    marginTop: 16,
    alignSelf: 'center',
    borderColor: '#3949ab', // Light Indigo border color
  },
  buttonContent: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#3949ab', // Light Indigo font color
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfileScreen;
