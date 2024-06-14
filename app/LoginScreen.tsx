import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { useAuth } from './AuthContext'; // Import the Auth context
import { useTenant } from './TenantContext'; // Import the Tenant context

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;

const LoginScreen = () => {
  const [email, setEmail] = useState('admin@mysite.com');
  const [password, setPassword] = useState('password');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useAuth(); // Get the login function from Auth context
  const { tenantDetails } = useTenant(); // Get the tenant details from Tenant context

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const handleLogin = async () => {
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    } else {
      setEmailError('');
    }

    setLoading(true); // Start loading

    try {
      const response = await fetch('https://api.myhearing.app/oms/v1/api/method/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-name': tenantDetails?.tenant_title || 'mysite',
        },
        body: JSON.stringify({ usr: email, pwd: password }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Store the session token or cookie in SecureStore
        const setCookieHeader = response.headers.get('set-cookie');
        
        if (setCookieHeader) {
          const expiryMatch = setCookieHeader?.match(/expires=([^;]+);/);
          const expiryDate = expiryMatch ? new Date(expiryMatch[1]) : new Date(Date.now() + 3600 * 1000); // Default to 1 hour if no expiry
          await SecureStore.setItemAsync('sessionCookie', setCookieHeader);
          await SecureStore.setItemAsync('sessionExpiry', expiryDate.toISOString());
        }

        // Perform your post-authentication logic here, like saving the token
        login(); // Set the authenticated state
        navigation.replace('BottomNav'); // Navigate to the next screen
      } else {
        const errorData = await response.json();
        Alert.alert('Login failed', errorData.message);
      }
    } catch (error) {
      console.error('Login error', error);
      Alert.alert('Login failed', 'An error occurred. Please try again.');
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleReselectClinic = () => {
    // Handle clinic reselection logic here
    navigation.navigate('InviteScreen'); // Replace with your actual navigation
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineLarge" style={styles.welcomeText}>{tenantDetails.tenantTitle}</Text>
      <Text variant="titleMedium" style={styles.titleText}>Login to your account</Text>
      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={!!emailError}
        style={styles.input}
      />
      {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
      <TextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      {loading ? (
        <ActivityIndicator size="large" color="#1E88E5" style={styles.loader} />
      ) : (
        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          uppercase={false}
          theme={{ colors: { primary: '#1E88E5' } }}
        >
          Login
        </Button>
      )}
      <TouchableOpacity onPress={handleReselectClinic}>
        <Text style={styles.reselectText}>Not your clinic? <Text style={styles.reselectLink}>Go back</Text></Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 50,
  },
  titleText: {
    fontSize: 20,
    color: '#000',
    marginBottom: 30,
  },
  input: {
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#d32f2f',
    marginBottom: 10,
  },
  button: {
    width: '100%',
    marginTop: 20,
    borderRadius: 30,
    backgroundColor: '#1E88E5',
    elevation: 5, // Add elevation for shadow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonContent: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    color: '#ffffff', // White font color
    fontSize: 18,
    fontWeight: '600',
  },
  loader: {
    marginTop: 20,
  },
  reselectText: {
    marginTop: 20,
    color: '#000',
    fontSize: 14,
  },
  reselectLink: {
    color: '#1E88E5',
    fontWeight: 'bold',
  },
});

export default LoginScreen;
