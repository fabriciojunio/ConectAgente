import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      const storagedUser = await AsyncStorage.getItem('@conectagente:user');
      const storagedToken = await AsyncStorage.getItem('@conectagente:token');

      if (storagedUser && storagedToken) {
        setUser(JSON.parse(storagedUser));
        api.defaults.headers.Authorization = `Bearer ${storagedToken}`;
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  async function signIn({ login, senha }) {
    try {
      const response = await api.post('/auth/login', { login, senha });
      const { user, token } = response.data;

      await AsyncStorage.setItem('@conectagente:user', JSON.stringify(user));
      await AsyncStorage.setItem('@conectagente:token', token);

      api.defaults.headers.Authorization = `Bearer ${token}`;
      setUser(user);
    } catch (error) {
      throw error;
    }
  }

  async function signOut() {
    await AsyncStorage.removeItem('@conectagente:user');
    await AsyncStorage.removeItem('@conectagente:token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ signed: !!user, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
