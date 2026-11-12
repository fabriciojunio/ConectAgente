# Política de Segurança

*English: email **junioad555@gmail.com** with the subject **[SECURITY] ConectAgente**; reply
within 72 hours. Do not open a public issue for flaws that expose citizens' data. Full policy in
[docs/en/security-policy.md](docs/en/security-policy.md).*

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
- **Quem não fez login não toca no banco.** Desde 09/11/2026 o papel `anon`
  não tem privilégio em nenhuma tabela, sequência ou função auxiliar das
  policies, nem nas que forem criadas depois, e `authenticated` não tem
  `TRUNCATE`, que passaria por cima do RLS. Saiu a policy que aceitava pedido
  de cadastro direto pela API: o pedido entra pelo servidor, que valida e
  limita tentativas. Provado em `08-sem-anonimo.sql` e aplicado em produção.
- **Nenhuma coluna clínica das fichas de prontuário sai pela API.** A partir da
  1.2.2 o aplicativo grava as fichas sem upsert, e
  `migration_prontuario_fechado.sql` deixa o usuário logado ler só as chaves.
  Provado em `09-prontuario-fechado.sql`, inclusive que o upsert antigo é
  recusado e que a gravação do aplicativo continua funcionando.
- **Token de sessão e chave local no SecureStore** (Keychain no iOS, Keystore
  no Android).
- **Banco local do aparelho cifrado inteiro com SQLCipher** desde a 1.2.0
  (02/11/2026). A chave de 256 bits é sorteada no primeiro uso, fica no
  Keystore e é aplicada com `PRAGMA key` antes de qualquer leitura.
- **Certificado do Supabase fixado** no aplicativo pela configuração de
  segurança de rede do Android: duas chaves públicas da cadeia, com data de
  expiração para não travar o agente se o Google trocar a cadeia.
- **Trilha de auditoria imutável**: `audit_log` aceita inserção e leitura,
  `UPDATE` e `DELETE` são revogados, e a leitura é restrita a gerente e admin.
- **Exclusão lógica** (`deleted_at`), não física.
- **Política de conteúdo do painel com nonce** em script e em elemento de
  estilo; só atributo `style=""` segue liberado, em `style-src-attr`. A fonte
  é servida pelo próprio site e a página fica isolada de outras origens
  (`Cross-Origin-Embedder-Policy`, `-Opener-Policy` e `-Resource-Policy`).
  Conferida no Chromium, sem violação nas telas de entrada e de demonstração,
  e pelo OWASP ZAP contra o site publicado em 29/10/2026: 64 regras, nenhum
  aviso.
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

- **Atualizar de uma versão sem cifra para a 1.2.0 pede reinstalação.** O
  formato do arquivo muda e o banco antigo não abre com chave. Num sistema
  offline-first o dado volta do servidor na sincronização, mas o que estiver
  na fila sem sincronizar se perde: sincronizar antes de atualizar.
- **O fechamento das fichas depende da 1.2.2 instalada.** As versões
  anteriores gravam as fichas com upsert, que `migration_prontuario_fechado.sql`
  recusa. A migração entra no banco junto com a distribuição da 1.2.2, e um
  aparelho com versão antiga deixa de sincronizar fichas até ser atualizado.
- **O segundo fator vale para o painel, não para a API.** Desde a 1.2.5 toda
  conta do painel confirma o código de um app autenticador, e as ações com a
  chave de serviço conferem o nível da sessão de novo. Quem tiver só a senha
  ainda consegue falar direto com a API do banco, dentro do RLS do próprio
  papel, porque o aplicativo usa a mesma conta e não pede segundo fator.
  Exigir `aal2` no banco depende do segundo fator no aplicativo.
- **O limite de tentativas e os medicamentos dependem de migração.** Sem
  `migration_limite_de_tentativas.sql` aplicada, o painel volta a contar em
  memória por instância (continua limitando, mas cada instância conta
  separado). Sem `migration_medicamentos.sql`, os medicamentos ficam no
  aparelho e a sincronização deles fica pendente até a migração entrar.
- **Dependências de build com falha conhecida** (`uuid` 7, `image-size` 1,
  `deepmerge`, `glob` e `minimatch`) vêm da CLI do Expo, do Metro, do
  config-plugins e do Jest. Ou
  não têm versão corrigida, ou a corrigida quebra o empacotamento (medido).
  Rodam na máquina de quem empacota, não no aparelho. Cada uma está aceita com
  motivo e prazo em [`osv-scanner.toml`](osv-scanner.toml).

---

## Antes de implantar com dado real

1. Definir o encarregado pelo tratamento e o canal de atendimento ao titular.
2. Resolver a trilha de auditoria de acesso a prontuário.
3. Preencher os nomes e contatos do [procedimento de incidente](docs/incidente.md).
4. Rotacionar qualquer chave que tenha circulado em ambiente de teste.
