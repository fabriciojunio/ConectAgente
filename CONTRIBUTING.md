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
npm install
npx expo start

# Portal Web
cd ../ConectAgente-web
cp .env.example .env
npm install
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

## Testes

```bash
# Mobile
cd ConectAgente-mobile
npm test
npm run test:coverage
```

## LGPD

Dados sensíveis de saúde são criptografados localmente antes de qualquer sincronização.
Consulte `src/utils/lgpd.ts` e `src/utils/encryption.ts`.
