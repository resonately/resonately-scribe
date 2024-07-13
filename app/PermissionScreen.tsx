import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Button, Switch, Text, Title, useTheme } from 'react-native-paper';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure

interface PermissionScreenProps {
    updatePermissionsGrantedInLayout: () => Promise<void>;
}

const PermissionScreen: React.FC<PermissionScreenProps> = ({ updatePermissionsGrantedInLayout }) => {
  const theme = useTheme();
  type InviteScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;
  const navigation = useNavigation<InviteScreenNavigationProp>();
  const [cameraPermission, setCameraPermission] = useState(false);
  const [microphonePermission, setMicrophonePermission] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState(false);
  const [allPermissionsGranted, setAllPermissionsGranted] = useState(false);
  const isFocused = useIsFocused();

  const checkPermissions = async () => {
    const { status: cameraStatus } = await Camera.getCameraPermissionsAsync();
    const { status: audioStatus } = await Audio.getPermissionsAsync();
    const { status: notificationsStatus } = await Notifications.getPermissionsAsync();

    setCameraPermission(cameraStatus === 'granted');
    setMicrophonePermission(audioStatus === 'granted');
    setNotificationsPermission(notificationsStatus === 'granted');

    setAllPermissionsGranted(
      cameraStatus === 'granted' && audioStatus === 'granted' && notificationsStatus === 'granted'
    );
    // updatePermissionsGrantedInLayout();
  };

  useEffect(() => {
    if (isFocused) {
      checkPermissions();
    }
  }, [isFocused]);

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setCameraPermission(true);
      checkPermissions();
    } else {
      Alert.alert(
        'Permission Denied',
        `Camera permission is required to proceed. Please enable it in the ${
          Platform.OS === 'ios' ? 'Settings > Privacy > Camera' : 'App Settings > Permissions > Camera'
        }.`
      );
    }
  };

  const requestMicrophonePermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status === 'granted') {
      setMicrophonePermission(true);
      checkPermissions();
    } else {
      Alert.alert(
        'Permission Denied',
        `Microphone permission is required to proceed. Please enable it in the ${
          Platform.OS === 'ios' ? 'Settings > Privacy > Microphone' : 'App Settings > Permissions > Microphone'
        }.`
      );
    }
  };

  const requestNotificationsPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      setNotificationsPermission(true);
      checkPermissions();
    } else {
      Alert.alert(
        'Permission Denied',
        `Notifications permission is required to proceed. Please enable it in the ${
          Platform.OS === 'ios' ? 'Settings > Notifications' : 'App Settings > Permissions > Notifications'
        }.`
      );
    }
  };

  const checkAllPermissions = () => {
    if (cameraPermission && microphonePermission && notificationsPermission) {
      setAllPermissionsGranted(true);
    }
  };

  const handleContinue = async () => {
    if (allPermissionsGranted) {
        await updatePermissionsGrantedInLayout();
        navigation.navigate('InviteScreen');
    } else {
      Alert.alert('Permissions Required', 'Please grant all permissions to proceed.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Title style={[styles.title, { color: theme.colors.primary }]}>Welcome to Resonately</Title>
      <Text style={[styles.description, { color: theme.colors.onBackground }]}>
        To get started, please grant the following permissions required to run the app.
      </Text>

      <View style={styles.permissionContainer}>
        <MaterialIcons name="camera-alt" size={24} color={theme.colors.onBackground} />
        <View style={styles.permissionDetails}>
          <Text style={[styles.permissionLabel, { color: theme.colors.onBackground }]}>Camera</Text>
          <Text style={[styles.permissionExplanation, { color: theme.colors.onBackground }]}>
            To enable QR Scans.
          </Text>
        </View>
        <Switch value={cameraPermission} onValueChange={requestCameraPermission} color={theme.colors.primary} />
      </View>

      <View style={styles.permissionContainer}>
        <MaterialIcons name="mic" size={24} color={theme.colors.onBackground} />
        <View style={styles.permissionDetails}>
          <Text style={[styles.permissionLabel, { color: theme.colors.onBackground }]}>Microphone</Text>
          <Text style={[styles.permissionExplanation, { color: theme.colors.onBackground }]}>
            To enable appointment transcriptions.
          </Text>
        </View>
        <Switch value={microphonePermission} onValueChange={requestMicrophonePermission} color={theme.colors.primary} />
      </View>

      <View style={styles.permissionContainer}>
        <MaterialIcons name="notifications" size={24} color={theme.colors.onBackground} />
        <View style={styles.permissionDetails}>
          <Text style={[styles.permissionLabel, { color: theme.colors.onBackground }]}>Notifications</Text>
          <Text style={[styles.permissionExplanation, { color: theme.colors.onBackground }]}>
            To send important updates and reminders.
          </Text>
        </View>
        <Switch value={notificationsPermission} onValueChange={requestNotificationsPermission} color={theme.colors.primary} />
      </View>

      <Button
        mode="contained"
        onPress={handleContinue}
        disabled={!allPermissionsGranted}
        style={styles.continueButton}
        contentStyle={styles.continueButtonContent}
        labelStyle={styles.continueButtonLabel}
      >
        Get Started
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 50,
    fontSize: 28,
    fontWeight: 'bold',
  },
  description: {
    textAlign: 'center',
    marginBottom: 40,
    fontSize: 16,
    lineHeight: 24,
  },
  permissionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 15,
    paddingHorizontal: 10,
  },
  permissionDetails: {
    flex: 1,
    marginLeft: 10,
  },
  permissionLabel: {
    fontSize: 18,
  },
  permissionExplanation: {
    fontSize: 14,
  },
  continueButton: {
    width: '100%',
    marginTop: 50,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  continueButtonContent: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  continueButtonLabel: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
});

export default PermissionScreen;
