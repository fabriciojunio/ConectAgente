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
- **Campos de identificação cifrados no aparelho**, chave no SecureStore
  (Keychain no iOS, Keystore no Android).
- **Trilha de auditoria imutável**: `audit_log` aceita inserção e leitura,
  `UPDATE` e `DELETE` são revogados, e a leitura é restrita a gerente e admin.
- **Exclusão lógica** (`deleted_at`), não física.
- **Autorização verificada no servidor** nas Server Actions administrativas,
  com a identidade vindo do cookie de sessão e nunca de parâmetro.
- **Portão de vulnerabilidade no CI**: `npm audit` sem dependência de
  desenvolvimento tem que ficar em zero no painel, e nenhuma crítica no
  aplicativo.

Detalhamento, incluindo os defeitos encontrados e corrigidos com a mensagem que
o banco devolveu em cada caso, em [docs/seguranca.md](docs/seguranca.md).

---

## Limitações conhecidas

Registradas porque omitir limitação em sistema de órgão público é pior que
tê-la.

- **A cifra dos campos no aparelho é SHA-256 em modo contador**, construída à
  mão, e **não** AES-256. O `expo-crypto` não expõe AES, o que explica a
  escolha. A construção é razoável para confidencialidade, mas **não oferece
  autenticidade**: cifra de fluxo sem MAC é maleável, e inverter um bit do
  texto cifrado inverte o bit correspondente do texto claro. O comentário no
  código dizia que a posse da chave garantiria autenticidade, o que é
  equívoco: a posse da chave garante confidencialidade. Acrescentar HMAC
  resolveria, ao custo de uma migração do formato armazenado.
- **A trilha de auditoria quase não registra nada.** Só a troca de senha grava
  evento. Abrir o prontuário de um morador não deixa rastro, o que contraria o
  art. 37 da LGPD e inviabiliza a investigação de incidente. É a lacuna de
  maior impacto. Ver [docs/lgpd.md](docs/lgpd.md).
- **O direito de eliminação do art. 18, VI não é exercível pelo sistema.** A
  função de anonimização existe e nenhuma tela a chama.
- **Consentimento não é registrado.** A tabela existe no banco local e nada
  escreve nela.
- **Não há segundo fator** para o painel web, que é onde se lê o prontuário de
  todos os pacientes.
- **O limite de taxa é em memória do processo.** Com mais de uma instância do
  painel, cada uma conta separado.
- **Três dependências de build seguem vulneráveis** (`braces`, `sprintf-js`,
  `node-forge`) e não têm versão corrigida publicada pelo mantenedor. São
  ferramenta que roda na máquina de quem desenvolve, não código entregue.
- **Não há procedimento de notificação de incidente** conforme o art. 48. Este
  arquivo trata de falha de software, que é outra coisa.

---

## Antes de implantar com dado real

1. Definir o encarregado pelo tratamento e o canal de atendimento ao titular.
2. Resolver a trilha de auditoria de acesso a prontuário.
3. Criar a ação administrativa de eliminação.
4. Escrever o procedimento de incidente, com prazo e responsável.
5. Rotacionar qualquer chave que tenha circulado em ambiente de teste.
