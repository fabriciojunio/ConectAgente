# Arquitetura — ConectAgente

## Visão Geral

Sistema offline-first para Agentes Comunitários de Saúde (ACS) do SUS, com app mobile React Native e portal web administrativo.

```
┌──────────────────────────────────────────────────────────────┐
│                  Agente de Saúde (Campo)                      │
│              Smartphone Android/iOS (sem internet)           │
└─────────────────────────────┬────────────────────────────────┘
                              │ Expo Router
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              ConectAgente-mobile (React Native + Expo)       │
│                                                              │
│  src/app/      — Telas (Expo Router File-System)             │
│  src/database/ — SQLite (drizzle-orm) — dados offline        │
│  src/contexts/ — Auth, Network, Sync, Theme                  │
│  src/hooks/    — useMoradores, useVisitas, useMetas          │
│  src/services/ — Sync, Export, CEP, Notifications            │
│  src/utils/    — encryption (AES-256), lgpd, formatters      │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS (quando online)
           │ Sync bidirecional via SyncContext
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Supabase (Backend)                       │
│  PostgreSQL  │  Auth  │  Storage  │  Realtime                │
└──────────────┬───────────────────────────────────────────────┘
               │ Next.js API Routes
               ▼
┌──────────────────────────────────────────────────────────────┐
│         ConectAgente-web (Next.js — Portal Admin)            │
│  Dashboard de equipe │ Gestão de agentes │ Relatórios        │
└──────────────────────────────────────────────────────────────┘
```

## Estratégia Offline-First

1. **SQLite local**: todos os dados são gravados localmente primeiro (drizzle-orm)
2. **SyncQueue**: operações pendentes são enfileiradas quando offline
3. **Background sync**: `backgroundSync.ts` executa via `expo-background-fetch`
4. **Conflito**: estratégia "last-write-wins" com timestamp — campo `updatedAt`

## LGPD e Privacidade

- Dados de prontuário (condições crônicas, medicamentos) → criptografados com AES-256 antes do SQLite
- Sincronização → payload criptografado em trânsito
- Direito ao esquecimento → `lgpd.ts` remove dados local + remoto

## Perfis de Acesso

| Perfil | Permissões |
|---|---|
| Agente | Suas residências, moradores e visitas |
| Admin | Todos os dados da UBS, gestão de agentes, relatórios |
