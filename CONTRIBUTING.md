# Guia de Contribuição — ConectAgente

## Pré-requisitos

- Node.js >= 20
- Expo CLI: `npm install -g @expo/cli`
- Expo Go no celular (para testes físicos)
- Conta Supabase (free tier suficiente)

## Setup do Ambiente

```bash
# Clonar repositório
git clone https://github.com/fabriciojunio/ConectAgente.git
cd ConectAgente

# App Mobile
cd ConectAgente-mobile
cp .env.example .env
# Preencha as variáveis Supabase no .env
npm ci
npx expo start

# Portal Web
cd ../ConectAgente-web
cp .env.example .env
npm ci
npm run dev
```

## Estrutura do Projeto

```
ConectAgente-mobile/   — App React Native (Expo)
  src/
    app/               — Telas (Expo Router)
    components/        — Componentes reutilizáveis
    contexts/          — Contextos React (Auth, Network, Sync)
    database/          — SQLite + repositórios offline
    hooks/             — Custom hooks
    services/          — Integração Supabase e APIs externas
    utils/             — Utilitários (LGPD, formatadores)

ConectAgente-web/      — Portal administrativo Next.js
```

## Padrão de Commits

```
feat(mobile): adicionar tela de calendario de visitas
fix(sync): corrigir retry de sincronizacao em modo aviao
docs: atualizar instrucoes de configuracao do Supabase
test(mobile): adicionar testes para syncService
```

## Antes de abrir o pull request

O CI roda tudo isto. Rodar antes economiza uma ida e volta.

```bash
# Aplicativo
cd ConectAgente-mobile
npx tsc --noEmit
npm run test:ci
npx expo export --platform android --output-dir /tmp/saida

# Painel
cd ../ConectAgente-web
npx tsc --noEmit
npm run lint
npm test -- --ci
npm run build

# Banco de verdade (precisa do PostgreSQL servidor instalado)
bash supabase/testes/rodar-todos.sh
```

O empacotamento do aplicativo e as suítes de banco não são formalidade. Elas
pegam o que teste de unidade não pega: override de dependência que quebra o
Metro, e divergência entre o schema do aparelho e o do servidor. Foi assim que
se descobriu que 61 colunas de dado clínico não tinham destino no servidor.

### Se você mexeu no schema

Mexer em `ConectAgente-mobile/src/database/schema.ts` ou em qualquer migração
em `ConectAgente-web/supabase/` exige rodar as suítes de banco. Três testes de
contrato comparam os dois lados e vão apontar divergência:

| Teste | Compara |
|---|---|
| `contratoSync.test.ts` | schema do aparelho contra o do servidor, nas 11 tabelas sincronizadas |
| `sqlDosRepositorios.test.ts` | todo INSERT e UPDATE dos repositórios contra o schema local |
| `contratoPapeis.test.ts` | os papéis do código contra os CHECK do banco |

## LGPD

O sistema trata dado pessoal sensível na definição do art. 5º, II da LGPD.

Antes de afirmar conformidade em qualquer lugar, leia
[docs/lgpd.md](docs/lgpd.md): ele separa o que o código faz do que apenas está
escrito, e há lacunas relevantes em aberto, principalmente na trilha de
auditoria.

O código está em `src/utils/lgpd.ts` e `src/utils/encryption.ts`. A cifra dos
campos de identificação é SHA-256 em modo contador, não AES, e não oferece
autenticidade: a limitação está registrada em
[SECURITY.md](SECURITY.md).
