import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Network from 'expo-network';

interface NetworkContextData {
  isOnline: boolean;
  connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextData>({
  isOnline: true,
  connectionType: null,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    checkNetwork();
    const interval = setInterval(checkNetwork, 10000); // checar a cada 10s
    return () => clearInterval(interval);
  }, []);

  async function checkNetwork() {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOnline(state.isConnected ?? false);
      setConnectionType(state.type ?? null);
    } catch {
      setIsOnline(false);
    }
  }

  return (
    <NetworkContext.Provider value={{ isOnline, connectionType }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextData {
  return useContext(NetworkContext);
}
