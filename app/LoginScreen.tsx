import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Checkbox, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as SecureStore from 'expo-secure-store';
import { RootStackParamList } from './_layout'; // Adjust the path according to your project structure
import { useAuth } from './AuthContext'; // Import the Auth context

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LoginScreen'>;

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login, tenantDetails, setTenantDetails } = useAuth(); // Get the login function from Auth context
  const theme = useTheme();

  useEffect(() => {
    const loadCredentials = async () => {
      const savedEmail = await SecureStore.getItemAsync('email');
      const savedPassword = await SecureStore.getItemAsync('password');
      const savedRememberMe = await SecureStore.getItemAsync('rememberMe');
      if (savedEmail && savedPassword && savedRememberMe === 'true') {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    };

    loadCredentials();
  }, []);

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
      const loggedIn = await login(email, password, rememberMe);
      if (!loggedIn) {
        Alert.alert('Login unsuccessful.');
      } else {
        if (rememberMe) {
          await SecureStore.setItemAsync('rememberMe', 'true');
        } else {
          await SecureStore.setItemAsync('rememberMe', 'false');
        }
      }
    } catch (error) {
      Alert.alert('Login unsuccessful.');
    } finally {
      setLoading(false);
    }
  }

  const handleReselectClinic = () => {
    // Handle clinic reselection logic here
    setTenantDetails(null);
    // navigation.navigate('InviteScreen'); // Replace with your actual navigation
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineLarge" style={[styles.welcomeText, { color: theme.colors.primary }]}>{tenantDetails?.tenantTitle}</Text>
      <Text variant="titleMedium" style={[styles.titleText, { color: theme.colors.onSurface }]}>Login to your account</Text>
      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={!!emailError}
        style={styles.input}
        onSubmitEditing={() => handleLogin()} // Trigger login on return key press
      />
      {emailError ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{emailError}</Text> : null}
      <TextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
        onSubmitEditing={() => handleLogin()} // Trigger login on return key press
      />
      <View style={styles.checkboxContainer}>
        <TouchableOpacity 
          onPress={() => setRememberMe(!rememberMe)} 
          style={styles.checkboxTouchable}
        >
          <Checkbox
            status={rememberMe ? 'checked' : 'unchecked'}
            color={theme.colors.primary}
            uncheckedColor={theme.colors.primary} // Set color for unchecked state
          />
          <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Remember me</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
      ) : (
        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          uppercase={false}
        >
          Login
        </Button>
      )}
      <TouchableOpacity onPress={handleReselectClinic}>
        <Text style={[styles.reselectText, { color: theme.colors.onSurface }]}>Not your clinic? <Text style={[styles.reselectLink, { color: theme.colors.primary }]}>Go back</Text></Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 50,
  },
  titleText: {
    fontSize: 20,
    marginBottom: 30,
  },
  input: {
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    marginBottom: 10,
  },
  button: {
    width: '100%',
    marginTop: 20,
    borderRadius: 30,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    height: 40, // Ensure it has height
    justifyContent: 'flex-start', // Align to the right
    width: '100%', // Ensure it takes full width
  },
  checkboxLabel: {
    marginLeft: 8,
  },
  reselectText: {
    marginTop: 20,
    fontSize: 14,
  },
  reselectLink: {
    fontWeight: 'bold',
  },
  checkboxTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default LoginScreen;
