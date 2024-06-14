import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TenantContextType {
  tenantDetails: any;
  setTenantDetails: (details: any) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenantDetails, setTenantDetails] = useState<any>(null);

  return (
    <TenantContext.Provider value={{ tenantDetails, setTenantDetails }}>
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
