// Configuração global dos testes Jest para ConectAgente
import '@testing-library/jest-native/extend-expect';

// Mock global de módulos nativos do Expo que não funcionam em ambiente Jest
jest.mock('expo-font', () => ({
  useFonts: () => [true],
  loadAsync: jest.fn(),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: 'Link',
  Stack: {
    Screen: 'Stack.Screen',
  },
  Tabs: {
    Screen: 'Tabs.Screen',
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Silencia warnings desnecessários no output de testes
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
        args[0].includes('act(...)') ||
        args[0].includes('deprecated'))
    ) {
      return;
    }
    originalWarn(...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});

// ---------------------------------------------------------------------------
// Módulos nativos de segundo plano e notificação
// ---------------------------------------------------------------------------
//
// Entraram em 13/10/2026, quando o projeto deixou de ser distribuído pelo Expo
// Go e passou a sair só como APK de release. São módulos nativos: fora do
// aparelho eles não existem, e sem simulacro o Jest derruba a suíte inteira
// com "Cannot find native module 'ExpoTaskManager'", mesmo em teste que não
// toca neles, porque a falha acontece na importação.
jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn().mockResolvedValue(false),
}));

jest.mock('expo-background-task', () => ({
  // Os valores espelham o enum real: Restricted = 1, Available = 2.
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  getStatusAsync: jest.fn().mockResolvedValue(2),
  registerTaskAsync: jest.fn().mockResolvedValue(undefined),
  unregisterTaskAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id-do-lembrete'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-device', () => ({
  // `true` por padrão: o caminho que importa é o do aparelho de verdade. O
  // teste que precisa do contrário sobrescreve.
  isDevice: true,
}));
