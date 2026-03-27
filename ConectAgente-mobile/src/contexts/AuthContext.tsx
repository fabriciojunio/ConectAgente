import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { Agente } from '../types';
import { authService } from '../services/authService';
import { SESSION_TIMEOUT_MS, SESSION_WARNING_MS } from '../utils/constants';

interface AuthContextData {
  agente: Agente | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (cpf: string, senha: string) => Promise<Agente>;
  logout: () => Promise<void>;
  registrar: (data: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    area_atuacao: string;
    unidade_saude: string;
  }) => Promise<void>;
  renovarSessao: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [agente, setAgente] = useState<Agente | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Verificar sessão ao iniciar
  useEffect(() => {
    verificarSessao();
  }, []);

  // Monitorar AppState para renovar sessão quando app volta ao foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        verificarSessao();
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  async function verificarSessao() {
    try {
      const agenteAtual = await authService.verificarSessao();
      setAgente(agenteAtual);
      if (agenteAtual) {
        iniciarTimerSessao();
      }
    } catch {
      setAgente(null);
    } finally {
      setIsLoading(false);
    }
  }

  function iniciarTimerSessao() {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT_MS);
  }

  const renovarSessao = useCallback(async () => {
    if (!agente) return;
    await authService.renovarSessao();
    iniciarTimerSessao();
  }, [agente]);

  async function login(cpf: string, senha: string): Promise<Agente> {
    const session = await authService.login(cpf, senha);
    setAgente(session.agente);
    iniciarTimerSessao();
    return session.agente;
  }

  async function logout() {
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    await authService.logout();
    setAgente(null);
    router.replace('/(auth)/login');
  }

  async function registrar(data: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    area_atuacao: string;
    unidade_saude: string;
  }) {
    const novoAgente = await authService.cadastrarAgente(data);
    const session = await authService.login(data.cpf, data.senha);
    setAgente(session.agente);
    iniciarTimerSessao();
  }

  return (
    <AuthContext.Provider
      value={{
        agente,
        isLoading,
        isAuthenticated: !!agente,
        isAdmin: agente?.is_admin ?? false,
        login,
        logout,
        registrar,
        renovarSessao,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextData {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
