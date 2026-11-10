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
- [Painel Administrativo](#painel-administrativo)
- [Segurança](#segurança)
- [LGPD](#lgpd)
- [Instalação e Configuração](#instalação-e-configuração)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Testes](#testes)
- [Supabase: Configuração RLS](#supabase-configuração-rls)
- [Roadmap](#roadmap)

---

## Visão Geral

O ConectAgente resolve um problema crítico da Atenção Básica: ACS muitas vezes trabalham em áreas sem internet e precisam registrar visitas, coletar dados de saúde e acompanhar famílias mesmo offline. O app:

- Funciona **100% offline**: dados salvos localmente no SQLite
- **Sincroniza automaticamente** quando há internet (fila offline-first)
- Armazena **prontuários completos** por morador (saúde geral, gestante, puericultura, saúde da mulher, social)
- Controla **metas mensais** de visitas
- **Agenda consultas** com visão de calendário
- Exporta **relatórios** em CSV/Excel
- Mantém **histórico completo** de todas as visitas por residência
- **Painel administrativo** para gestores com estatísticas globais, audit log LGPD e gerenciamento de equipe

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
| UI | @expo/vector-icons, expo-linear-gradient | - |

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

### Roteamento (Expo Router)

```
app/
├── index.tsx              → redireciona conforme perfil (agente ou admin)
├── (auth)/                → telas públicas (login, cadastro, recuperar-senha)
├── (app)/                 → rotas do agente de saúde (requer sessão)
└── (admin)/               → rotas do administrador (requer is_admin = true)
```

---

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/                 # Login, cadastro, recuperação de senha
│   ├── (app)/                  # Área do agente: residências, moradores, visitas, prontuário
│   ├── (admin)/                # Área do administrador: painel, agentes, relatórios, sistema
│   └── _layout.tsx             # Root layout com todos os providers
│
├── components/
│   ├── button/                 # Botão com variantes (primary, ghost, danger...)
│   ├── forms/                  # FormField, SelectField, SwitchField
│   └── ui/                     # Badge, Card, PageHeader, EmptyState, SyncIndicator
│
├── contexts/
│   ├── AuthContext.tsx          # Sessão, login (retorna Agente), logout, timeout 8h
│   ├── SyncContext.tsx          # Estado da sync, auto-sync 30s
│   ├── NetworkContext.tsx       # Monitoramento de conectividade
│   └── ThemeContext.tsx         # Dark/light mode persistido
│
├── database/
│   ├── database.ts             # Conexão SQLite singleton (WAL + FK + migrations)
│   ├── schema.ts               # CREATE TABLE + migrations + indexes
│   └── repositories/
│       ├── agenteRepository.ts     # Auth, rate limiting, CRUD de agentes
│       ├── moradorRepository.ts    # CRUD + busca com SQL LIKE seguro
│       ├── residenciaRepository.ts
│       ├── visitaRepository.ts
│       ├── prontuarioRepository.ts
│       └── syncQueueRepository.ts
│
├── hooks/
│   ├── useVisitas.ts
│   ├── useMoradores.ts
│   └── useResidencias.ts
│
├── services/
│   ├── syncService.ts          # Motor de sync (fila → Supabase)
│   ├── authService.ts          # Login, sessão, renovação
│   ├── cepService.ts           # Busca endereço por CEP (ViaCEP)
│   └── exportService.ts        # Exportação CSV/Excel
│
├── types/
│   └── index.ts                # Todos os tipos, enums e interfaces
│
└── utils/
    ├── constants.ts            # Cores, chaves, limites, timeouts
    ├── encryption.ts           # hash de senha com salt e sorteio do código de recuperação
    ├── validators.ts           # Zod schemas + validações + escapeForLike()
    ├── formatters.ts           # CPF, CEP, datas, máscaras
    └── lgpd.ts                 # Anonimização, consentimento
```

---

## Design Patterns

### Repository Pattern
Toda persistência de dados passa por repositórios: as telas nunca acessam o banco diretamente.

```typescript
// ✅ Correto
const visitas = await visitaRepository.listar(agente.id);

// ❌ Nunca faça
const db = await getDatabase();
const rows = await db.getAllAsync('SELECT * FROM visitas');
```

### Context + Hooks (State Management)
Sem Redux ou Zustand: o estado global fica em Contexts, o estado de domínio em hooks customizados.

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

## Painel Administrativo

O administrador acessa uma área separada (`/(admin)`) com tema roxo, distinta da área do agente.

| Tela | Funcionalidade |
|---|---|
| **Painel** | Estatísticas globais (agentes, residências, moradores, visitas do mês/hoje, sync pendente) |
| **Agentes** | Lista completa com busca, estatísticas por agente, definição de metas mensais |
| **Residências** | Todas as residências com moradores e histórico de visitas |
| **Visitas** | Todas as visitas com filtros por status e agente, detalhes de sinais vitais e checklist |
| **Sistema** | Estatísticas do banco, novo código de recuperação do admin, audit log LGPD paginado |

### Administrador do aparelho

Não existe senha padrão. Na primeira abertura, a tela de entrada mostra **Configurar
administrador**: quem instala escolhe a senha e recebe um código de recuperação, mostrado uma
única vez. Depois disso, o login do administrador é o CPF `111.444.777-35` com a senha escolhida.

O CPF não é segredo e não precisa ser. Nenhuma senha é sorteada, guardada ou exibida pelo
aplicativo.

---

## Segurança

### Autenticação

| Mecanismo | Implementação |
|---|---|
| Hash de senha | PBKDF2-HMAC-SHA256, 100 mil iterações, sal de 16 bytes: `pbkdf2-sha256$iteracoes$sal$hash` |
| Migração automática | Login com senha no formato antigo (SHA-256 com ou sem sal) regrava no PBKDF2 |
| Timing-safe | `verificarSenha` é sempre executada, contra um PBKDF2 de mesmo custo quando o CPF não existe |
| Rate limiting | 5 tentativas por CPF → bloqueio de 15 minutos, gravado no aparelho (sobrevive ao reinício) |
| Sessão | Token UUID em `expo-secure-store` (iOS Keychain / Android Keystore) |
| Timeout | Sessão expira em 8 horas, renovada por atividade |
| Logout | Limpa token, chave de criptografia e cache em memória |

### Banco do aparelho cifrado

Desde a 1.2.0 o arquivo do SQLite é cifrado inteiro com **SQLCipher**. A chave de 256 bits é
sorteada no primeiro uso, fica no SecureStore (`database/chave.ts`) e entra com `PRAGMA key`
antes de qualquer leitura (`database/database.ts`). A cifra campo a campo que existia antes
(SHA-256 em modo contador, sem MAC) nunca foi chamada por nenhuma tela e foi removida; o motivo
está no cabeçalho de `utils/encryption.ts`.

| Dado | Proteção |
|---|---|
| Senha | PBKDF2-HMAC-SHA256 + sal (irreversível e lento de propósito) |
| CPF, cartão SUS, nome, telefone e o resto do banco | SQLCipher no arquivo inteiro |
| Token de sessão | SecureStore (Keychain/Keystore do OS) |
| Chave do banco | SecureStore (Keychain/Keystore do OS) |

A sincronização só aceita a cadeia de certificado do Supabase: o pin fica na configuração de
segurança de rede do Android (`plugins/fixar-certificado.js`), com expiração em 01/05/2027.

### Banco de dados

- **Parameterized queries** em todas as operações: zero risco de SQL Injection
- **`escapeForLike()`**: escapa metacaracteres `%`, `_`, `\` antes de queries com `LIKE`
- **`PRAGMA foreign_keys = ON`**: integridade referencial garantida
- **`PRAGMA journal_mode = WAL`**: recuperação de falhas sem corrupção
- **Migrations específicas**: erros de `duplicate column` são ignorados; outros são relançados

### Recuperação de senha

1. Cada conta recebe um **código de recuperação** (`XXXX-XXXX-XXXX`, 60 bits) ao ser criada,
   mostrado uma única vez. Só o hash fica no aparelho, no SecureStore
2. Em "Esqueci minha senha" a pessoa informa CPF, código e a senha nova
3. Mensagem de erro **genérica**: não revela se o erro foi no CPF ou no código
4. O código vale uma vez; depois da troca o aplicativo mostra um código novo
5. 5 tentativas erradas por CPF bloqueiam por 15 minutos
6. Quem perdeu o código pede ao administrador, que gera um novo na tela de agentes
7. Evento registrado no `audit_log`

A recuperação antiga pedia CPF e e-mail, que não são segredo: os do administrador estavam na
tela de entrada e no código-fonte, e qualquer pessoa com o aparelho trocava a senha dele.

A troca vale para entrar no aparelho. Se o aparelho ainda tem a sessão do servidor da mesma
pessoa, a senha do servidor muda junto; senão o aplicativo avisa no login que a sincronização
está parada, e a coordenação redefine a senha de sincronização no painel (Agentes → detalhes).

Administrador que perdeu a senha e o código usa **"Administrador perdeu a senha e o código?"** na
tela de entrada: o aparelho é reiniciado sem reinstalar, depois de mostrar quantos registros ainda
não foram para o servidor e pedir que se digite `APAGAR`.

### O que está protegido

- SQL Injection: parameterized queries + escapeForLike()
- Rainbow tables: salt nas senhas
- Força bruta com o banco em mãos: PBKDF2 com 100 mil iterações
- Timing attack no login: verificarSenha sempre executada com hash dummy
- Brute force: rate limiting (5 tentativas / 15 min de bloqueio), que não zera ao reabrir o app
- Token hijacking: SecureStore nativo
- Enumeração de usuários: mensagem genérica na recuperação
- Troca de senha alheia: recuperação exige código de recuperação, e não CPF e e-mail
- Dados em repouso: banco do aparelho cifrado inteiro com SQLCipher
- Interceptação na sincronização: certificado do Supabase fixado
- Sessão infinita: timeout de 8 horas
- XSS: não aplicável (React Native)
- CSRF: não aplicável (app nativo sem cookies)

### O que requer atenção em produção

- **RLS no Supabase**: configurar Row-Level Security para isolar dados por `agente_id`
- **Root/jailbreak detection**: considerar `expo-device` para detectar dispositivos comprometidos
- **Ofuscação de código**: habilitar ProGuard/Hermes no build de produção

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
| **Rastreabilidade** (Art. 37) | `audit_log` registra ações sensíveis (reset de senha, criação de agentes) |
| **Consentimento** (Art. 7º, I) | Tabela `consentimentos` por tipo de dado |
| **Bases legais** (Art. 7º, III e VIII) | Execução de política pública e tutela da saúde |

### Dados coletados e finalidade

| Dado | Finalidade | Base Legal |
|---|---|---|
| Nome, CPF, data nascimento | Identificação do morador | Art. 7º, III (política pública) |
| Condições de saúde, medicamentos | Acompanhamento clínico | Art. 11, II, b e f (política pública e tutela da saúde) |
| Vulnerabilidade social | Encaminhamento assistência social | Art. 7º, III |
| Dados de gestante, puericultura | Atenção pré-natal e infantil | Art. 11, II, b e f |
| Localização (endereço) | Planejamento de visitas | Art. 7º, III |

---

## Instalação e Configuração

### Pré-requisitos

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- Android Studio ou Xcode (para emuladores)

### Setup

```bash
# 1. Clone o repositório
git clone https://github.com/CamilaRaimundo/ConectAgente.git
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

Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base):

```env
# Supabase (obrigatório para sincronização)
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> **Nota:** A `ANON_KEY` do Supabase é uma chave pública. A segurança real depende das políticas RLS configuradas no servidor.

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

### Resultados atuais

```
Test Suites: 18 passed
Tests:       263 passed
Coverage:    ~80% statements / ~83% lines
```

### Cobertura mínima exigida: 60%

| Módulo | O que é testado |
|---|---|
| `utils/encryption.ts` | hash com salt, verificarSenha (novo e legado), sorteio de senha forte, e que a cifra de campo não voltou |
| `utils/validators.ts` | CPF, SUS, CEP, datas, email, telefone, escapeForLike, schemas Zod |
| `repositories/agenteRepository` | Criar, autenticar, rate limiting, migração legado, verificarIdentidade, resetarSenha |
| `repositories/moradorRepository` | CRUD, busca com LIKE seguro |
| `repositories/residenciaRepository` | CRUD, soft delete |
| `repositories/visitaRepository` | Criar, listar, estatísticas |
| `services/authService` | Login offline, sessão, logout, renovação |
| `services/syncService` | Processamento da fila, tratamento de erros |
| `hooks/` | useVisitas, useResidencias |
| `components/ui/` | Badge, Card, EmptyState, Button |

### Mocks utilizados

- `expo-secure-store`: armazenamento seguro simulado
- `expo-sqlite`: banco de dados simulado
- `expo-crypto`: hash determinístico para testes
- `@supabase/supabase-js`: cliente simulado

---

## Supabase: Configuração RLS

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

### v1.0 (concluído)

- [x] App mobile offline-first (React Native + Expo)
- [x] CRUD completo: residências, moradores, visitas, prontuários
- [x] Sincronização com Supabase (fila offline-first)
- [x] Autenticação local com sessão de 8h
- [x] Banco do aparelho cifrado com SQLCipher + chave no SecureStore
- [x] Certificate pinning do Supabase (TLS)
- [x] Conformidade LGPD (soft delete, anonimização, audit log, consentimento)
- [x] Calendário de agendamentos
- [x] Metas mensais de visitas
- [x] Exportação CSV/Excel
- [x] Área administrativa no app mobile

### v1.1 (concluído)

- [x] Painel web administrativo (Next.js 15 + Supabase): `conectagente-web/`
  - Dashboard com estatísticas por equipe e por microárea
  - Gestão de agentes, famílias, moradores e visitas
  - Mapa de cobertura territorial
  - Exportação de relatórios gerenciais
  - Rate limiting, error boundaries, validação de entrada
  - 220 testes unitários (Jest + Testing Library)
  - Sistema de registro com aprovação de admin

### v1.2 (em desenvolvimento)

- [ ] Sincronização em background (build de produção)
- [ ] Assinatura digital do morador na visita
- [ ] Foto do domicílio na visita

### v1.3 (planejado)

- [ ] Notificações push para agendamentos
- [ ] Integração com e-SUS/SISAB (sistema nacional)
- [ ] Modo supervisor: coordenador vê equipe completa
- [x] Deploy do painel web em produção (Vercel + Supabase cloud)

### Segurança: Backlog

- [ ] Root/jailbreak detection
- [ ] Ofuscação de código (ProGuard + Hermes)
- [ ] Política de senha configurável (complexidade mínima)
- [ ] 2FA para administradores

---

## Licença

Proprietário: ConectAgente © 2026. Todos os direitos reservados.

Este software é destinado ao uso por Secretarias Municipais de Saúde e equipes de Atenção Básica credenciadas.
