# Política de Segurança

## Versões suportadas

| Versão | Suporte |
|--------|---------|
| 1.x    | ativo   |

## Reportando uma falha

Envie um e-mail para **junioad555@gmail.com** com o assunto
**[SECURITY] ConectAgente**. Resposta em até **72 horas**.

Não abra issue pública para falha que exponha dado de munícipe.

---

## Sobre o dado que este sistema guarda

Nome, CPF, cartão do SUS, endereço, condição de saúde, medicação, dado de
gestante e de criança, e relato de violência doméstica e de negligência. É
**dado pessoal sensível** na definição do art. 5º, II da Lei 13.709/2018.

O destino é uso por secretaria municipal de saúde.

---

## Medidas em vigor

- **Row Level Security em todas as tabelas do servidor.** É a única proteção
  real do dado: a chave `anon` do Supabase é pública por desenho e vai dentro
  do pacote publicado. Qualquer regra que só exista no cliente não é regra.
- **Controle de acesso por papel**, em quatro níveis (`agente`,
  `coordenador`, `gerente`, `admin`), decidido pelas policies do banco. Os
  guardas de tela espelham as policies, e há teste de contrato conferindo.
- **Senha com hash e sal**, comparação em tempo constante, e `senha_hash`
  ilegível pelo cliente por `GRANT` coluna a coluna.
- **Limite de tentativa de login**: cinco falhas bloqueiam o CPF por 15
  minutos.
- **Documento, contato, doença e medicação do morador só saem pela leitura
  auditada.** Desde 28/10/2026 a tabela `moradores` concede leitura coluna a
  coluna: as listas do painel veem nome, idade e os marcadores de
  acompanhamento; CPF, cartão do SUS, telefone, filiação, doença, medicação,
  convênio, benefício e escolaridade só saem por `fn_ler_morador`, que grava
  quem leu na mesma transação. A busca por documento é `fn_buscar_morador_por_documento`:
  comparação exata, registrada na trilha sem guardar o documento procurado.
  Provado por `rodar-testes-colunas.sh`, inclusive que o aplicativo continua
  gravando.
- **Conta desativada perde o acesso na hora.** Desde 28/10/2026 cada tabela
  de dado tem uma policy restritiva `conta_ativa`, somada com E às demais:
  com `agentes.ativo = false`, a sessão que ainda estiver aberta não lê nem
  grava mais nada, e as funções auditadas recusam. Antes, desativar só tirava
  a pessoa das listas.
- **Funções de painel falham fechadas.** As seis funções de indicadores são
  `SECURITY DEFINER` e decidiam o alcance pelo papel; papel nulo caía no ramo
  de gerente e via a cidade inteira. Agora recusam sem cadastro ativo, têm
  `search_path` travado e não são executáveis pela chave anônima. Provado em
  `07-conta-ativa.sql`.
- **Token de sessão e chave local no SecureStore** (Keychain no iOS, Keystore
  no Android). Os campos do banco local do aparelho **não** são cifrados pelo
  aplicativo: quem protege o arquivo é a cifra de disco do Android, ligada
  desde o Android 10. Ver limitações abaixo.
- **Trilha de auditoria imutável**: `audit_log` aceita inserção e leitura,
  `UPDATE` e `DELETE` são revogados, e a leitura é restrita a gerente e admin.
- **Exclusão lógica** (`deleted_at`), não física.
- **Autorização verificada no servidor** nas Server Actions administrativas,
  com a identidade vindo do cookie de sessão e nunca de parâmetro.
- **Portão de vulnerabilidade no CI**: `npm audit` sem dependência de
  desenvolvimento tem que ficar em zero no painel, e nenhuma crítica no
  aplicativo. Desde 28/10/2026 também OSV-Scanner nos dois lockfiles, Semgrep
  (análise estática) e gitleaks (segredo no histórico) a cada push, tudo
  gratuito; aceites de risco com prazo em `osv-scanner.toml`. Actions fixadas
  por SHA e Dependabot com espera de sete dias.

Detalhamento, incluindo os defeitos encontrados e corrigidos com a mensagem que
o banco devolveu em cada caso, em [docs/seguranca.md](docs/seguranca.md).

---

## Limitações conhecidas

Registradas porque omitir limitação em sistema de órgão público é pior que
tê-la.

- **O banco local do aparelho não é cifrado pelo aplicativo.** Existe em
  `utils/encryption.ts` uma cifra de campo, mas nenhuma tela a chama, e ela é
  SHA-256 em modo contador, construída à mão, e **não** AES-256. O `expo-crypto` não expõe AES, o que explica a
  escolha. A construção é razoável para confidencialidade, mas **não oferece
  autenticidade**: cifra de fluxo sem MAC é maleável, e inverter um bit do
  texto cifrado inverte o bit correspondente do texto claro. O comentário no
  código dizia que a posse da chave garantiria autenticidade, o que é
  equívoco: a posse da chave garante confidencialidade. Ligá-la também
  quebraria a busca por nome em campo. A saída certa é SQLCipher, cifrando o
  banco inteiro com AEAD de verdade (detalhe em
  [docs/seguranca.md](docs/seguranca.md)).
- **A leitura das tabelas de prontuário ainda não passa por função
  auditada no servidor.** No aplicativo a abertura do prontuário grava
  `LEITURA` na trilha local, e no painel a ficha do morador passa por
  `fn_ler_morador`. Mas um usuário logado consegue ler `prontuario_saude` e as
  outras fichas direto pela API, dentro do que o RLS permite, sem registro. A
  saída é a mesma aplicada a `moradores` em 28/10/2026: leitura coluna a
  coluna e função auditada. Ela exige trocar o upsert do aplicativo nessas
  tabelas, porque o Postgres recusa upsert que atualiza coluna que o usuário
  não pode ler.
- **Não há segundo fator** para o painel web, que é onde se lê o prontuário de
  todos os pacientes.
- **O limite de taxa é em memória do processo.** Com mais de uma instância do
  painel, cada uma conta separado.
- **Dependências de build com falha conhecida** (`node-forge`, `uuid` 7,
  `image-size` 1 e `deepmerge`) vêm da CLI do Expo, do Metro e do Jest. Ou
  não têm versão corrigida, ou a corrigida quebra o empacotamento (medido).
  Rodam na máquina de quem empacota, não no aparelho. Cada uma está aceita com
  motivo e prazo em [`osv-scanner.toml`](osv-scanner.toml).

---

## Antes de implantar com dado real

1. Definir o encarregado pelo tratamento e o canal de atendimento ao titular.
2. Resolver a trilha de auditoria de acesso a prontuário.
3. Preencher os nomes e contatos do [procedimento de incidente](docs/incidente.md).
4. Rotacionar qualquer chave que tenha circulado em ambiente de teste.
