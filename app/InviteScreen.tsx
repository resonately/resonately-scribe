import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Text, TextInput, Button } from 'react-native-paper';
import BottomSheet from '@gorhom/bottom-sheet';
import { Camera, CameraView } from 'expo-camera';
import { StackNavigationProp } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { err } from 'react-native-svg';
import { useAuth } from './AuthContext';
import crashlytics from '@react-native-firebase/crashlytics';
import analytics from '@react-native-firebase/analytics';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';


const InviteScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const { setTenantDetails } = useAuth();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const bottomSheetRef = useRef<BottomSheet>(null);

  type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;
  const navigation = useNavigation<LoginScreenNavigationProp>();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      // Log the event for camera permission
      analytics().logEvent('camera_permission', {
        status: status,
      });
    };
  
    getCameraPermissions();
  }, []);  

  

  useFocusEffect(
    useCallback(() => {
      setCameraActive(true);
      return () => {
        setCameraActive(false);
      };
    }, [])
  );

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    handleInviteCode(data);
  
    // Log the event for barcode scanned
    analytics().logEvent('barcode_scanned', {
      type: type,
      data: data,
    });
  };
  

  const handleInviteCode = async (inviteCode: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/server/v1/tenant?inviteCode=${encodeURIComponent(inviteCode)}`, {
        method: 'GET',
      });
  
      const result = await response.json();
      if (response.ok) {
        if (result.data && result.data.tenantName) {
          console.log('Storing Tenant Details');
          console.log(result.data);
          // Store tenant details in context
          setTenantDetails(result.data);
          // Turn off the camera before navigating to the next screen
          setCameraActive(false);
  
          // Navigate to the login screen
          navigation.navigate('LoginScreen');
  
          // Log the event for successful invite code handling
          analytics().logEvent('invite_code_success', {
            invite_code: inviteCode,
            tenant_name: result.data.tenantName,
          });
        } else {
          Alert.alert('Error', 'No tenant found with that invite code.');
  
          // Log the event for unsuccessful invite code handling
          analytics().logEvent('invite_code_failure', {
            invite_code: inviteCode,
            error: 'No tenant found',
          });
        }
      } else {
        Alert.alert('Invite code required.', response.statusText || 'Please share an invite code.');
  
        // Log the event for unsuccessful invite code handling
        analytics().logEvent('invite_code_failure', {
          invite_code: inviteCode,
          error: response.statusText || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
  
      // Log the event for unsuccessful invite code handling
      analytics().logEvent('invite_code_failure', {
        invite_code: inviteCode,
        error: JSON.stringify(error),
      });
    }
  };  

  const handleManualSubmit = () => {
    handleInviteCode(manualCode);
    setIsModalVisible(false);
  
    // Log the event for manual code submission
    analytics().logEvent('manual_code_submit', {
      manual_code: manualCode,
    });
  };
  

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      {cameraActive && (
        <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        style={StyleSheet.absoluteFillObject}
      />
      )}

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
        <Button mode="outlined" onPress={async () => {
          console.log("Enter Code Manually clicked.");
          setIsModalVisible(true);
          await analytics().logEvent('enter_manual_code', {
            page: 'invite',
            element_type: 'button',
            event_type: 'on_click',
          })
        }}>
          Enter Code Manually
        </Button>
      </View>

      <Modal
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsModalVisible(false)}>
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Enter Invite Code</Text>
                <TextInput
                  mode="outlined"
                  label="Invite Code"
                  value={manualCode}
                  onChangeText={(text) => setManualCode(text)}
                  style={styles.input}
                  onSubmitEditing={handleManualSubmit}
                />
                <Button
                  mode="outlined"
                  onPress={handleManualSubmit}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  uppercase={false}
                >
                  Submit
                </Button>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {scanned && (
      <Button mode="outlined" onPress={() => {
        setScanned(false);
        // Log the event for rescanning barcode
        analytics().logEvent('rescan_barcode');
      }}>
        Tap to Scan Again
      </Button>
    )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%', // Increase the width
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
    width: '100%', // Increase the width
    marginBottom: 20,
  },
  button: {
    width: '100%',
    borderRadius: 30,
    borderColor: '#2196F3', // Blue border
    borderWidth: 1,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  buttonLabel: {
    color: '#2196F3', // Blue text color
    fontSize: 18,
    fontWeight: '600',
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
  bottomSheetContent: {
    padding: 20,
    backgroundColor: 'white',
  },
  bottomSheetTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
});

export default InviteScreen;
