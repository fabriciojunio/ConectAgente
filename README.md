# ConectAgente

---

## Índice

1. [Sobre o Projeto](#1-sobre-o-projeto)
2. [Funcionalidades](#2-funcionalidades)
3. [Tecnologias](#3-tecnologias)
4. [Arquitetura](#4-arquitetura)
5. [Banco de Dados](#5-banco-de-dados)
6. [Tipos e Interfaces](#6-tipos-e-interfaces)
7. [Navegação e Telas](#7-navegação-e-telas)
8. [Segurança](#8-segurança)
9. [LGPD](#9-lgpd)
10. [Testes](#10-testes)
11. [Instalação](#11-instalação)
12. [Variáveis de Ambiente](#12-variáveis-de-ambiente)
13. [Supabase — RLS](#13-supabase--rls)
14. [Painel Web — conectagente-web](#14-painel-web--conectagente-web)
15. [Roadmap](#15-roadmap)

---

## 1. Sobre o Projeto

O **ConectAgente** é um aplicativo mobile desenvolvido para **Agentes Comunitários de Saúde (ACS)** da Atenção Básica do SUS. O ACS visita famílias cadastradas em sua microárea, registrando condições de saúde, acompanhando gestantes, crianças, idosos e situações de vulnerabilidade social.

### Problema resolvido

ACS frequentemente trabalham em áreas com cobertura de internet instável ou inexistente. Sistemas tradicionais exigem conexão constante, impossibilitando o registro em campo. O ConectAgente resolve isso com arquitetura **offline-first**: o agente registra tudo localmente mesmo sem internet, e os dados sincronizam automaticamente quando a conexão é restabelecida.

### Perfis de acesso

| Perfil | Acesso | Tema visual |
|---|---|---|
| **Agente de Saúde** | Área `/(app)` | Verde |
| **Administrador** | Área `/(admin)` | Roxo |

O roteamento é feito automaticamente no login: `agente.is_admin = true` redireciona para `/(admin)`, caso contrário para `/(app)`.

---

## 2. Funcionalidades

### Área do Agente `/(app)`

| Funcionalidade | Descrição |
|---|---|
| **Dashboard** | Saudação por hora do dia, foto de perfil (câmera/galeria), estatísticas do mês, últimas residências |
| **Residências** | Cadastro com busca automática de endereço por CEP (ViaCEP), tipo de imóvel, número de cômodos, animais |
| **Moradores** | Ficha completa: CPF, Cartão SUS, data de nascimento, escolaridade, profissão, benefícios sociais, medicamentos |
| **Prontuários** | 5 módulos clínicos por morador (detalhes na seção de telas) |
| **Visitas** | Registro com sinais vitais (PA, glicemia, peso), checklist de medicamentos e vacinas, encaminhamentos |
| **Calendário** | Visualização de agendamentos por dia (react-native-calendars) |
| **Metas** | Acompanhamento da meta mensal de visitas com progresso visual |
| **Busca Global** | Localiza moradores por nome, CPF ou cartão SUS |
| **Relatórios** | Exportação em CSV e Excel (xlsx) |
| **Recuperação de senha** | Via CPF + e-mail cadastrado, sem revelar qual campo é inválido |

### Área do Administrador `/(admin)`

| Tela | Funcionalidade |
|---|---|
| **Painel** | 7 indicadores globais + top 3 agentes do mês + últimas 5 visitas |
| **Agentes** | Lista com busca, estatísticas individuais (residências, moradores, visitas), definir metas |
| **Residências** | Todas as residências da equipe com moradores e histórico |
| **Visitas** | Todas as visitas com filtros por status e agente |
| **Sistema** | Estatísticas do banco, credenciais admin, audit log LGPD paginado |

---

## 3. Tecnologias

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Expo SDK | ~54.0.0 |
| Runtime | React Native | 0.81.5 |
| Linguagem | TypeScript | ~5.8.3 |
| Navegação | Expo Router (file-based) | ~6.0.23 |
| Banco local | expo-sqlite (WAL + FTS) | ~16.0.10 |
| Backend / Sync | Supabase (PostgreSQL + RLS) | ^2.45.4 |
| Formulários | React Hook Form | ^7.54.2 |
| Validação | Zod | ^3.24.2 |
| Criptografia | expo-crypto (SHA-256) | ~15.0.8 |
| Armazenamento seguro | expo-secure-store | ~15.0.8 |
| Monitoramento de rede | expo-network | ~8.0.8 |
| Calendário | react-native-calendars | ^1.1309.0 |
| Exportação | xlsx | ^0.18.5 |
| CEP | ViaCEP API | — |
| HTTP | axios | ^1.7.9 |
| Ícones | @expo/vector-icons (Ionicons) | ^15.0.3 |
| Gradientes | expo-linear-gradient | ~15.0.8 |
| Câmera / Galeria | expo-image-picker | ~17.0.10 |
| Testes | Jest + jest-expo | ^29 / ~54 |

---

## 4. Arquitetura

### Diagrama geral

```
┌──────────────────────────────────────────────────────────────┐
│                     DISPOSITIVO MÓVEL                        │
│                                                              │
│   ┌─────────────┐     ┌──────────────┐   ┌──────────────┐   │
│   │   Telas     │────▶│    Hooks     │──▶│ Repositories │   │
│   │ Expo Router │     │ useVisitas   │   │  (SQLite)    │   │
│   │ (app/admin) │     │ useMoradores │   └──────┬───────┘   │
│   └─────────────┘     │ useResidenc. │          │           │
│                       └──────────────┘          ▼           │
│   ┌─────────────────────────────┐      ┌──────────────┐     │
│   │         Contexts            │      │   SQLite DB  │     │
│   │  AuthContext  (sessão 8h)   │      │  WAL + FK    │     │
│   │  SyncContext  (auto 30s)    │      │  16 tabelas  │     │
│   │  NetworkContext(conectado?) │      └──────┬───────┘     │
│   │  ThemeContext (dark/light)  │             │             │
│   └─────────────────────────────┘        sync_queue         │
│                                               │             │
│   ┌─────────────────────────────┐             ▼             │
│   │         Services            │   ┌──────────────────┐   │
│   │  syncService  (fila→Supab.) │   │   SecureStore    │   │
│   │  authService  (login/sessão)│   │  (token + chave) │   │
│   │  cepService   (ViaCEP)      │   └──────────────────┘   │
│   │  exportService(CSV/Excel)   │                           │
│   └─────────────────────────────┘                           │
└────────────────────────────┬─────────────────────────────────┘
                             │ quando online
                             ▼
               ┌─────────────────────────┐
               │        SUPABASE         │
               │   PostgreSQL + RLS      │
               │  (dados por agente_id)  │
               └─────────────────────────┘
```

### Padrões de projeto

#### Repository Pattern
Toda leitura e escrita no banco passa por repositórios. Telas nunca acessam o SQLite diretamente.

```typescript
// ✅ Correto
const visitas = await visitaRepository.listar(agente.id);

// ❌ Nunca faça isso nas telas
const db = await getDatabase();
const rows = await db.getAllAsync('SELECT * FROM visitas');
```

#### Context + Hooks
Estado global em Contexts React; estado de domínio em custom hooks.

```
AuthContext   → sessão, login, logout, timeout automático
SyncContext   → status e disparo de sincronização
NetworkContext→ monitoramento de conectividade em tempo real
ThemeContext  → dark/light mode persistido

useVisitas    → lista, criar, filtrar visitas
useMoradores  → CRUD de moradores
useResidencias→ CRUD de residências
```

#### Offline-First Queue

```
Usuário registra uma visita
        │
        ▼
visitaRepository.criar()
        │
        ├──▶ INSERT INTO visitas (status_sync = 'pendente')
        └──▶ syncQueue.enqueue('visitas', 'insert', id, payload)
                        │
                        │ a cada 30 segundos quando online
                        ▼
              syncService.sincronizar()
                        │
                        ├──▶ Supabase.upsert(payload)
                        └──▶ UPDATE status_sync = 'sincronizado'
```

#### Zod Schema Validation
Toda entrada do usuário é validada antes de chegar ao repositório.

```typescript
const residenciaSchema = z.object({
  cep:        z.string().refine(validarCEP, 'CEP inválido'),
  logradouro: z.string().min(3),
  numero:     z.string().min(1),
  estado:     z.string().length(2),
  tipo_imovel:z.enum(['proprio', 'alugado', 'cedido', 'outros']),
  num_comodos:z.coerce.number().min(1).max(50),
  tem_animais:z.boolean(),
});
```

### Estrutura de pastas

```
ConectAgent/
├── assets/images/          # Logo, ícone, splash, adaptive-icon
├── src/
│   ├── app/
│   │   ├── _layout.tsx     # Root layout — monta todos os Providers
│   │   ├── index.tsx       # Redireciona: agente → /(app), admin → /(admin)
│   │   ├── (auth)/         # Público: login, cadastro, recuperar-senha
│   │   ├── (app)/          # Agente: dashboard, residências, moradores,
│   │   │   ├── index.tsx   #   visitas, prontuário, calendário, metas...
│   │   │   ├── residencia/ #   [id].tsx, nova.tsx
│   │   │   ├── morador/    #   [id].tsx, novo.tsx
│   │   │   ├── visita/     #   [id].tsx, nova.tsx
│   │   │   └── prontuario/ #   [moradorId].tsx
│   │   └── (admin)/        # Admin: painel, agentes, visitas, sistema
│   │
│   ├── components/
│   │   ├── button/         # Button com variantes (primary, ghost, danger...)
│   │   ├── input/          # Input estilizado com máscara
│   │   ├── forms/          # FormField, SelectField, SwitchField
│   │   └── ui/             # Badge, Card, PageHeader, EmptyState,
│   │                       # LoadingSpinner, SyncIndicator
│   ├── contexts/
│   │   ├── AuthContext.tsx # login() retorna Agente (roteamento imediato)
│   │   ├── SyncContext.tsx
│   │   ├── NetworkContext.tsx
│   │   └── ThemeContext.tsx
│   │
│   ├── database/
│   │   ├── database.ts     # Singleton SQLite (WAL + FK + migrations)
│   │   ├── schema.ts       # CREATE TABLE + índices + migrations
│   │   └── repositories/
│   │       ├── agenteRepository.ts     # auth, rate limiting, admin
│   │       ├── moradorRepository.ts    # CRUD + busca LIKE seguro
│   │       ├── residenciaRepository.ts
│   │       ├── visitaRepository.ts
│   │       ├── prontuarioRepository.ts
│   │       └── syncQueueRepository.ts
│   │
│   ├── hooks/
│   │   ├── useVisitas.ts
│   │   ├── useMoradores.ts
│   │   └── useResidencias.ts
│   │
│   ├── services/
│   │   ├── authService.ts    # Login local + sessão no SecureStore
│   │   ├── syncService.ts    # Processa sync_queue → Supabase
│   │   ├── cepService.ts     # Busca endereço por CEP (ViaCEP)
│   │   └── exportService.ts  # Gera CSV/Excel
│   │
│   ├── types/index.ts        # Todos os tipos, enums e interfaces
│   └── utils/
│       ├── encryption.ts     # SHA-256-CTR + hash com salt + SecureStore
│       ├── validators.ts     # Zod schemas + validações + escapeForLike()
│       ├── formatters.ts     # CPF, CEP, datas, máscaras
│       ├── constants.ts      # Cores, chaves, limites
│       └── lgpd.ts           # Anonimização, consentimento
│
├── supabase/schema.sql       # Schema PostgreSQL + políticas RLS
├── .env.example
├── app.json
├── package.json
└── tsconfig.json
```

---

## 5. Banco de Dados

### 16 tabelas SQLite

```
agentes                  → usuários do sistema (agentes e admin)
residencias              → domicílios cadastrados
moradores                → pessoas por residência
prontuarios              → prontuário por morador (versionado)
prontuario_saude         → condições crônicas, aferições, consultas
prontuario_gestante      → pré-natal, vacinas, suplementos
prontuario_puericultura  → crianças: peso, altura, vacinas, escola
prontuario_mulher        → papanicolau, mamografia, anticoncepção
prontuario_social        → vulnerabilidade, violência, saúde mental
medicamentos             → lista de medicamentos por morador
vacinas                  → cartão de vacinas
receitas                 → receitas médicas
visitas                  → registro de visitas domiciliares
agendamentos             → consultas agendadas
metas_visitas            → meta mensal por agente
sync_queue               → fila de operações pendentes de sync
audit_log                → rastreamento LGPD de ações sensíveis
consentimentos           → base legal LGPD por morador e tipo de dado
```

### Configurações SQLite

```sql
PRAGMA foreign_keys = ON;    -- integridade referencial
PRAGMA journal_mode = WAL;   -- recuperação sem corrupção
PRAGMA synchronous = NORMAL; -- equilíbrio segurança/performance
```

### Índices

```sql
CREATE INDEX idx_moradores_residencia  ON moradores(residencia_id);
CREATE INDEX idx_moradores_cpf         ON moradores(cpf);
CREATE INDEX idx_moradores_cartao_sus  ON moradores(cartao_sus);
CREATE INDEX idx_visitas_agente        ON visitas(agente_id);
CREATE INDEX idx_visitas_data          ON visitas(data_visita);
CREATE INDEX idx_agendamentos_data     ON agendamentos(data_agendada);
CREATE INDEX idx_sync_queue_status     ON sync_queue(status);
CREATE INDEX idx_residencias_agente    ON residencias(agente_id);
```

### Soft Delete (LGPD)

Nenhum registro é excluído fisicamente. O campo `deleted_at` marca exclusão lógica, e o nome do morador é substituído por `"ANONIMIZADO"`:

```sql
UPDATE moradores
SET deleted_at = datetime('now'), nome = 'ANONIMIZADO'
WHERE id = ?;

-- Queries sempre filtram registros excluídos
SELECT * FROM moradores WHERE deleted_at IS NULL;
```

### Migrations

Ao inicializar, o app executa cada `ALTER TABLE` individualmente. Erros de `duplicate column` ou `already exists` são ignorados; outros erros são relançados:

```typescript
} catch (err) {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
    throw err;
  }
}
```

---

## 6. Tipos e Interfaces

Todos definidos em `src/types/index.ts`.

### Enums

```typescript
enum Sexo {
  masculino = 'masculino',
  feminino  = 'feminino',
  outro     = 'outro',
}

enum TipoImovel {
  proprio = 'proprio',
  alugado = 'alugado',
  cedido  = 'cedido',
  outros  = 'outros',
}

enum StatusVisita {
  agendada      = 'agendada',
  realizada     = 'realizada',
  cancelada     = 'cancelada',
  nao_encontrado= 'nao_encontrado',
}

enum StatusSync {
  pendente      = 'pendente',
  sincronizado  = 'sincronizado',
  erro          = 'erro',
}

enum Escolaridade {
  sem_escolaridade       = 'sem_escolaridade',
  fundamental_incompleto = 'fundamental_incompleto',
  fundamental_completo   = 'fundamental_completo',
  medio_incompleto       = 'medio_incompleto',
  medio_completo         = 'medio_completo',
  superior_incompleto    = 'superior_incompleto',
  superior_completo      = 'superior_completo',
  pos_graduacao          = 'pos_graduacao',
}

enum NivelVulnerabilidade {
  nenhum = 'nenhum',
  baixo  = 'baixo',
  medio  = 'medio',
  alto   = 'alto',
  critico= 'critico',
}
```

### Interfaces principais

```typescript
interface Agente {
  id:             string;   // UUID
  nome:           string;
  cpf:            string;   // 11 dígitos sem formatação
  email:          string;
  telefone?:      string;
  area_atuacao:   string;
  unidade_saude:  string;
  ativo:          boolean;
  is_admin:       boolean;
  created_at:     string;   // ISO 8601
  updated_at:     string;
}

interface Residencia {
  id:                    string;
  cep:                   string;
  logradouro:            string;
  numero:                string;
  complemento?:          string;
  bairro:                string;
  cidade:                string;
  estado:                string;  // 2 chars
  tipo_imovel:           TipoImovel;
  num_comodos:           number;
  tem_animais:           boolean;
  animais_info?:         string;
  morador_responsavel_id?: string;
  agente_id:             string;
  status_sync:           StatusSync;
  created_at:            string;
  updated_at:            string;
  deleted_at?:           string | null;
}

interface Morador {
  id:                    string;
  residencia_id:         string;
  nome:                  string;
  cpf?:                  string;
  cartao_sus?:           string;
  telefone?:             string;
  data_nascimento:       string;  // DD/MM/AAAA
  cidade_nascimento?:    string;
  nome_pai?:             string;
  nome_mae?:             string;
  sexo:                  Sexo;
  escolaridade?:         Escolaridade;
  profissao?:            string;
  tem_doenca:            boolean;
  doencas?:              string;
  beneficio_bolsa_familia: boolean;
  tem_convenio:          boolean;
  convenio_nome?:        string;
  toma_medicamento:      boolean;
  medicamentos_lista?:   string;
  is_responsavel:        boolean;
  agente_id:             string;
  status_sync:           StatusSync;
  created_at:            string;
  updated_at:            string;
  deleted_at?:           string | null;
}

interface Visita {
  id:                      string;
  residencia_id:           string;
  morador_id?:             string;
  agente_id:               string;
  data_visita:             string;  // YYYY-MM-DD
  status:                  StatusVisita;
  motivo_visita?:          string;
  queixas?:                string;
  observacoes?:            string;
  pa_visita?:              string;  // ex: "120/80"
  glicemia_visita?:        number;
  peso_visita?:            number;
  medicamentos_em_dia?:    boolean;
  cartao_vacinas_em_dia?:  boolean;
  encaminhamentos?:        string;
  precisa_agendamento?:    boolean;
  especialidade_agendamento?: string;
  status_sync:             StatusSync;
  created_at:              string;
  updated_at:              string;
}
```

---

## 7. Navegação e Telas

### Fluxo de navegação

```
Abertura
    │
    ▼
index.tsx
    ├── sem sessão ──────────────────────▶ /(auth)/login
    │
    └── com sessão
            ├── is_admin = true  ────────▶ /(admin)
            └── is_admin = false ────────▶ /(app)
```

### (auth) — Área pública

| Tela | Rota | Descrição |
|---|---|---|
| Login | `/(auth)/login` | CPF com formatação automática + senha; redireciona por perfil; exibe erro de rate limiting |
| Cadastro | `/(auth)/cadastro` | Disponível apenas se não houver agente cadastrado no dispositivo |
| Recuperar senha | `/(auth)/recuperar-senha` | CPF + e-mail; mensagem genérica (não revela campo inválido) |

### (app) — Área do Agente (5 abas)

| Aba | Ícone | Telas acessíveis |
|---|---|---|
| Home | house | Dashboard com estatísticas e foto de perfil |
| Residências | home | Lista + nova + detalhe (moradores e visitas) |
| Visitas | clipboard | Lista + nova + detalhe com sinais vitais |
| Calendário | calendar | Agendamentos por dia |
| Mais | menu | Metas, busca, relatórios, configurações, logout |

**Telas de detalhe (Stack):**

| Tela | Rota | Descrição |
|---|---|---|
| Detalhe residência | `/(app)/residencia/[id]` | Moradores cadastrados, histórico de visitas |
| Nova residência | `/(app)/residencia/nova` | Busca CEP automática, todos os campos |
| Detalhe morador | `/(app)/morador/[id]` | Ficha completa + acesso ao prontuário |
| Novo morador | `/(app)/morador/novo` | Dados pessoais, saúde, benefícios |
| Prontuário | `/(app)/prontuario/[moradorId]` | 5 abas: Saúde Geral, Gestante, Puericultura, Mulher, Social |
| Nova visita | `/(app)/visita/nova` | PA, glicemia, peso, checklist, encaminhamentos |
| Detalhe visita | `/(app)/visita/[id]` | Registro completo da visita |

**Prontuário — 5 módulos:**

| Módulo | Campos |
|---|---|
| Saúde Geral | Hipertensão, diabetes, acamado, tuberculose, hanseníase, PA, HGT, receita, próxima consulta, queixas |
| Gestante | DUM, semanas de gestação, pré-natal em dia, vacina tétano, hepatite B, sulfato ferroso, ácido fólico |
| Puericultura | Peso, altura, cartão de vacinas, consulta de acompanhamento, creche/escola |
| Saúde da Mulher | Papanicolau, mamografia, anticoncepção, consulta ginecológica |
| Social | Vulnerabilidade, negligência parental, violência doméstica, depressão, uso de álcool/drogas, encaminhamento assistente social |

### (admin) — Área do Administrador (5 abas, tema roxo)

| Aba | Descrição |
|---|---|
| Painel | 7 cards de estatísticas globais + top 3 agentes + últimas 5 visitas |
| Agentes | Busca, stats por agente, modal com detalhes e definição de meta |
| Residências | Todas as residências + moradores + histórico de visitas |
| Visitas | Filtros por status e agente, detalhes completos |
| Sistema | Tamanho do banco, credenciais admin, audit log paginado |

---

## 8. Segurança

### Fluxo de autenticação

```
login(cpf, senha)
    │
    ├── _isLocked(cpf)?
    │       └── sim → throw 'Conta temporariamente bloqueada'
    │
    ├── SELECT * FROM agentes WHERE cpf = ? AND ativo = 1
    │
    ├── verificarSenha(senha, hash)   ← sempre executado (timing-safe)
    │       ├── hash contém '$'?
    │       │     ├── sim → [salt, hash] = stored.split('$')
    │       │     │         computed = SHA256(salt + senha)
    │       │     │         return computed === hash
    │       │     └── não → formato legado
    │       │               computed = SHA256(senha)
    │       │               return computed === hash
    │       └── (se usuário não existe: hash dummy = '0000...0$0000...0')
    │
    ├── !row || !senhaValida?
    │       └── sim → _registerFailure(cpf) → return null
    │
    ├── _clearFailures(cpf)
    │
    └── hash sem '$'? → hashSenha(senha) → UPDATE agentes SET senha_hash (migração)
```

### Hash de senha

```
Formato: "<salt_hex_32chars>$<sha256_hex_64chars>"

Geração:
  salt      = getRandomBytesAsync(16) → hex (32 chars)
  hash      = SHA256(salt + senha)    → hex (64 chars)
  armazenado= salt + "$" + hash

Verificação:
  [salt, hash] = stored.split('$')
  computed     = SHA256(salt + senha)
  válido       = computed === hash
```

### Criptografia de campos PII (SHA-256-CTR)

Campos sensíveis (CPF, cartão SUS, nome, telefone, nome do pai/mãe) são cifrados com **SHA-256 no modo CTR**:

```
Chave:    256 bits — gerada uma vez, armazenada no Keychain/Keystore
IV:       16 bytes aleatórios por cifração
Keystream: SHA256(key_hex || iv_hex || counter_hex_8) → 32 bytes por bloco
Cifração: plaintext_byte XOR keystream_byte
Formato:  "v2:" + base64(iv[16] || ciphertext[n])

Retrocompatibilidade: dados sem "v2:" são descriptografados via XOR legado
```

Por que SHA-256-CTR e não XOR simples?
- XOR com chave fixa é reversível e determinístico — mesma entrada, mesmo ciphertext
- CTR com IV aleatório gera ciphertext diferente a cada cifração (semantic security)
- Sem dependências externas além de `expo-crypto`

### Rate Limiting

```typescript
const MAX_LOGIN_ATTEMPTS  = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;  // 15 minutos

// Mapa em memória (persiste enquanto o processo vive)
Map<cpf, { count: number; lockedUntil: number }>

_isLocked(cpf):
  entry.lockedUntil === 0   → não está bloqueado (acumulando falhas)
  entry.lockedUntil > now   → bloqueado
  entry.lockedUntil <= now  → bloqueio expirou → delete entry

_registerFailure(cpf):
  count++
  if count >= 5 → lockedUntil = now + 15min

loginRateStatus(cpf):
  → { locked: boolean, remaining: number, unlocksAt?: number }
```

### Proteção contra SQL Injection

```typescript
// Sempre parameterized queries
await db.getFirstAsync(
  'SELECT * FROM agentes WHERE cpf = ? AND ativo = 1',
  [cpf]
);

// Busca com LIKE — metacaracteres escapados
function escapeForLike(query: string): string {
  return query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

await db.getAllAsync(
  `SELECT * FROM moradores WHERE nome LIKE ? ESCAPE '\\'`,
  [`%${escapeForLike(nome)}%`]
);
```

### Sessão

```
Duração:   8 horas (SESSION_TIMEOUT_MS)
Token:     UUID armazenado no expo-secure-store
Renovação: automática quando app volta do background (AppState listener)
Logout:    limpa token + chave de criptografia + cache em memória
```

### Resumo de proteções

| Vetor de ataque | Proteção implementada |
|---|---|
| SQL Injection | Parameterized queries em 100% das queries |
| SQL LIKE Injection | `escapeForLike()` escapa `%`, `_`, `\` |
| Rainbow tables | Salt aleatório de 16 bytes nas senhas |
| Timing attack (user enumeration) | `verificarSenha` sempre executada com hash dummy |
| Brute force / força bruta | Rate limiting: 5 tentativas / bloqueio 15 min |
| User enumeration na recuperação | Mensagem de erro genérica |
| Dados em repouso | SHA-256-CTR com IV aleatório + chave no Keychain/Keystore |
| Token hijacking | expo-secure-store (TEE/Secure Enclave quando disponível) |
| Sessão infinita | Timeout de 8 horas + logout automático |
| Migração de hash inseguro | Formato legado migrado automaticamente no login |
| XSS | Não aplicável — app nativo React Native |
| CSRF | Não aplicável — sem cookies |

### Atenção em produção

- **RLS no Supabase** — obrigatório (ver seção 13)
- **AES-256-GCM** — substituto recomendado ao SHA-256-CTR (cipher autenticado)
- **Certificate pinning** — fixar certificado TLS para apps de saúde
- **Root/jailbreak detection** — `expo-device` para dispositivos comprometidos
- **ProGuard/Hermes** — ofuscação do bundle no build de produção

---

## 9. LGPD

O ConectAgente foi desenvolvido com conformidade à **Lei 13.709/2018**:

| Requisito | Implementação |
|---|---|
| Finalidade (Art. 6º, I) | Dados usados exclusivamente para atenção básica à saúde pública |
| Adequação (Art. 6º, II) | Coleta limitada ao necessário para as visitas domiciliares |
| Transparência (Art. 6º, VI) | Aviso LGPD no login e cadastro |
| Segurança (Art. 46) | Criptografia local, hash com salt, SecureStore nativo |
| Prevenção (Art. 6º, VIII) | Validações impedem dados inválidos ou desnecessários |
| Exclusão (Art. 18, VI) | Soft delete + anonimização do nome (`"ANONIMIZADO"`) |
| Rastreabilidade (Art. 37) | `audit_log` com timestamp em ações sensíveis |
| Consentimento (Art. 7º, I) | Tabela `consentimentos` por morador e tipo de dado |
| Base legal (Art. 7º, II) | Execução de políticas públicas de saúde |

### Audit Log

```sql
-- Estrutura
audit_log (
  id          TEXT PRIMARY KEY,
  agente_id   TEXT,              -- quem realizou a ação
  acao        TEXT,              -- 'RESET_SENHA', 'CRIAR_AGENTE', etc.
  tabela      TEXT,              -- tabela afetada
  registro_id TEXT,              -- ID do registro afetado
  detalhes    TEXT,              -- descrição sem dados sensíveis
  created_at  TEXT               -- timestamp ISO 8601
)

-- Evento registrado automaticamente
INSERT INTO audit_log VALUES (
  uuid(), agente_id,
  'RESET_SENHA', 'agentes', agente_id,
  'Recuperação de senha via verificação CPF+email',
  datetime('now')
);
```

### Dados coletados e base legal

| Dado | Finalidade | Base Legal LGPD |
|---|---|---|
| Nome, CPF, data de nascimento | Identificação do morador | Art. 7º, II |
| Condições de saúde, medicamentos | Acompanhamento clínico | Art. 11, II, b |
| Vulnerabilidade social | Encaminhamento assistência social | Art. 7º, II |
| Dados de gestante e puericultura | Atenção pré-natal e infantil | Art. 11, II, b |
| Endereço | Planejamento de visitas domiciliares | Art. 7º, II |

---

## 10. Testes

### Executar

```bash
npm test              # todos os testes em modo watch
npm run test:ci       # com cobertura de código (CI)
```

### Resultado atual

```
Test Suites : 18 passed
Tests       : 263 passed
Coverage    : ~80% statements / ~83% lines
Threshold   : 60% mínimo em branches/functions/lines/statements
```

### Cobertura por módulo

| Arquivo de teste | O que cobre |
|---|---|
| `utils/encryption.test.ts` | hashSHA256, hashSenha com salt, verificarSenha (novo + legado), SHA-256-CTR round-trip, IV aleatório, cache de chave, retrocompatibilidade XOR |
| `utils/validators.test.ts` | CPF, cartão SUS, CEP, email (TLD, subdomínio, trim), telefone, datas BR, escapeForLike (%, _, \\, múltiplos), schemas Zod |
| `utils/formatters.test.ts` | Formatação de CPF, CEP, datas, máscaras numéricas |
| `utils/lgpd.test.ts` | Anonimização de dados, utilitários de consentimento |
| `repositories/agenteRepository.test.ts` | criar (admin/não-admin), autenticar (correto/errado/inexistente), timing-safe, migração hash legado, rate limiting (4 falhas, bloqueio após 5, status, reset após sucesso), buscarPorId, existeAgenteCadastrado, atualizar, verificarIdentidade, resetarSenha, garantirAdminPadrao |
| `repositories/moradorRepository.test.ts` | CRUD completo, busca com LIKE seguro |
| `repositories/residenciaRepository.test.ts` | CRUD, soft delete |
| `repositories/visitaRepository.test.ts` | Criar, listar, estatísticas, últimas visitas |
| `services/authService.test.ts` | Login offline, persistência de sessão, logout, renovação |
| `services/syncService.test.ts` | Processamento da fila, tratamento de erros de rede |
| `services/cepService.test.ts` | Busca de endereço, tratamento de CEP inválido |
| `services/exportService.test.ts` | Geração de CSV e Excel |
| `hooks/useVisitas.test.ts` | Estado, filtros, CRUD de visitas |
| `hooks/useResidencias.test.ts` | Estado, busca, CRUD de residências |
| `components/ui/Badge.test.tsx` | Variantes de cor e texto |
| `components/ui/Card.test.tsx` | Renderização e interação |
| `components/ui/EmptyState.test.tsx` | Estado vazio com ícone e mensagem |
| `components/button/Button.test.tsx` | Variantes, loading, disabled |

### Estratégia de mocks

```typescript
// expo-crypto — hash determinístico baseado no input
jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

// expo-secure-store — SecureStore simulado
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('0123456789abcdef'.repeat(4)),
  setItemAsync: jest.fn(),
}));

// SQLite — banco simulado
const mockDb = {
  runAsync:            jest.fn(),
  getFirstAsync:       jest.fn(),
  getAllAsync:          jest.fn(),
  withTransactionAsync:jest.fn((cb) => cb()),
};
```

### Isolamento entre testes (estado em memória)

```typescript
// agenteRepository mantém Map de rate limiting e cache de chave em memória
// Ambos devem ser resetados em beforeEach para evitar vazamento de estado

beforeEach(() => {
  jest.clearAllMocks();
  clearEncryptionKeyCache();       // reseta cache da chave de criptografia
  _resetLoginAttemptsForTesting(); // limpa o Map de tentativas de login
  mockedCrypto.digestStringAsync.mockResolvedValue('hashed-password');
});
```

---

## 11. Instalação

### Pré-requisitos

- **Node.js** 20+
- **Expo CLI**: `npm install -g expo-cli`
- **Android Studio** (emulador Android) ou **Xcode** (iOS — macOS apenas)
- Conta no **Supabase** (para sincronização — opcional no desenvolvimento local)

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/CamilaRaimundo/ConectAgente.git
cd ConectAgente/ConectAgent

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com as credenciais do Supabase

# 4. Inicie o servidor de desenvolvimento
npx expo start

# Android
npx expo start --android

# iOS (somente macOS)
npx expo start --ios
```

### Credenciais padrão do administrador

Na primeira execução, o app cria automaticamente um administrador padrão:

| Campo | Valor |
|---|---|
| CPF | `111.444.777-35` |
| Senha | `Admin@2025` |

> Troque a senha imediatamente após o primeiro login.

---

## 12. Variáveis de Ambiente

Crie `.env` baseado em `.env.example`:

```env
# Supabase (necessário para sincronização com a nuvem)
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> A `ANON_KEY` é uma chave pública do Supabase. A segurança real vem das políticas **Row-Level Security** configuradas no servidor.

---

## 13. Supabase — RLS

**Obrigatório para produção.** Sem Row-Level Security, qualquer agente autenticado consegue ver dados de outros agentes.

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE residencias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE moradores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacinas      ENABLE ROW LEVEL SECURITY;

-- Isolamento por agente: cada agente acessa apenas seus próprios dados
CREATE POLICY "isolamento_agente" ON residencias
  FOR ALL USING (agente_id = auth.uid());

CREATE POLICY "isolamento_agente" ON moradores
  FOR ALL USING (agente_id = auth.uid());

CREATE POLICY "isolamento_agente" ON visitas
  FOR ALL USING (agente_id = auth.uid());

-- Repita para: agendamentos, prontuarios, medicamentos, vacinas, metas_visitas
```

O schema completo está em `supabase/schema.sql`.

---

## 14. Painel Web — conectagente-web

**Deploy em produção:** [conectagente-web.vercel.app](https://conectagente-web.vercel.app) · **Modo demo:** [conectagente-web.vercel.app/demo](https://conectagente-web.vercel.app/demo)

O painel web é um dashboard administrativo desenvolvido em **Next.js 15** que complementa o app mobile. Ele consome o **mesmo banco Supabase** e permite que supervisores e administradores gerenciem a operação sem precisar do app mobile.

> Diretório: `conectagente-web/`

### Tecnologias do painel web

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | ^15.1.0 |
| Runtime | React | ^19.0.0 |
| Linguagem | TypeScript | ~5.8.3 |
| Estilização | Tailwind CSS | ^3.4.0 |
| Backend / Auth | Supabase (SSR + RLS) | ^2.45.4 |
| Gráficos | Recharts | ^2.15.0 |
| Validação | Zod | ^3.24.0 |
| Ícones | Lucide React | ^0.468.0 |
| Relatórios | jsPDF + xlsx | ^2.5.2 / ^0.18.5 |
| Datas | date-fns | ^4.1.0 |
| Testes | Jest + Testing Library | ^29 / ^16 |

### Funcionalidades do painel web

| Página | Rota | Descrição |
|---|---|---|
| **Dashboard** | `/` | Cards com estatísticas (visitas hoje/semana/mês, agentes ativos, famílias), gráficos de linha, barra e pizza, alertas de atraso, visitas recentes |
| **Agentes** | `/agentes` | Lista com busca, detalhe individual com desempenho, ranking por período |
| **Famílias** | `/familias` | Listagem paginada, detalhe com moradores e histórico de visitas |
| **Visitas** | `/visitas` | Filtros por status, agente e período, estatísticas gerais |
| **Moradores** | `/moradores` | Listagem com estatísticas de saúde (hipertensos, diabéticos, gestantes) |
| **Monitoramento** | `/monitoramento` | Cobertura por microárea, mapa de cobertura territorial |
| **Territorial** | `/territorial` | Visualização territorial da cobertura de saúde |
| **Relatórios** | `/relatorios` | Exportação de relatórios em PDF e Excel |
| **Admin** | `/admin` | Gestão de usuários, solicitações de registro pendentes |
| **Login** | `/login` | Autenticação via Supabase Auth |
| **Registro** | `/registro` | Cadastro com aprovação do administrador |

### Arquitetura do painel web

```
conectagente-web/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login e registro (layout público)
│   │   ├── (dashboard)/     # Todas as páginas autenticadas
│   │   ├── actions/         # Server actions (login, registro, auth)
│   │   └── api/health/      # Endpoint de health check
│   │
│   ├── components/
│   │   ├── charts/          # VisitasLineChart, StatusPieChart, AgentesBarChart,
│   │   │                    # CoberturaChart, HeatmapBairros
│   │   ├── dashboard/       # DashboardCards, AlertasAtraso, RecentVisitas
│   │   ├── layout/          # Sidebar, Header, FilterBar, LoadingBar
│   │   └── ui/              # Button, Card, Badge, Input, Table, Pagination,
│   │                        # StatCard, Skeleton, Dialog, Select, EmptyState
│   │
│   ├── hooks/               # useAuth, useFilters, usePagination, usePrefetch
│   ├── lib/                 # Supabase clients, cache, requestQueue, rateLimit,
│   │                        # validation, utils, constants
│   ├── services/            # dashboardService, visitaService, agenteService,
│   │                        # familiaService, moradorService, adminService,
│   │                        # monitoramentoService, relatorioService, auditService
│   └── types/               # Interfaces e enums TypeScript
│
├── jest.config.js
├── jest.setup.js
└── tsconfig.json
```

### Segurança do painel web

- **Rate limiting** em server actions (login, registro)
- **Error boundaries** com fallback UI
- **Fila de requisições** com retry e exponential backoff
- **Validação de entrada** com Zod em todas as bordas
- **Sanitização** de inputs contra XSS
- **Middleware** de autenticação protegendo rotas do dashboard
- **Row-Level Security** no Supabase (mesmo banco do app mobile)

### Testes do painel web

```bash
cd conectagente-web
npm test              # todos os testes
npm test -- --verbose # com detalhes
npm run test:coverage # com cobertura
```

```
Test Suites : 20 passed, 20 total
Tests       : 220 passed, 220 total
```

| Módulo | Testes |
|---|---|
| Services (7) | dashboardService, visitaService, agenteService, familiaService, moradorService, adminService, monitoramentoService |
| Hooks (1) | useAuth (login, logout, roles, sessão) |
| Components (7) | Sidebar, DashboardCards, ErrorBoundary, Button, Card, Badge, Pagination, StatCard |
| Lib (4) | utils, validation, rateLimit, requestQueue |

### Instalação do painel web

```bash
cd conectagente-web

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar .env.local com credenciais do Supabase

# Desenvolvimento
npm run dev

# Build de produção
npm run build
npm start
```

### Variáveis de ambiente do painel web

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

> A `SERVICE_ROLE_KEY` é usada apenas no servidor (server actions) para operações administrativas. Nunca expor no client-side.

---

## 15. Roadmap

### v1.0 — Concluído

- [x] App mobile offline-first (React Native + Expo)
- [x] CRUD completo: residências, moradores, visitas, prontuários
- [x] Sincronização com Supabase (fila offline-first)
- [x] Autenticação local com sessão de 8h
- [x] Criptografia SHA-256-CTR + SecureStore
- [x] Conformidade LGPD (soft delete, anonimização, audit log, consentimento)
- [x] Calendário de agendamentos
- [x] Metas mensais de visitas
- [x] Exportação CSV/Excel
- [x] Área administrativa no app mobile

### v1.1 — Concluído

- [x] Painel web administrativo (Next.js 15 + Supabase)
  - Dashboard com estatísticas por equipe e por microárea
  - Gestão de agentes, famílias, moradores e visitas
  - Mapa de cobertura territorial
  - Exportação de relatórios gerenciais
  - Rate limiting, error boundaries, validação de entrada
  - 220 testes unitários (Jest + Testing Library)
  - Sistema de registro com aprovação de admin

### v1.2 — Em desenvolvimento

- [ ] Sincronização em background (background task em build de produção)
- [ ] Assinatura digital do morador na visita (`assinatura_base64`)
- [ ] Foto do domicílio na visita

### v1.3 — Planejado

- [ ] Notificações push para agendamentos (expo-notifications)
- [ ] Integração com e-SUS/SISAB (sistema nacional do Ministério da Saúde)
- [ ] Modo supervisor — coordenador visualiza equipe completa
- [x] Deploy do painel web em produção — [conectagente-web.vercel.app](https://conectagente-web.vercel.app)

### Segurança — Backlog

- [ ] Upgrade para AES-256-GCM (cipher autenticado — substitui SHA-256-CTR)
- [ ] Certificate pinning (TLS)
- [ ] Root/jailbreak detection
- [ ] Ofuscação de código (ProGuard + Hermes)
- [ ] Política de senha configurável (complexidade mínima)
- [ ] 2FA para administradores

---

## Licença

Proprietário — ConectAgente © 2026. Todos os direitos reservados.

Desenvolvido para uso por Secretarias Municipais de Saúde e equipes de Atenção Básica credenciadas.
