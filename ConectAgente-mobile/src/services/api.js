import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with local IP if testing on physical device (e.g. 192.168.X.X:3333)
const API_URL = 'http://192.168.0.17:3333';

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@conectagente:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
