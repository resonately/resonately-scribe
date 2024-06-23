import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TenantContextType {
  tenantDetails: any;
  setTenantDetails: (details: any) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_DETAILS_KEY = 'tenantDetails';

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenantDetails, setTenantDetails] = useState<any>(null);

  useEffect(() => {
    // Load tenant details from AsyncStorage when the app starts
    const loadTenantDetails = async () => {
      try {
        const savedTenantDetails = await AsyncStorage.getItem(TENANT_DETAILS_KEY);
        if (savedTenantDetails !== null) {
          setTenantDetails(JSON.parse(savedTenantDetails));
        }
      } catch (error) {
        console.error('Failed to load tenant details:', error);
      }
    };

    loadTenantDetails();
  }, []);

  const saveTenantDetails = async (details: any) => {
    try {
      setTenantDetails(details);
      await AsyncStorage.setItem(TENANT_DETAILS_KEY, JSON.stringify(details));
    } catch (error) {
      console.error('Failed to save tenant details:', error);
    }
  };

  return (
    <TenantContext.Provider value={{ tenantDetails, setTenantDetails: saveTenantDetails }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
