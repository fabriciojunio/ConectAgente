import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { NetworkProvider } from '../contexts/NetworkContext';
import { SyncProvider } from '../contexts/SyncContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { getDatabase } from '../database/database';
import { agenteRepository } from '../database/repositories/agenteRepository';

export default function RootLayout() {
  useEffect(() => {
    getDatabase()
      .then(() => agenteRepository.garantirAdminPadrao())
      .catch(console.error);
  }, []);

  return (
    // Sem cor de fundo aqui: esta view fica fora do ThemeProvider, entao nao
    // tem paleta para ler. Quem pinta e o ThemedApp, logo abaixo, que esta
    // dentro. Antes havia um '#ffffff' fixo, que aparecia como clarao branco
    // atras das telas no tema escuro.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NetworkProvider>
            <AuthProvider>
              <SyncProvider>
                <ThemedApp />
              </SyncProvider>
            </AuthProvider>
          </NetworkProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedApp() {
  const { isDark, colors } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(colors.tabBar);
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [isDark, colors.tabBar]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </View>
  );
}
