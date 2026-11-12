# ConectAgente

*[Read this in English](README.en.md)*

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
cp .env.example .env     # ou use scripts/configurar-supabase.sh, abaixo
npx expo run:android     # compila e instala no aparelho ou emulador

# Painel web
cd ConectAgente-web
npm ci
cp .env.example .env     # preencha as três variáveis
npm run dev
```

### Ligar ao Supabase

Em vez de editar os dois `.env` na mão:

```bash
bash scripts/configurar-supabase.sh \
  --url https://xxxxxxxxxxxx.supabase.co \
  --anon eyJhbGciOi...
```

O script confere a credencial contra o servidor antes de escrever qualquer
arquivo: se o endereço não responde, se a chave é recusada, ou se o schema
ainda não foi aplicado, ele para e não escreve nada. `.env` meio preenchido
não quebra o aplicativo, ele sobe e a sincronização falha em silêncio, e isso
é pior que não configurar.

Os valores estão em supabase.com, no projeto, em Settings → API: "Project URL"
e "anon public". Rode antes o `ConectAgente-web/supabase/setup-completo.sql`
no editor SQL do Supabase.

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

# Banco de verdade: permissão, sincronização, cadastro, leitura auditada,
# colunas sensíveis e conta desativada
bash ConectAgente-web/supabase/testes/rodar-todos.sh
```

Estado medido em 12/11/2026, versão 1.3.0:

| O que | Resultado |
|---|---|
| Testes do aplicativo | 989 em 61 suítes, incluindo contraste do tema, navegação, guardas de layout e contrato de sincronização; cobertura de 86,3% das instruções |
| Testes do painel | 519 em 43 suítes, incluindo segundo fator, política de sessão, cache apagado no sair e portão de rotas por papel |
| Verificações em banco de verdade | 181 em 6 suítes, todas aprovadas, incluindo escalada de papel, família de outro agente e instalação repetida |
| Pentest gray box | 11 achados, todos corrigidos e retestados em produção ([relatório](docs/pentest-2026-11.md)) |
| Uso real em produção | 12 páginas do painel no tema claro e no escuro sem erro, 15 relatórios gerados e auditados, designação de unidade de ida e volta |
| Erros de tipo | 0 nos dois projetos |
| Avisos de ESLint | 0 |
| Vulnerabilidade (OSV-Scanner) | 0 sem aceite; as de ferramenta de build têm motivo e prazo em `osv-scanner.toml` |
| Análise estática (Semgrep) | 0 achados |
| `as any` no aplicativo | 0 |

As suítes de banco sobem um PostgreSQL descartável numa porta própria,
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
  src/app/                  rotas, por expo-router; a tela só monta
  src/features/             regra, dados e estilo de cada tela
  src/components/           componentes reutilizados
  src/database/             SQLite local, 18 tabelas, e os repositórios
  src/services/             autenticação, sincronização, exportação, CEP
  src/utils/                validação, criptografia, LGPD, formatação, navegação
  modules/pbkdf2-nativo/    hash de senha em código nativo do Android
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
  mobsf.md                  análise do APK com MobSF: o que foi corrigido e o que fica aceito
  modelo-de-ameacas.md      STRIDE e LINDDUN, cada ameaça com o controle e a prova
  masvs.md                  OWASP MASVS item por item
  auditoria-lgpd.md         auditoria LGPD em oito grupos e relatório de impacto
```

---

## Decisões que valem saber antes de mexer

As decisões de arquitetura têm registro próprio em [docs/adr](docs/adr):
monólito com o banco como fronteira (e por que não microsserviços), offline
primeiro, segundo fator e sessão curta, unidade como escopo da coordenação,
regra de quem grava em gatilho e identidade visual por tokens.

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

**Três decisões de 13/10/2026, para não serem rediscutidas sem motivo.**

- **O aplicativo não roda mais no Expo Go** (13/10/2026). A notificação de
  lembrete e a sincronização em segundo plano dependem de módulo nativo. A
  escolha foi entre manter o Expo Go e ter o aplicativo que o agente precisa:
  ele anda a microárea sem sinal e volta para a unidade, e sem sincronização em
  segundo plano o dado fica no celular até alguém lembrar de abrir o
  aplicativo. Para desenvolver, `npx expo run:android`.
- **Não existe servidor próprio, e não vai existir.** O aplicativo e o painel
  falam direto com o PostgREST do Supabase, e quem decide quem lê o quê é o
  RLS, dentro do banco. O repositório do time tem uma pasta
  `ConectAgente-mobile/backend/` com um Express e Prisma que ficou para trás
  nessa mudança; ela nunca esteve aqui e
  nada a referencia. Trazê-la de volta significaria manter a regra de
  autorização em dois lugares, e regra de autorização duplicada é a que fica
  desatualizada no lugar menos visível. Se um dia for preciso um servidor, ele
  entra para o que o RLS não resolve, não para repetir o que ele já faz.
- **O banco continua no Supabase** (13/10/2026). O plano grátis suspende depois
  de sete dias sem uso, e trocar para outro provedor custaria reescrever as 70
  referências a `auth.uid()` nas policies, a autenticação dos dois aplicativos
  e o substituto que as suítes de banco usam. O risco mora no RLS, que é o que
  separa o prontuário de um agente do de outro. A suspensão é resolvida com um
  ping semanal, que está em `.github/workflows/keep-alive.yml`, com os segredos
  `SUPABASE_URL` e `SUPABASE_ANON_KEY` já configurados no repositório. A
  primeira execução respondeu HTTP 200 em 13/10/2026. O workflow também roda
  quando o próprio arquivo muda, para um erro de digitação em nome de segredo
  aparecer na hora e não na segunda-feira seguinte.

**Duas decisões de 02/11/2026, na versão 1.2.0.**

- **O banco do aparelho é cifrado inteiro, com SQLCipher, e não campo a
  campo.** A chave tem 256 bits, nasce na primeira execução e fica no Keystore,
  presa ao aparelho. Cifrar campo a campo quebraria a busca local que o agente
  usa em campo para achar o paciente; cifrar o arquivo todo preserva a busca e é
  AEAD de verdade. O preço é que quem vem de uma versão sem cifra precisa
  reinstalar, e no offline-first o dado volta do servidor na sincronização.
- **O certificado do Supabase é fixado nas âncoras, não na folha.** O app só
  aceita a cadeia que passa pela intermediária WE1 ou pela raiz GTS Root R4 do
  Google Trust Services. A folha do Supabase rotaciona sozinha; as âncoras não.
  O pin-set tem data de validade para não travar a sincronização em campo se o
  Google trocar a própria cadeia; renovar antes da data está no cabeçalho de
  `plugins/fixar-certificado.js`.

**Três decisões de 09/11/2026, na versão 1.2.2.**

- **Quem não fez login não toca no banco.** O papel `anon` perdeu todo
  privilégio de tabela, sequência e função auxiliar, e o pedido de cadastro só
  entra pelo servidor. O health check do painel trata a recusa `42501` como
  prova de que o banco respondeu; dar permissão ao visitante só para o health
  abriria o que foi fechado.
- **Data sem hora nunca passa por `new Date`.** `data_visita`,
  `data_agendada` e `data_nascimento` são gravadas como `2026-10-13`, e
  `new Date` lê isso como meia-noite UTC, que no Brasil ainda é o dia 12. Toda
  visita aparecia um dia antes. A suíte do aplicativo roda no fuso de São
  Paulo (`jest.fuso.js`) para o defeito não voltar despercebido.
- **Cartão SUS com dígito verificador no cadastro, só tamanho na busca.** O
  cadastro confere o algoritmo do Cartão Nacional de Saúde; a busca continua
  achando cartão gravado antes da conferência.

---

## O que ainda falta

Honestidade sobre o estado, que vale mais que uma lista de recursos:

- **As fichas de prontuário só fecham com a 1.2.2 instalada.** A partir dela
  nenhuma coluna clínica sai pela API (`migration_prontuario_fechado.sql`),
  mas a migração recusa o upsert das versões anteriores e por isso entra no
  banco junto com a distribuição da 1.2.2.
- **O segundo fator protege o painel, não a API do banco.** O aplicativo usa a
  mesma conta sem segundo fator, então o banco ainda aceita sessão só com
  senha, dentro do RLS de cada papel. Exigir `aal2` no banco depende de levar
  o segundo fator para o aplicativo.
- **A classificação de risco do time já está aqui**, portada do commit do Luan
  em vez de fundida, porque a linha deles carrega junto 97 arquivos de
  relatório de cobertura, logs de erro e telas substituídas.
- **O histórico deste repositório não tem ancestral comum com o do time.**
  Enquanto isso não for resolvido, melhoria daqui não chega lá por um
  `git merge` normal: vai ter que ser por porte, como foi feito com a
  classificação de risco, ou por uma decisão conjunta de refazer a base.

---

## Quem fez

O ConectAgente é um projeto de iniciação científica, feito em equipe. Grande
parte do que está neste repositório veio da reescrita de outubro de 2026, que é
trabalho meu, Fabrício Júnio Almeida Dias
([@fabriciojunio](https://github.com/fabriciojunio)): o aplicativo de campo, o
painel web, o banco com as policies de RLS, as suítes de teste, a documentação
e o empacotamento do APK.

Antes dela, contribuíram:

- **Camila Pereira Raimundo** ([@CamilaRaimundo](https://github.com/CamilaRaimundo))
  criou o repositório em 23/08/2025, com a tela de login e o módulo admin.
- **Luan** ([@LuanPaD](https://github.com/LuanPaD)) fez a classificação de risco
  das residências, em 18/06/2026.
- **Kauã Limão Nunes** ([@Lim4o](https://github.com/Lim4o)) revisou e integrou
  essa classificação de risco.

O histórico original continua em
[CamilaRaimundo/ConectAgente](https://github.com/CamilaRaimundo/ConectAgente).
Os 20 commits de lá entraram aqui em 13/10/2026 como ancestrais, por um merge
com estratégia `ours`: a autoria e as datas são de quem os fez, e nenhum
arquivo deste código mudou com isso. O crédito também fica por escrito aqui e
no `CITATION.cff`.

---

## Uso de IA

Este projeto foi estruturado com apoio de ferramentas de IA generativa. Modelagem, regras de
negócio, revisão do código e conclusões foram revisadas e validadas por Fabrício Júnio.

---

## Licença e uso

Projeto acadêmico de iniciação científica. O uso com dado real de munícipe
depende de autorização da secretaria de saúde responsável e do cumprimento das
pendências de LGPD listadas acima.
