# ConectAgente

Sistema de apoio ao trabalho do Agente Comunitário de Saúde: um aplicativo que
funciona sem internet para o registro em campo, e um painel web para a
coordenação acompanhar.

O agente cadastra residências e moradores, registra a visita domiciliar com o
que aferiu (pressão, glicemia, peso, medicação em dia, cartão de vacina) e
mantém o prontuário das cinco fichas de acompanhamento: saúde geral, gestante,
puericultura, saúde da mulher e situação social. Tudo isso grava no aparelho e
sobe para o servidor quando há rede.

Projeto de iniciação científica, pensado para uso por secretaria municipal de
saúde. O dado que ele guarda é **dado pessoal sensível** na definição do
art. 5º, II da LGPD, e isso orienta as decisões de segurança do projeto.

---

## Como rodar

Precisa de Node 20 ou mais novo. Para as suítes de banco, também do PostgreSQL
instalado (servidor, não só o cliente).

```bash
# Aplicativo de campo
cd ConectAgente-mobile
npm ci
cp .env.example .env     # preencha a URL e a chave anon do Supabase
npx expo start

# Painel web
cd ConectAgente-web
npm ci
cp .env.example .env     # preencha as três variáveis
npm run dev
```

O aplicativo abre e funciona mesmo sem o `.env` preenchido: o banco local é
independente do servidor. O que não funciona sem ele é a sincronização, e o
aplicativo avisa em vez de falhar calado.

Na primeira execução o aplicativo cria um administrador com senha **sorteada**,
mostrada uma única vez em Sistema → Credenciais de acesso. Anote e troque.

---

## Como validar

```bash
# Aplicativo: tipos, testes e empacotamento real com o Metro
cd ConectAgente-mobile && npx tsc --noEmit && npm run test:ci
npx expo export --platform android --output-dir /tmp/saida

# Painel: tipos, lint, testes e build
cd ConectAgente-web && npx tsc --noEmit && npm run lint && npm test -- --ci
npm run build

# Banco de verdade: permissão, sincronização e cadastro
bash ConectAgente-web/supabase/testes/rodar-todos.sh
```

Estado medido na última validação completa:

| O que | Resultado |
|---|---|
| Testes do aplicativo | 331 em 23 suítes |
| Testes do painel | 256 em 24 suítes |
| Verificações em banco de verdade | 61 em 3 suítes |
| Erros de tipo | 0 nos dois projetos |
| Avisos de ESLint | 0 |
| Vulnerabilidade em produção | 0 no painel, 0 crítica no aplicativo |

As três suítes de banco sobem um PostgreSQL descartável numa porta própria,
aplicam o schema e as migrações, exercitam um caminho real e se autodestroem.
Nada toca banco existente.

Elas existem porque os defeitos mais graves do projeto **não apareciam em teste
de unidade**: cada lado estava coerente consigo mesmo e o erro morava na junta.
Sete tabelas sem Row Level Security, 61 colunas que o aplicativo gravava e o
servidor não tinha, e cinco vocabulários diferentes para o campo de papel do
usuário. Só o banco reclama disso.

---

## Branches

| Branch | Para que serve |
|---|---|
| `produção` | o que está validado e pronto para uso. É a branch padrão |
| `homologação` | onde a mudança é conferida antes de subir para produção |

As duas estão sempre no mesmo commit quando não há nada em andamento. O CI
roda em qualquer branch, e não só nessas duas, porque descobrir problema no
pull request é o momento mais caro.

---

## Como o repositório está organizado

```
ConectAgente-mobile/        aplicativo Expo + React Native (28 telas)
  src/app/                  rotas, por expo-router
  src/database/             SQLite local, 18 tabelas, e os repositórios
  src/services/             autenticação, sincronização, exportação, CEP
  src/utils/                validação, criptografia, LGPD, formatação
  supabase/schema.sql        schema do servidor (13 tabelas)

ConectAgente-web/           painel Next.js 15 (16 rotas)
  src/app/                  rotas e Server Actions
  src/services/             consultas ao Supabase, por domínio
  src/lib/                  cache, fila de requisição, limite de taxa
  supabase/                  5 migrações e as suítes de banco
  supabase/testes/           rodar-todos.sh e os três cenários

docs/
  manual-tecnico.md         o detalhamento: arquitetura, telas, tipos, banco
  arquitetura.md            visão geral de componentes
  seguranca.md              modelo de segurança e o que foi corrigido
  lgpd.md                   o que está implementado e o que não está
```

---

## Decisões que valem saber antes de mexer

**O aplicativo precisa de sessão no Supabase para sincronizar.** Ele autentica
localmente, no SQLite, para funcionar sem rede. Mas o servidor decide o que
cada um pode gravar por `auth.uid()`, e sem sessão toda policy nega. Por isso o
login abre sessão no Supabase quando há rede, sem bloquear a entrada quando não
há. Não dá para resolver afrouxando a policy: quem usa a chave `anon` não tem
identidade verificável, e qualquer regra que aceitasse a gravação aceitaria de
qualquer pessoa com a chave, que é pública por desenho.

**O agente precisa existir no Supabase Auth.** Quem cria esse usuário é a
aprovação do cadastro no painel, feita por um gerente ou admin. Agente criado
só pelo primeiro acesso do aplicativo não tem usuário no servidor e não
sincroniza.

**Os papéis são quatro, e os mesmos em todo lugar:** `agente`, `coordenador`,
`gerente`, `admin`. O alcance de cada um é decidido pelas policies do banco, e
os guardas de tela espelham as policies de propósito. Guarda que não casa com a
policy produz o pior tipo de erro, que é a página abrir vazia e quem usa
concluir que não há dado em vez de que não tem permissão.

**O campo de controle de sincronização não sobe.** No aparelho ele se chama
`status_sync` e responde "esta linha já subiu?", pergunta que só faz sentido
localmente. A tradução e a remoção dos campos locais ficam num lugar só, em
`syncQueueRepository.prepararPayloadParaServidor`, e o teste
`contratoSync.test.ts` compara os dois schemas para a divergência não voltar.

---

## O que ainda falta

Honestidade sobre o estado, que vale mais que uma lista de recursos:

- **A trilha de auditoria é quase inexistente na prática.** O módulo
  `utils/lgpd.ts` tem as funções, mas quase nenhuma é chamada: só a troca de
  senha registra evento. Acesso e alteração de prontuário não deixam rastro.
  Para órgão público isso precisa ser resolvido, e o art. 37 da LGPD é o
  motivo. Detalhes em [docs/lgpd.md](docs/lgpd.md).
- **Consentimento não é coletado.** A tabela existe no banco local e nada
  escreve nela.
- **Anonimização não está ligada a nenhuma tela**, então o direito de
  eliminação do art. 18 não é exercível pelo sistema hoje.
- **Notificação e sincronização em segundo plano foram removidas.** O código
  existia e era coerente, mas dependia de quatro pacotes nativos não
  instalados, e ligá-los exige build de desenvolvimento. As versões para o SDK
  54 estão anotadas no histórico do Git.
- **A classificação de risco do time já está aqui**, portada do commit do Luan
  em vez de fundida, porque a linha deles carrega junto 97 arquivos de
  relatório de cobertura, logs de erro e telas substituídas. O que continua
  fora é a pasta `backend/`, um servidor Express com Prisma que o aplicativo
  não referencia em lugar nenhum e que ficou para trás quando o projeto passou
  a usar o Supabase direto. Ela segue no repositório do time, se fizer falta.
- **O histórico deste repositório não tem ancestral comum com o do time.**
  Enquanto isso não for resolvido, melhoria daqui não chega lá por um
  `git merge` normal: vai ter que ser por porte, como foi feito com a
  classificação de risco, ou por uma decisão conjunta de refazer a base.

---

## Licença e uso

Projeto acadêmico de iniciação científica. O uso com dado real de munícipe
depende de autorização da secretaria de saúde responsável e do cumprimento das
pendências de LGPD listadas acima.
