# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não Lançado]

### Corrigido

- **A área administrativa estava inalcançável numa instalação nova.** A conta
  de administrador nasce com senha sorteada, e quem lia essa senha era a tela
  de configurações, que fica dentro da própria área administrativa. Para ver a
  senha era preciso já estar dentro, e para entrar era preciso a senha.
  Agentes, residências, visitas e configurações do gerente ficavam fora de
  alcance para sempre, e nada no aplicativo avisava.
- **O contador de visitas do dia nunca contava a visita do dia.** A coluna
  guarda só a data, `2026-10-13`, e a consulta comparava com o resultado de
  `toISOString()`, que leva hora e fuso grudados. O SQLite compara texto e a
  string mais curta perde. O mesmo defeito aparecia no relatório, que dizia
  "Nenhuma visita encontrada" num dia com visita registrada, e em mais quatro
  lugares que derivavam a data civil do UTC: das 21h em diante, no fuso do
  Brasil, o recorte já é o dia seguinte.
- **O modo escuro funcionava em uma tela de vinte e três.** As demais liam a
  paleta clara fixa e continuavam brancas com o escuro ligado.
- **O arquivo de instalação do banco quebrava na segunda execução**, deixando
  o banco pela metade sem a pessoa ter como saber o que entrou.
- **A barra de progresso mostrava 100% para quem não tem meta**, porque
  dividir por zero dá infinito.
- **O aplicativo se dizia conectado com o `.env` de exemplo** e mostrava erro
  de rede em vez de dizer que falta configuração. O agente concluía que estava
  sem sinal.
- **O dado coletado em campo nunca chegava ao servidor.** O aplicativo é
  offline-first, continuava gravando no banco local e nada parecia errado para
  o agente, enquanto o servidor recusava toda gravação. Eram 61 colunas sem
  destino, entre elas o conteúdo clínico inteiro: pressão, glicemia, peso,
  encaminhamento, e as cinco fichas de prontuário completas, com pré-natal,
  vacina da criança, preventivo e relato de violência. Mais o nome divergente
  do campo de sincronização, o identificador que não era enviado, a chave
  errada nas tabelas de prontuário, o prontuário pai que nunca subia, e o
  status de agendamento em três vocabulários diferentes.
- **Elevação de privilégio na aprovação de cadastro.** As ações de servidor
  recebiam o id do aprovador como parâmetro e não verificavam quem chamava,
  usando o cliente que ignora o RLS. Qualquer pessoa na internet podia criar
  para si uma conta de gerente e ler o prontuário de todos.
- **Nenhum agente conseguia ser provisionado.** O papel do usuário estava em
  cinco vocabulários, e `supervisor`, que o formulário oferecia e a aprovação
  gravava, não existe em nenhum CHECK do banco. O middleware também liberava a
  área administrativa só para um papel impossível, e o menu inteiro pedia esse
  mesmo papel: qualquer usuário real entrava no painel e encontrava a barra
  lateral vazia.
- **A senha do administrador era pública.** Era a constante `Admin@2025`,
  escrita no código, numa tabela do README e impressa na tela de
  configurações, em repositório público. Agora é sorteada, guardada no cofre
  do sistema e exibida uma única vez.
- **Sete tabelas estavam sem Row Level Security**, incluindo `agentes`,
  `audit_log` e as cinco de prontuário. Com a chave pública, qualquer pessoa
  lia prontuário, CPF e hash de senha.
- **A exportação de relatório estava quebrada** no aplicativo: usava uma API
  do Expo que foi removida, e o teste passava porque imitava a API antiga.
- **Injeção de fórmula em planilha** na exportação, no aplicativo e no painel.
  Célula iniciada por `=` é executada pelo Excel, e as observações da visita
  são texto livre digitado em campo.
- **Trocar a senha trancava o agente fora da conta.** A gravação na trilha
  usava uma coluna que não existe, e falhava depois de a senha já ter sido
  alterada.
- **RCE crítico sem autenticação no Next.js** 15.5.20, e doze avisos no
  `axios` que vai dentro do aplicativo, entre eles SSRF por redirecionamento.
- O aplicativo derrubava na importação quando faltava o arquivo de ambiente,
  em vez de funcionar offline.
- O filtro de status do painel administrativo oferecia um valor que não existe
  e nunca devolvia nada, enquanto o status real ficava sem filtro.

### Adicionado

- **Trilha de auditoria de verdade (LGPD, art. 37).** Entrar no sistema, abrir
  prontuário, exportar relatório e anonimizar morador no aplicativo; aprovar e
  rejeitar cadastro e abrir ficha de paciente no painel. A leitura no painel
  precisou de solução diferente: lá o navegador fala direto com o banco, sem
  servidor nosso no meio, então quem registra é `fn_ler_morador`, função
  `SECURITY DEFINER` que grava na mesma transação em que lê, e também grava a
  tentativa quando recusa.
- **Consentimento, eliminação e prazo de guarda.** O aceite é registrado no
  cadastro do morador; a ficha dele oferece remover os dados pessoais, com
  dupla confirmação, mantendo o registro estatístico; e o painel do gerente
  mostra o que passou do prazo de guarda, sem apagar nada sozinho.
- **Configurador do Supabase.** Confere a credencial contra o servidor antes
  de escrever qualquer arquivo: endereço que não responde, chave recusada ou
  schema ausente param o script.
- **Modo escuro no aplicativo e no painel**, com escolha entre claro, escuro e
  seguir o aparelho.
- **Sessão do Supabase no aplicativo.** Sem ela, `auth.uid()` é nulo e toda
  policy nega a gravação. Abre no login quando há rede, sem bloquear o uso
  offline, e a sincronização para antes de tentar quando não há sessão, para
  não queimar as tentativas da fila.
- **Três suítes que exercitam o banco de verdade**, em
  `ConectAgente-web/supabase/testes/`: permissão de leitura e escrita,
  sincronização do aplicativo com o servidor, e cadastro com aprovação. Sobem
  um PostgreSQL descartável, aplicam o schema e as migrações, exercitam um
  caminho real e se autodestroem. São 61 verificações, e existem porque os
  defeitos mais graves não apareciam em teste de unidade.
- **Testes de contrato** que comparam os dois lados de cada junta: o schema do
  aparelho contra o do servidor, o SQL dos repositórios contra o schema local,
  e os papéis do código contra os CHECK do banco.
- Integração com ViaCEP para preenchimento automático de endereço.
- Exportação de relatório em PDF, CSV e Excel no painel.
- Verificação de tipos, suítes de banco, empacotamento do aplicativo e portão
  de vulnerabilidade no CI.

### Alterado

- **`/relatorios` caiu de 442 kB para 186 kB** no primeiro carregamento. O
  jsPDF, o jspdf-autotable e o xlsx entravam no pacote da tela mesmo para quem
  só abria para olhar a prévia.
- Os `enum` do TypeScript viraram objeto constante com tipo de união, o que
  eliminou quinze erros de tipo cuja saída mais fácil era escrever `as` e
  apagar a conferência.
- Documentação reorganizada: o README virou ponto de entrada curto, e o
  detalhamento foi para `docs/`, com `seguranca.md` e `lgpd.md` separando o
  que o código faz do que ele apenas declara.

### Removido

- **Notificação e sincronização em segundo plano.** O código existia e era
  coerente, mas dependia de quatro pacotes nativos não instalados, e ligá-los
  exige build de desenvolvimento, o que faria o Expo Go deixar de rodar o
  aplicativo. As versões compatíveis com o SDK 54 estão no histórico do Git.
- Dois hooks que eram duplicatas mortas, chamando métodos inexistentes.
- A pasta `landing/`, que só continha artefato de deploy vazio.

## [1.1.0] - 2026-10-29 (pré-lançamento)

### Segurança
- Backup do Android desligado: o banco com dado de saúde não sai mais pelo
  backup do Google nem por `adb backup`.
- A tela de recorte de imagem deixou de ser exportada; outro aplicativo não
  consegue mais abri-la.
- Retiradas as permissões que nada usa: gravar áudio, desenhar sobre outros
  apps e escrever no armazenamento externo.
- Documento, cartão do SUS, doença e medicação do morador só saem pela
  leitura auditada; conta desativada perde o acesso na hora.
- `decode-uri-component` 0.5.1 (GHSA-qr28-fpjm-wq7f), zod 4,
  @hookform/resolvers 5, undici e follow-redirects corrigidos.
- Chave de assinatura nova; a 1.0.0 precisa ser desinstalada antes.

### Corrigido
- Base legal da LGPD: art. 7º, III e VIII, e art. 11, II, b e f.
- A tela "Mais" mostrava um e-mail de encarregado inventado; agora diz que o
  contato está a definir pela secretaria.

## [1.0.0] - 2026-05-19

### Adicionado
- App mobile React Native (Expo SDK 54) offline-first
- Portal web Next.js para gestão administrativa
- Banco local SQLite com sincronização assíncrona para Supabase
- Autenticação local no aparelho, com controle de perfis
- Cadastro de residências, moradores e prontuários de saúde
- Agenda de visitas domiciliares
- Metas de cobertura da equipe de Agentes de Saúde
- Fila de sincronização com nova tentativa automática
- Cifra dos campos de identificação no armazenamento local
- Exportação de relatórios CSV
- Interface acessível com suporte a modo escuro
