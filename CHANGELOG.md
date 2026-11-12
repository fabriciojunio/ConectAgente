# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Não Lançado]

## [1.3.0] - 2026-11-12

### Segurança

- **Qualquer conta logada virava administradora** (CVSS 8.8). A policy de
  UPDATE libera a própria linha de `agentes`, e o GRANT incluía `role`,
  `unidade_saude` e `ativo`: um PATCH na API pública com `{"role":"admin"}`
  bastava. Pelo mesmo caminho a coordenação trocava de unidade e uma conta
  desativada se reativava. Um trigger agora exige administração para mudar
  papel (nunca o próprio), gerência para mudar situação e unidade, protege a
  linha de administrador e grava toda mudança de papel na trilha.
  `migration_papel_protegido.sql`, aplicada em produção e provada lá.
- **Dado de saúde ficava no navegador depois do "Sair".** O cache das listas
  ia para o `localStorage` por 24 horas. Agora fica no `sessionStorage` e é
  apagado no login, no sair e na troca de conta.
- **Coordenação sem unidade via quem também não tinha unidade.**
  `agente_unidade()` devolve nulo quando vazia (`migration_unidade_vazia.sql`).
- **Telas de administração abriam pela URL** para gerência. O portão do
  servidor segue os papéis do menu.
- **CPF mascarado** na lista de usuários; a própria linha não oferece troca de
  papel nem desativação.

### Adicionado

- **Áreas e equipes.** Catálogo de unidades (`migration_unidades.sql`). A
  coordenação sem unidade escolhe uma ou cria a sua, uma vez; depois, só a
  gerência troca. A gerência vê cada unidade com agentes e coordenação e
  designa profissionais. Toda escolha e designação fica na trilha.
- **Avisos reais no cabeçalho**: cadastros para analisar, famílias sem visita
  há mais de 30 dias e área por definir, cada um levando à página onde se
  resolve. Substituem notificações que estavam escritas no código.
- O cabeçalho mostra o papel e o recorte dos dados de quem está logado.

### Alterado

- **Painel com a identidade da área de administração do app** (roxo
  #4A148C, #7B1FA2, #AB47BC). As cores viraram tokens por papel com valores
  próprios no claro e no escuro, e as classes de cor fixa das páginas seguem o
  tema. Cartões de número no padrão do app, com filete de cor no topo.
- Filtro de unidade virou lista do catálogo para a gerência e some para quem
  só vê a própria unidade. A busca do cabeçalho, que não buscava nada, saiu.
- Textos com acento, títulos de gráfico sem repetição e rótulos de filtro
  ligados aos campos (leitor de tela).

## [1.2.5] - 2026-11-12

### Adicionado

- **Medicamentos e dúvidas do morador.** O botão "Gerenciar medicamentos" do
  prontuário só abria um aviso de "em breve". Agora abre a lista de remédios
  do morador, com dose, horário, os problemas de uso que o agente observou
  (esquecimento, horário ou quantidade errados, armazenamento, automedicação,
  efeito colateral, falta do remédio) e a dúvida que ele leva à equipe da UBS.
  A resposta volta com quem respondeu (enfermeiro, médico ou farmacêutico) e
  quando. Segue as atribuições do ACS na PNAB: orientar sobre o uso correto,
  sem prescrever. No servidor, `migration_medicamentos.sql` fecha as colunas
  clínicas na API e só deixa o agente dono gravar, e só para morador dele.
- **Segundo fator no painel.** Toda conta do painel cadastra um app
  autenticador (TOTP) e confirma o código a cada login. O middleware exige o
  nível `aal2` em toda página, e as ações que usam a chave de serviço conferem
  de novo.

### Corrigido

- **A sincronização nunca funcionava para quem se cadastrou pelo aplicativo.**
  Achado no aparelho, com 19 registros presos na fila. Eram dois defeitos
  juntos: o aplicativo abria a sessão do servidor com o e-mail digitado no
  cadastro do celular, e a conta do servidor usa `<cpf>@conectagente.local`;
  e o registro subia com o id do agente sorteado no aparelho, que nunca é o
  id da conta do servidor exigido pelo RLS. Agora a sessão usa o e-mail da
  conta e o dono do registro é trocado pelo da conta logada ao enviar.
- **A falha de sincronização era invisível.** O selo só mostrava "pendentes"
  e o botão Sincronizar não respondia. Agora o selo fica vermelho
  ("Parada"), o botão sempre diz o resultado, e o login avisa quando o
  servidor não reconhece a conta, explicando o que a coordenação precisa
  fazer.
- **O prontuário apagava dado ao ser salvo de novo.** A tela carregava só parte
  da aba de saúde: pressão, glicemia, datas e as abas de gestante, criança,
  mulher e social abriam em branco, e salvar gravava o branco por cima (a
  gestante voltava a "não gestante"). Agora as cinco abas são zeradas e
  preenchidas inteiras com o que está gravado.
- **Formulários de cadastro reabriam com os dados anteriores.** "Nova
  residência" voltava com o endereço da casa anterior, e "Novo morador" ficava
  preso à residência da primeira abertura, podendo cadastrar o morador na casa
  errada. Os dois zeram ao abrir.
- **Botões atrás dos botões do Android.** O login não rolava e escondia
  "Configurar administrador" e o rodapé; os seletores (risco, sexo,
  escolaridade, UF) e as folhas do administrador cortavam a última opção.
- **Tema escuro na Agenda.** O calendário continuava branco.
- **Data cortada no Início** ("Quarta-feira, 11 de nove...").
- **Abas do prontuário.** A aba seguinte abria no meio da rolagem e a fileira
  de abas não acompanhava a aba ativa.

### Segurança

- **Captura de tela bloqueada** no aplicativo inteiro (`FLAG_SECURE`): print,
  gravação e miniatura dos recentes saem pretos (MASVS-PLATFORM-3).
- **Limite de tentativas no banco.** Login, cadastro e aprovação contavam em
  memória de cada instância do painel; agora contam no Postgres
  (`migration_limite_de_tentativas.sql`), com a chave em SHA-256, sem CPF nem
  IP em claro. Sem a migração, o painel volta à contagem em memória.
- O limitador deixou de ser Server Action: com `'use server'`, o navegador
  conseguia chamá-lo direto e gastar o limite de outra pessoa.
- Trilha de auditoria ao incluir, responder e remover medicamento, sem o nome
  do remédio nem a dúvida.
- **Relatório em Excel com segurança dentro do arquivo:** faixa de
  confidencialidade (LGPD, art. 11) no topo das duas abas e nas propriedades
  do arquivo, abas protegidas contra edição (filtrar e ordenar continuam
  liberados) com senha sorteada que não fica guardada, e o código de quem
  gerou no resumo. Conferido abrindo o arquivo no Excel. Senha para abrir
  exige criptografia que a biblioteca usada não oferece.

### Testes

- Aplicativo: 19 casos para o resumo do Início, a foto de perfil e os cartões
  do painel, e os da tela de medicamentos, do carregamento do prontuário e
  das guardas de layout.
- Banco real: 149 verificações (eram 127), com a suíte de medicamentos e os
  ataques ao limite de tentativas.

## [1.2.4] - 2026-11-11

### Corrigido

- **Entrar, criar conta e trocar senha demoravam segundos.** As 100 mil
  iterações do PBKDF2 rodavam em JavaScript puro no Hermes, que não tem JIT.
  O cálculo passou para código nativo do Android (`modules/pbkdf2-nativo`),
  fora da thread da tela, com saída idêntica à anterior: as senhas já
  gravadas continuam valendo.
- **O botão de voltar não levava à tela anterior.** As abas mandavam o
  voltar para a primeira aba, o cabeçalho abria uma tela nova em vez de
  voltar, e o formulário salvo ficava no histórico. O botão do cabeçalho e o
  do celular agora voltam para onde a pessoa estava.
- **A barra de abas ficava por baixo dos botões do Android.**
- **Tema escuro ilegível.** O "branco" da paleta escura valia o fundo escuro,
  e o texto sobre o gradiente (nome, meta, botões) sumia, com contraste de
  1,9:1. As duas paletas passam no mínimo do WCAG AA (4,5:1), conferido por
  teste, inclusive cores do tema claro que estavam abaixo.
- **Semanas de gestação vazias eram gravadas como texto** numa coluna de
  número, e a sincronização para o servidor falhava.

### Alterado

- Tela de Início reorganizada: a rota só monta a tela, e regra, dados,
  estilos e partes visuais ficam em `src/features/`. Cabeçalho de seção,
  cartão de número e atalho viraram componentes compartilhados com o painel
  do administrador. Nenhum `as any` no aplicativo.

### Segurança

- `node-forge` 1.4.3 (GHSA-6cv4-p8m7-4r25, GHSA-j8rw-jp99-435v e
  GHSA-w4xr-hqv8-ch44), dependência do Expo CLI usada só no build.

### Documentação

- Modelo de ameaças STRIDE e LINDDUN, mapa do OWASP MASVS e auditoria LGPD
  com relatório de impacto, em `docs/`.

## [1.2.3] - 2026-11-10

### Segurança

- **A tela de entrada mostrava a senha do administrador** para quem abrisse o
  aplicativo, e o aviso só saía com um toque dentro da área administrativa.
  Agora o administrador nasce sem senha e quem instala escolhe a senha em
  "Configurar administrador". Instalação vinda da 1.2.x tem a senha exibida
  tratada como vazada: a atualização a apaga e pede configuração nova.
- **"Esqueci minha senha" trocava a senha de qualquer conta com CPF e
  e-mail**, que não são segredo; os do administrador estavam na tela e no
  código. Passa a exigir o código de recuperação, mostrado uma única vez no
  cadastro e trocado a cada uso. O administrador gera um código novo para o
  agente que perdeu o dele.
- **Hash de senha em PBKDF2-HMAC-SHA256** com 100 mil iterações, no lugar de
  um SHA-256 de uma passada. Senhas antigas são regravadas no próximo login.
- **O limite de tentativas não zera mais ao reabrir o aplicativo.**

### Adicionado

- Painel: gerente e admin redefinem a senha de sincronização de quem está
  abaixo deles (Agentes → detalhes), para o agente que recuperou a senha no
  aparelho. O aplicativo avisa no login quando a sincronização parou por isso.
- Aplicativo: reiniciar o aparelho sem reinstalar, para o administrador que
  perdeu senha e código. Mostra quanto ainda não sincronizou e exige
  confirmação digitada.
- Planilhas organizadas no aplicativo e no painel: datas e números como
  valores de verdade, filtro no cabeçalho, largura das colunas, ordem
  cronológica, aba de resumo (aplicativo) e de filtros aplicados (painel).

### Corrigido

- **A planilha exportada pelo aplicativo saía com o endereço como código** (o
  UUID da residência) e o paciente sempre vazio: a consulta buscava os dois e
  o mapeamento os descartava.
- Campo vazio da planilha saía como `'-`. A proteção contra fórmula continua
  no CSV; no Excel cada célula é gravada como texto declarado.
- Status do relatório do painel aparecia com o valor do banco
  (`nao_encontrado`).

## [1.2.2] - 2026-11-09

### Segurança

- **Quem não fez login não toca mais em nada no banco.** O papel `anon`
  tinha SELECT nas colunas de `agentes` (CPF, e-mail, telefone), escrita e
  TRUNCATE nas tabelas de dado e executava as funções auxiliares das
  policies. Saiu também a policy que deixava gravar pedido de cadastro
  direto pela API. Aplicado em produção em 09/11/2026
  (`migration_sem_anonimo.sql`).
- **Nenhuma coluna clínica das fichas de prontuário sai pela API.** Era a
  pendência aberta em `docs/seguranca.md`. O aplicativo passa a gravar as
  fichas com INSERT e, na retentativa, UPDATE pela `prontuario_id`, sem
  upsert (`migration_prontuario_fechado.sql`, que depende desta versão).

### Corrigido

- O `/api/health` do painel lê a recusa por permissão como prova de que o
  banco respondeu, com GET para separar isso de chave inválida.

## [1.2.1] - 2026-11-09

### Corrigido

- **Toda data de visita aparecia um dia antes no aplicativo.** A data é
  gravada só com o dia, `2026-10-13`, e a conversão para exibição a lia como
  meia-noite em UTC, que no fuso do Brasil ainda é dia 12 às 21h. Afetava a
  lista de visitas, o detalhe da visita, as fichas da residência e do morador,
  a agenda, as telas do administrador e as planilhas exportadas em Excel e CSV.
- **A coluna "Horário" da planilha mostrava 21:00 em toda visita.** A visita
  guarda só o dia; a coluna passou a ser "Registrado em", com a hora em que o
  registro foi feito no aparelho.
- **A idade avançava um dia antes do aniversário**, pela mesma leitura em UTC.
  Pesa na puericultura, que usa a idade para o acompanhamento até dois anos.
- **O Cartão SUS aceitava qualquer sequência de 15 dígitos.** Passa a conferir
  o primeiro dígito (1, 2, 7, 8 ou 9) e o dígito verificador do Cartão Nacional
  de Saúde. A busca continua achando cartões gravados antes da conferência.
- **Visita realizada aceitava data futura** e agendamento aceitava data
  passada. Um 2062 digitado no lugar de 2026 entrava como visita feita.
- **Painel web:** filtros de unidade, microárea e bairro que davam erro ou não
  filtravam, último dia do período fora das consultas, relatórios cortados em
  1.000 linhas sem aviso e números de demonstração exibidos no lugar de zero.

### Removido

- `healthValidators.ts`, com uma segunda conferência do Cartão SUS fora do
  algoritmo oficial, e a exportação de pacientes que nenhuma tela chamava e
  preenchia hipertensão e diabetes sempre com "-".

## [1.2.0] - 2026-11-02

### Segurança

- **Banco local cifrado com SQLCipher.** O arquivo do SQLite no aparelho passa a
  ser cifrado inteiro, com chave de 256 bits guardada no Keystore. Substitui a
  proteção que dependia só da cifra de disco do Android. Como o formato do
  arquivo muda, atualizar de uma versão anterior exige nova instalação; o dado
  volta do servidor na sincronização. Versão para 1.2.0 (`versionCode` 3).
- **Certificate pinning do Supabase.** A sincronização só é aceita se a cadeia
  TLS passar pela intermediária (Google Trust Services WE1) ou pela raiz (GTS
  Root R4), fixadas pela configuração de segurança de rede do Android, com data
  de expiração para não travar o app caso o Google rotacione a cadeia.

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
