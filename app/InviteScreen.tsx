import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Modal, TextInput, Button, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { Camera, CameraView } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { useTenant } from './TenantContext';

const InviteScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { setTenantDetails } = useTenant();

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;
  const navigation = useNavigation();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    // setScanned(true);
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
    setIsModalVisible(false);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.topOverlay}>
        <Text style={styles.overlayText}>Scan Resonately QR</Text>
      </View>

      <View style={styles.cornersContainer}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>

      <View style={styles.overlay}>
        <Button title="Enter Code Manually" onPress={() => setIsModalVisible(true)} />
      </View>
      
      <Modal
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalContainer} activeOpacity={1} onPressOut={() => setIsModalVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Invite Code</Text>
            <TextInput
              style={styles.input}
              value={manualCode}
              onChangeText={(text) => setManualCode(text.toUpperCase())}
              autoCapitalize="characters"
            />
            <Button title="Submit" onPress={handleManualSubmit} />
          </View>
        </TouchableOpacity>
      </Modal>
      
      {scanned && (
        <Button title="Tap to Scan Again" onPress={() => setScanned(false)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  topOverlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    position: 'absolute',
    top: '50%',
    fontSize: 20,
    color: 'white',
    transform: [{ translateY: 200 }],
  },
  cornersContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 200,
    height: 200,
    transform: [{ translateX: -100 }, { translateY: -100 }],
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: 'white',
    borderWidth: 2,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 2,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 2,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 2,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 20,
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 5,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default InviteScreen;
