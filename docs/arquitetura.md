# Arquitetura, ConectAgente

## Visão geral

Sistema offline-first para Agentes Comunitários de Saúde (ACS): um aplicativo
Android que grava primeiro no aparelho, e um painel web para a coordenação. Os
dois falam direto com o Supabase; não há servidor de aplicação no meio.

```
┌──────────────────────────────────────────────────────────────┐
│                  Agente de Saúde (campo)                      │
│              Celular Android, muitas vezes sem sinal          │
└─────────────────────────────┬────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────┐
│         ConectAgente-mobile (React Native 0.81, Expo 54)      │
│                                                              │
│  src/app/           rotas, por expo-router (só montam a tela) │
│  src/features/      regra, dados e estilo de cada tela        │
│  src/components/    componentes reutilizados                  │
│  src/database/      SQLite local, 18 tabelas, cifrado inteiro │
│                     com SQLCipher; repositórios e sync_queue  │
│  src/services/      sincronização, autenticação, exportação,  │
│                     CEP e notificação                         │
│  src/utils/         validação (Zod), LGPD, formatação         │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS, certificado fixado, só quando há rede
           ▼
┌──────────────────────────────────────────────────────────────┐
│                         Supabase                              │
│  PostgreSQL, 15 tabelas, Row Level Security em todas          │
│  Supabase Auth (sessão)  │  PostgREST (API gerada do schema)  │
│  funções auditadas: fn_ler_morador, fn_buscar_morador_...     │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTPS (PostgREST), sessão por cookie
           ▼
┌──────────────────────────────────────────────────────────────┐
│          ConectAgente-web (Next.js 15, publicado na Vercel)   │
│  indicadores, visitas, famílias, moradores, agentes,          │
│  monitoramento, território, relatórios, aprovação de cadastro │
└──────────────────────────────────────────────────────────────┘
```

## Organização do código do aplicativo

Cada pasta tem uma responsabilidade, e a dependência anda num sentido só:
tela → funcionalidade → serviço e repositório → banco.

| Pasta | O que mora ali | O que não mora |
|---|---|---|
| `src/app/` | uma rota por arquivo (expo-router); a tela só monta: chama o hook, passa os dados aos componentes e navega | regra de negócio, consulta ao banco, estilo extenso. Todo arquivo aqui vira rota, então nada que não seja tela |
| `src/features/<tela>/` | o que é de uma tela só: `regras*.ts` (funções puras, testadas sem React), `use*.ts` (carga dos dados), `estilos.ts`, `componentes.tsx` | código usado por mais de uma tela, que sobe para `components/` |
| `src/components/` | componentes reutilizados (botão, campo, cartão, cabeçalho de seção, cartão de número, atalho) | regra de negócio |
| `src/services/` | o que fala com o mundo de fora: sincronização, autenticação, exportação, CEP, notificação | interface |
| `src/database/` | esquema, migrações e um repositório por tabela; toda SQL é parametrizada | regra de tela |
| `src/utils/` | funções puras sem estado: validação (Zod), formatação, hash de senha, navegação | acesso a banco ou rede |
| `modules/` | módulo nativo local (`pbkdf2-nativo`) | — |

A tela de Início é o exemplo do padrão: a rota tem cerca de 120 linhas, e a
regra da meta, a carga dos números, a foto de perfil e os estilos estão em
`features/inicio` e `features/perfil`. As guardas de tema e espaçamento
(`src/app/__tests__`) varrem `app/`, `components/` e `features/`, e o teste de
contraste (`src/contexts/__tests__`) confere as duas paletas pelo WCAG AA.

**Cor tem nome de papel, não de cor.** `onSolid` é o texto sobre cor sólida,
`onGradient` sobre o gradiente, `surface` o fundo de cartão. A paleta antiga
tinha `white`, que no tema escuro valia o fundo escuro e apagava o texto sobre
o gradiente.

## Quem decide o acesso

O banco. Os dois clientes usam a chave pública do Supabase, que vai dentro do
pacote do aplicativo e do código do painel; regra que o cliente pudesse
contornar não seria regra. Cada tabela tem policies de RLS que decidem por
`auth.uid()`, e os guardas de tela só espelham essas policies.

| Papel | Alcance |
|---|---|
| `agente` | os próprios pacientes |
| `coordenador` | a própria unidade de saúde |
| `gerente` | tudo, mais a trilha de auditoria |
| `admin` | tudo, mais a gestão de usuários |

Quem não fez login (`anon`) não tem privilégio em nenhuma tabela nem função
auxiliar desde 09/11/2026. Documento, doença e medicação do morador só saem por
função auditada, e as colunas clínicas das fichas de prontuário não saem pela
API. Detalhes em [seguranca.md](seguranca.md).

O painel usa a chave de serviço, que ignora o RLS, apenas em Server Actions que
conferem a sessão e o papel de quem chama: o cadastro público e a aprovação de
cadastro.

## Offline-first

1. **Gravação local primeiro.** Todo registro vai para o SQLite do aparelho e
   entra na fila `sync_queue` com situação `pendente`.
2. **Sincronização quando há rede**, a cada 30 segundos com o aplicativo aberto
   e em segundo plano pelo `backgroundSync.ts`.
3. **Sessão antes de enviar.** O aplicativo autentica localmente para funcionar
   sem rede, mas o servidor só aceita gravação com sessão do Supabase Auth. Sem
   sessão, a sincronização para e avisa, em vez de gastar as tentativas da fila.
4. **Retentativa.** Cada falha soma uma tentativa; depois de cinco, o item fica
   em `erro`, visível para correção, e não é descartado.
5. **Gravação sem upsert onde o servidor fecha leitura.** Em `moradores` e nas
   fichas de prontuário o envio é `INSERT` e, se a chave já existe, `UPDATE`
   pela chave, porque o Postgres recusa upsert que atualiza coluna que o
   usuário não pode ler.
6. **Conflito:** a última escrita vence, pela data de atualização. Na prática
   cada registro tem um único autor, o agente da microárea.

## Dado em repouso e em trânsito

- **Aparelho:** banco inteiro cifrado com SQLCipher, chave de 256 bits gerada no
  primeiro uso e guardada no Keystore. Token de sessão no SecureStore.
- **Trânsito:** HTTPS, com o certificado do Supabase fixado na intermediária e
  na raiz da cadeia (`plugins/fixar-certificado.js`).
- **Servidor:** exclusão lógica (`deleted_at`) e trilha `audit_log` somente de
  inclusão.

## Verificação

A cada pull request, no GitHub Actions: tipos e testes Jest do aplicativo e do
painel, suítes em PostgreSQL descartável (permissão, sincronização, cadastro,
leitura auditada, colunas sensíveis, acesso anônimo e fichas fechadas),
Semgrep, OSV-Scanner e gitleaks. O MobSF analisa o APK de cada versão
publicada. Como rodar tudo localmente está no [README](../README.md).
