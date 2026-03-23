# ConectAgente

**Sistema de Gestão de Visitas Domiciliares para Agentes Comunitários de Saúde (ACS)**

> Aplicativo mobile offline-first para registro, acompanhamento e sincronização de visitas domiciliares, desenvolvido em conformidade com a LGPD (Lei 13.709/2018).

---

## Sumário

- [Visão Geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Design Patterns](#design-patterns)
- [Segurança](#segurança)
- [LGPD](#lgpd)
- [Instalação e Configuração](#instalação-e-configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Testes](#testes)
- [Supabase — Configuração RLS](#supabase--configuração-rls)
- [Roadmap](#roadmap)

---

## Visão Geral

O ConectAgente resolve um problema crítico da Atenção Básica: ACS muitas vezes trabalham em áreas sem internet e precisam registrar visitas, coletar dados de saúde e acompanhar famílias mesmo offline. O app:

- Funciona **100% offline** — dados salvos localmente no SQLite
- **Sincroniza automaticamente** quando há internet (fila offline-first)
- Armazena **prontuários completos** por morador (saúde geral, gestante, puericultura, saúde da mulher, social)
- Controla **metas mensais** de visitas
- **Agenda consultas** com visão de calendário
- Exporta **relatórios** em CSV/Excel
- Mantém **histórico completo** de todas as visitas por residência

---

## Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Expo SDK | ~54.0.0 |
| Runtime | React Native | 0.81.5 |
| Linguagem | TypeScript | ~5.8.3 |
| Navegação | Expo Router (file-based) | ~6.0.23 |
| Banco local | expo-sqlite (WAL mode) | ~16.0.10 |
| Backend/Sync | Supabase (PostgreSQL) | ^2.45.4 |
| Formulários | react-hook-form + Zod | ^7 / ^3 |
| Criptografia | expo-crypto | ~15.0.8 |
| Armazenamento seguro | expo-secure-store | ~15.0.8 |
| Rede | expo-network | ~8.0.8 |
| Testes | Jest + jest-expo | ^29 / ~54 |
| UI | @expo/vector-icons, expo-linear-gradient | — |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    DISPOSITIVO (offline-first)           │
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Screens │───▶│   Hooks      │───▶│  Repositories │  │
│  │ (Expo    │    │ (useVisitas  │    │ (SQLite +     │  │
│  │  Router) │    │  useMoradores│    │  sync_queue)  │  │
│  └──────────┘    │  useResid.)  │    └───────┬───────┘  │
│                  └──────────────┘            │           │
│  ┌──────────────────────────────┐            │           │
│  │         Contexts             │            ▼           │
│  │  AuthContext (sessão 8h)     │    ┌───────────────┐  │
│  │  SyncContext (auto 30s)      │    │   SQLite DB   │  │
│  │  NetworkContext (online?)    │    │  (WAL mode,   │  │
│  │  ThemeContext (dark/light)   │    │  FK enabled)  │  │
│  └──────────────────────────────┘    └───────┬───────┘  │
│                                              │           │
│  ┌──────────────────────────────┐            │           │
│  │       Services               │    sync_queue          │
│  │  syncService (fila→Supabase) │◀───────────┘           │
│  │  authService (login/sessão)  │                        │
│  │  cepService (busca CEP)      │            │           │
│  │  exportService (CSV/Excel)   │            ▼           │
│  └──────────────────────────────┘    ┌───────────────┐  │
│                                      │  SecureStore  │  │
│                                      │  (token, key) │  │
│                                      └───────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ (quando online)
                           ▼
              ┌────────────────────────┐
              │     SUPABASE           │
              │  PostgreSQL + RLS      │
              │  (isolamento por       │
              │   agente_id)           │
              └────────────────────────┘
```

### Fluxo de dados (offline-first)

```
Usuário cria visita
       │
       ▼
visitaRepository.criar()
       │
       ├──▶ INSERT INTO visitas (status_sync='pendente')
       │
       └──▶ syncQueueRepository.enqueue('visitas', 'insert', id, payload)
                           │
                           │ (quando online)
                           ▼
                   syncService.sincronizar()
                           │
                           ├──▶ Supabase.upsert(payload)
                           │
                           └──▶ marcarSucesso() + limparSincronizados()
```

---

## Estrutura de Pastas

```
src/
├── app/                        # Expo Router — telas organizadas por rota
│   ├── (auth)/                 # Rotas públicas (login, cadastro, recuperar-senha)
│   ├── (app)/                  # Rotas protegidas (requer sessão ativa)
│   │   ├── residencia/         # CRUD de residências
│   │   ├── morador/            # CRUD de moradores
│   │   ├── visita/             # Registro e histórico de visitas
│   │   └── prontuario/         # Prontuário clínico por morador
│   └── _layout.tsx             # Root layout (providers)
│
├── components/
│   ├── button/                 # Botão com variantes (primary, ghost, danger...)
│   ├── forms/                  # FormField, SelectField, SwitchField
│   └── ui/                     # Badge, Card, PageHeader, EmptyState, SyncIndicator
│
├── contexts/
│   ├── AuthContext.tsx          # Sessão, login, logout, timeout 8h
│   ├── SyncContext.tsx          # Estado da sync, auto-sync 30s
│   ├── NetworkContext.tsx       # Monitoramento de conectividade
│   └── ThemeContext.tsx         # Dark/light mode persistido
│
├── database/
│   ├── database.ts             # Conexão SQLite singleton (WAL + FK)
│   ├── schema.ts               # CREATE TABLE + migrations + indexes
│   └── repositories/           # Data Access Layer (1 arquivo por entidade)
│       ├── agenteRepository.ts
│       ├── moradorRepository.ts
│       ├── residenciaRepository.ts
│       ├── visitaRepository.ts
│       ├── prontuarioRepository.ts
│       └── syncQueueRepository.ts
│
├── hooks/
│   ├── useVisitas.ts           # Estado + ações para visitas
│   ├── useMoradores.ts         # Estado + ações para moradores
│   └── useResidencias.ts       # Estado + ações para residências
│
├── lib/
│   └── supabase.ts             # Cliente Supabase configurado
│
├── services/
│   ├── syncService.ts          # Motor de sync (fila → Supabase)
│   ├── authService.ts          # Login, sessão, renovação
│   ├── cepService.ts           # Busca endereço por CEP (ViaCEP)
│   └── exportService.ts        # Exportação CSV/Excel
│
├── tasks/
│   └── backgroundSync.ts       # Background task (produção)
│
├── types/
│   └── index.ts                # Todos os tipos, enums e interfaces
│
└── utils/
    ├── constants.ts            # Cores, chaves, limites, timeouts
    ├── encryption.ts           # Hash com salt, XOR local, SecureStore
    ├── validators.ts           # Zod schemas + funções de validação
    ├── formatters.ts           # CPF, CEP, datas, máscaras
    └── lgpd.ts                 # Utilitários LGPD (anonimização, consentimento)
```

---

## Design Patterns

### Repository Pattern
Toda persistência de dados passa por repositórios — as telas nunca acessam o banco diretamente.

```typescript
// ✅ Correto
const visitas = await visitaRepository.listar(agente.id);

// ❌ Nunca faça
const db = await getDatabase();
const rows = await db.getAllAsync('SELECT * FROM visitas');
```

### Context + Hooks (State Management)
Sem Redux ou Zustand — o estado global fica em Contexts, o estado de domínio em hooks customizados.

```
Context  →  estado global (autenticação, tema, rede, sync)
Hook     →  estado de domínio (lista de visitas, moradores, residências)
Screen   →  composição de hooks + UI
```

### Offline-First Queue
Toda escrita local é imediatamente enfileirada na `sync_queue`. A sync acontece de forma assíncrona, sem bloquear o usuário.

### Soft Delete (LGPD)
Nenhum dado é excluído permanentemente. O campo `deleted_at` marca o registro como excluído. O campo `nome` é anonimizado para `"ANONIMIZADO"` na exclusão de moradores.

### Zod Schema Validation
Toda entrada do usuário é validada em runtime por schemas Zod antes de chegar ao repositório.

```typescript
const residenciaSchema = z.object({
  cep: z.string().refine(validarCEP, 'CEP inválido'),
  num_comodos: z.coerce.number().min(1).max(50),
  // ...
});
```

---

## Segurança

### Autenticação
| Mecanismo | Implementação |
|---|---|
| Hash de senha | SHA256 com salt aleatório de 16 bytes (`salt$hash`) |
| Migração automática | Login com senha legada (sem salt) migra para novo formato transparentemente |
| Proteção timing attack | Busca CPF separada da comparação de senha (sem retorno diferencial no SQL) |
| Sessão | Token UUID em `expo-secure-store` (iOS Keychain / Android Keystore) |
| Timeout | Sessão expira em 8 horas, renovada por atividade do usuário |
| Logout | Limpa token, chave de criptografia e cache em memória |

### Armazenamento
| Dado | Onde fica | Proteção |
|---|---|---|
| Senhas | SQLite | SHA256 + salt (não reversível) |
| CPF, cartão SUS, nome, telefone | SQLite | XOR + chave em SecureStore |
| Token de sessão | SecureStore | Keychain/Keystore do OS |
| Chave de criptografia | SecureStore | Keychain/Keystore do OS |

### Banco de dados
- **Parameterized queries** em todas as operações — zero risco de SQL Injection
- **PRAGMA foreign_keys = ON** — integridade referencial garantida
- **PRAGMA journal_mode = WAL** — recuperação de falhas sem corrupção

### Recuperação de senha (LGPD-compliant)
1. Usuário informa CPF + e-mail cadastrado
2. Mensagem de erro **genérica** — não revela qual campo falhou
3. Delay artificial de 800ms — proteção contra ataques de temporização
4. Nova senha usa hash com salt
5. Evento registrado no `audit_log`

### O que está protegido
- ✅ SQL Injection — parameterized queries
- ✅ Rainbow tables — salt nas senhas
- ✅ Timing attack no login — busca separada da comparação
- ✅ Token hijacking — SecureStore nativo
- ✅ Enumeração de usuários — mensagem genérica na recuperação
- ✅ Dados em repouso — campos PII criptografados localmente
- ✅ Sessão infinita — timeout de 8 horas
- ✅ XSS — não aplicável (React Native)
- ✅ CSRF — não aplicável (app nativo sem cookies)

### O que requer atenção em produção
- ⚠️ **RLS no Supabase** — configurar Row-Level Security para isolar dados por `agente_id`
- ⚠️ **Certificate pinning** — para apps financeiros/saúde críticos, fixar certificado TLS
- ⚠️ **Root/jailbreak detection** — considerar `expo-device` para detectar dispositivos comprometidos
- ⚠️ **Ofuscação de código** — habilitar ProGuard/Hermes no build de produção

---

## LGPD

O sistema implementa os principais requisitos da Lei Geral de Proteção de Dados:

| Requisito | Implementação |
|---|---|
| **Finalidade** (Art. 6º, I) | Dados usados exclusivamente para atenção básica à saúde pública |
| **Adequação** (Art. 6º, II) | Coleta limitada ao necessário para visitas domiciliares |
| **Transparência** (Art. 6º, VI) | Aviso LGPD na tela de login e cadastro |
| **Segurança** (Art. 46) | Criptografia local, hash com salt, SecureStore |
| **Prevenção** (Art. 6º, VIII) | Validações impedem dados inválidos ou desnecessários |
| **Direito de exclusão** (Art. 18, VI) | Soft delete + anonimização do nome |
| **Rastreabilidade** (Art. 37) | `audit_log` registra todas as ações sensíveis |
| **Consentimento** (Art. 7º, I) | Tabela `consentimentos` por tipo de dado |
| **Bases legais** (Art. 7º, II) | Saúde pública — execução de políticas públicas |

### Dados coletados e finalidade

| Dado | Finalidade | Base Legal |
|---|---|---|
| Nome, CPF, data nascimento | Identificação do morador | Art. 7º, II (saúde pública) |
| Condições de saúde, medicamentos | Acompanhamento clínico | Art. 11, II, b (saúde) |
| Vulnerabilidade social | Encaminhamento assistência social | Art. 7º, II |
| Dados de gestante, puericultura | Atenção pré-natal e infantil | Art. 11, II, b |
| Localização (endereço) | Planejamento de visitas | Art. 7º, II |

---

## Instalação e Configuração

### Pré-requisitos
- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- Android Studio ou Xcode (para emuladores)

### Setup

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/ConectAgente.git
cd ConectAgente/ConectAgent

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# 4. Inicie o app
npx expo start

# Para Android
npx expo start --android

# Para iOS
npx expo start --ios
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Supabase (obrigatório para sincronização)
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# API (opcional — para funcionalidades futuras)
EXPO_PUBLIC_API_URL=https://api.conectagente.com.br/v1
```

> **Nota de segurança**: A `ANON_KEY` do Supabase é uma chave pública — pode estar no código. A segurança real depende das políticas RLS configuradas no servidor.

---

## Testes

```bash
# Rodar todos os testes
npm test

# Modo watch (desenvolvimento)
npm run test -- --watchAll

# Com cobertura de código
npm run test:ci
```

### Cobertura mínima exigida: 60%

| Módulo | Cobertura |
|---|---|
| `src/utils/validators.ts` | CPF, SUS, CEP, datas, email, telefone |
| `src/services/authService.ts` | Login offline, sessão, logout, renovação |
| `src/services/syncService.ts` | Processamento da fila, tratamento de erros |
| `src/database/repositories/` | CRUD de agentes, moradores, residências, visitas |
| `src/hooks/` | useVisitas, useResidencias |
| `src/components/ui/` | Badge, Card, EmptyState, Button |

### Mocks utilizados
- `expo-secure-store` — armazenamento seguro simulado
- `expo-sqlite` — banco de dados simulado
- `expo-crypto` — hash determinístico para testes
- `@supabase/supabase-js` — cliente simulado

---

## Supabase — Configuração RLS

**OBRIGATÓRIO para produção.** Configure as seguintes políticas no painel do Supabase:

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE residencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE moradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

-- Política: agente só acessa seus próprios dados
CREATE POLICY "agente_isolation" ON residencias
  FOR ALL USING (agente_id = auth.uid());

CREATE POLICY "agente_isolation" ON moradores
  FOR ALL USING (agente_id = auth.uid());

CREATE POLICY "agente_isolation" ON visitas
  FOR ALL USING (agente_id = auth.uid());

-- Repita para: agendamentos, prontuarios, metas_visitas, audit_log
```

---

## Roadmap

### v1.1 — Em desenvolvimento
- [ ] Painel web administrativo (Next.js + Supabase)
  - Dashboard com estatísticas por equipe
  - Gestão de agentes (criar, ativar, desativar)
  - Mapa de cobertura territorial
  - Exportação de relatórios gerenciais
- [ ] Sincronização em background (build de produção)
- [ ] Assinatura digital do morador na visita

### v1.2 — Planejado
- [ ] Notificações push para agendamentos
- [ ] Integração com e-SUS/SISAB (sistema nacional)
- [ ] Modo supervisor — coordenador vê equipe completa
- [ ] Foto do domicílio na visita

### Segurança — Backlog
- [ ] Certificate pinning (TLS)
- [ ] Root/jailbreak detection
- [ ] Ofuscação de código (ProGuard + Hermes)
- [ ] Upgrade para AES-256-GCM (criptografia local)
- [ ] Política de senha configurável (complexidade mínima)

---

## Licença

Proprietário — ConectAgente © 2026. Todos os direitos reservados.

Este software é destinado ao uso por Secretarias Municipais de Saúde e equipes de Atenção Básica credenciadas.
