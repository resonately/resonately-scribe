import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TextInput, Vibration } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, MD3LightTheme as DefaultTheme, Provider as PaperProvider } from 'react-native-paper';
import { Camera, CameraView } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { useTenant } from './TenantContext';

const InviteScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { setTenantDetails } = useTenant();

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;
  const navigation = useNavigation<LoginScreenNavigationProp>();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    Vibration.vibrate(); // Add vibrate functionality
    handleInviteCode(data);
  };

  const handleInviteCode = async (inviteCode: string) => {
    try {
      const response = await fetch(`https://api.myhearing.app/server/v1/tenant?inviteCode=${encodeURIComponent(inviteCode)}`, {
        method: 'GET',
      });

      const result = await response.json();
      if (response.ok) {
        if (result.data && result.data.tenantName) {
          // Store tenant details in context
          setTenantDetails(result.data);

          // Navigate to the login screen
          navigation.navigate('LoginScreen');
        } else {
          Alert.alert('Error', 'No tenant found with that invite code.');
        }
      } else {
        Alert.alert('Error', result.message || 'Failed to fetch tenant details');
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    }
  };

  const handleManualSubmit = () => {
    handleInviteCode(manualCode);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <PaperProvider theme={DefaultTheme}>
      <View style={styles.container}>
        <CameraView
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Scan Resonately QR</Text>
        </View>
        <View style={styles.bottomContainer}>
          <Text style={styles.title}>Enter Invite Code</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={4}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="Enter Code"
            />
            <Button mode="contained" onPress={handleManualSubmit} style={styles.submitButton}>
              Submit
            </Button>
          </View>
        </View>
        {scanned && (
          <Button mode="contained" onPress={() => setScanned(false)} style={styles.scanAgainButton}>
            Tap to Scan Again
          </Button>
        )}
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '25%',
    backgroundColor: '#FFFFFF', // Light blue background
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 10,
    shadowColor: '#000',
    paddingBottom: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  title: {
    fontSize: 22,
    marginBottom: 30,
    textAlign: 'center',
    color: 'black', // Primary blue color
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginRight: 10,
    fontSize: 18,
    backgroundColor: 'white',
  },
  submitButton: {
    height: 50,
    justifyContent: 'center',
    backgroundColor: '#1E88E5', // Primary blue color
  },
  scanAgainButton: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'blue', // Primary blue color
  },
});

export default InviteScreen;
