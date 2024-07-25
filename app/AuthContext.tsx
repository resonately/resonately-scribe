import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.rsn8ly.xyz';

interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  tenantDetails: any;
  login: (email: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  setTenantDetails: (details: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TENANT_DETAILS_KEY = 'tenantDetails';
const AUTH_STATE_KEY = 'isAuthenticated';
const SESSION_COOKIE_KEY = 'sessionCookie';
const EMAIL_KEY = 'email';
const PASSWORD_KEY = 'password';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantDetails, setTenantDetailsState] = useState<any>(null);

  useEffect(() => {
    // Load tenant details and authentication state when the app starts
    const loadAuthState = async () => {
      const storedAuthState = await SecureStore.getItemAsync(AUTH_STATE_KEY);
      const sessionCookie = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
      const savedTenantDetails = await AsyncStorage.getItem(TENANT_DETAILS_KEY);

      if (savedTenantDetails !== null) {
        setTenantDetailsState(JSON.parse(savedTenantDetails));
      }

      if (storedAuthState === 'true' && sessionCookie && savedTenantDetails) {
        try {
          await attemptLoginWithStoredCredentials(JSON.parse(savedTenantDetails));
          setIsAuthenticated(true);
        } catch (error) {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    loadAuthState();
  }, []);

  const attemptLoginWithStoredCredentials = async (tenantDetails: any) => {
    const savedEmail = await SecureStore.getItemAsync(EMAIL_KEY);
    const savedPassword = await SecureStore.getItemAsync(PASSWORD_KEY);
    if (savedEmail && savedPassword) {
      try {
        await loginWithCredentials(savedEmail, savedPassword, tenantDetails);
        return true;
      } catch (error) {
        console.error('Automatic login failed:', error);
        throw Error('Automatic login failed');
      }
    }
  };

  const loginWithCredentials = async (email: string, password: string, tenantDetails: any) => {
    const response = await fetch(`${API_BASE_URL}/oms/v1/api/method/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-name': tenantDetails?.tenantName, // Include tenant name in headers
      },
      body: JSON.stringify({ usr: email, pwd: password }),
    });

    console.log('Tenant Details:', tenantDetails);
    console.log('Response:', response);

    if (response.ok) {
      const data = await response.json();
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        await SecureStore.setItemAsync(SESSION_COOKIE_KEY, setCookieHeader, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        await SecureStore.setItemAsync(AUTH_STATE_KEY, 'true', {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      }
      setIsAuthenticated(true);
    } else {
      throw new Error('Login failed');
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean): Promise<boolean> => {
    if (!tenantDetails) {
      console.error('Tenant details are not set');
      return false;
    }

    setLoading(true);
    try {
      await loginWithCredentials(email, password, tenantDetails);
      if (rememberMe) {
        await SecureStore.setItemAsync(EMAIL_KEY, email, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        await SecureStore.setItemAsync(PASSWORD_KEY, password, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
      } else {
        await SecureStore.deleteItemAsync(EMAIL_KEY);
        await SecureStore.deleteItemAsync(PASSWORD_KEY);
      }
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    await SecureStore.deleteItemAsync(AUTH_STATE_KEY);
    await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
    await SecureStore.deleteItemAsync(PASSWORD_KEY);
  };

  const setTenantDetails = async (details: any) => {
    try {
      setTenantDetailsState(details);
      await AsyncStorage.setItem(TENANT_DETAILS_KEY, JSON.stringify(details));
    } catch (error) {
      console.error('Failed to save tenant details:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, tenantDetails, login, logout, setTenantDetails }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
