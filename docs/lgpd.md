# LGPD: o que está pronto e o que não está

O sistema trata **dado pessoal sensível** na definição do art. 5º, II da Lei
13.709/2018: condição de saúde, medicação, dado de gestante e de criança, e
relato de violência doméstica e de negligência.

Este documento separa o que o código faz do que o código apenas declara. A
separação importa porque a versão anterior desta documentação listava nove
requisitos como "implementados", e a maior parte era função escrita que nunca
é chamada. Para órgão público, dizer que está conforme sem estar é pior que
registrar a lacuna.

---

## Base legal

| Item | Definição |
|---|---|
| Finalidade | atenção básica à saúde, acompanhamento por Agente Comunitário de Saúde |
| Base legal, dado comum | art. 7º, II: execução de política pública pela administração |
| Base legal, dado sensível | art. 11, II, "a" e "b": tutela da saúde |
| Controlador | secretaria municipal de saúde que implantar |
| Encarregado | a definir pela secretaria, antes da implantação |

O código declara isso em `ConectAgente-mobile/src/utils/lgpd.ts`, na constante
`BASE_LEGAL_LGPD`, e a tela "Mais" do aplicativo exibe o texto.

---

## O que está implementado e verificável

| Requisito | Onde | Verificado por |
|---|---|---|
| Segurança do tratamento (art. 46) | RLS em todas as tabelas, hash com sal, cifra dos campos de identificação no aparelho, SecureStore | `rodar-testes-rls.sh`, 22 verificações |
| Controle de acesso por papel | policies do banco, espelhadas nos guardas de tela | `contratoPapeis.test.ts` |
| Trilha imutável | `audit_log` append-only, `REVOKE UPDATE, DELETE`, leitura só para gerente e admin | `rodar-testes-rls.sh` |
| Exclusão lógica | `deleted_at` em `residencias`, `moradores` e `visitas` | schema |
| Minimização na exportação | relatório não leva `senha_hash` nem `assinatura_base64` | `relatorioService` |
| Transparência | aviso na entrada e no cadastro, texto da base legal na tela "Mais" | telas |

---

## O que está escrito e não é usado

Estas funções existem em `utils/lgpd.ts` e **nenhuma tela ou serviço as
chama**. Foi medido com busca por referência em todo o código:

| Função | Para que serviria | Situação |
|---|---|---|
| `criarAuditLog` | registrar acesso e alteração | nunca chamada |
| `criarConsentimento` | registrar consentimento por morador e tipo de dado | nunca chamada |
| `anonimizarMorador` | atender o direito de eliminação do art. 18, VI | nunca chamada |
| `minimizarParaLista` | reduzir o dado exibido em lista | nunca chamada |
| `calcularDataExpiracao` | aplicar prazo de retenção | nunca chamada |

A tabela `consentimentos` existe no banco local, não existe no servidor, e não
está na lista de tabelas que a fila de sincronização envia. Nada escreve nela.

No painel web, `auditService.registrarAcao` também **não é chamada por nenhuma
tela**. A única escrita real em `audit_log` acontece na troca de senha do
aplicativo, em `agenteRepository.resetarSenha`.

---

## As consequências práticas

**Art. 37, registro das operações de tratamento.** O controlador precisa manter
registro das operações. Hoje, abrir o prontuário de um morador não deixa
rastro: não há como saber quem leu o quê. Para um sistema em que o agente de
uma microárea não deveria ver o paciente de outra, a ausência de trilha é o que
impede tanto a auditoria quanto a investigação de um incidente.

**Art. 7º, I e art. 11, I, consentimento.** A base legal escolhida é política
pública e tutela da saúde, que dispensa consentimento para o tratamento em si.
Mas a tabela de consentimento foi criada no projeto, o que indica a intenção de
registrar ciência do titular, e isso não acontece.

**Art. 18, VI, eliminação.** Não há tela, ação administrativa ou rotina que
chame a anonimização. O direito não é exercível pelo sistema: dependeria de
alguém mexer no banco à mão.

**Art. 16, retenção.** `calcularDataExpiracao` prevê 20 anos para dado de saúde
e 5 para os demais. Nada aplica esse prazo: não há rotina de expurgo nem marca
de expiração nas linhas.

**Art. 48, notificação de incidente.** Não há procedimento documentado nem
canal definido. `SECURITY.md` trata de falha de software, que é outra coisa.

---

## O que fazer, em ordem de valor

1. **Ligar a trilha de auditoria nas operações de prontuário.** É a lacuna de
   maior impacto e a mais barata: as funções já existem e o lugar certo é o
   ponto único por onde as gravações passam, como foi feito com a tradução do
   payload de sincronização. Precisa também acrescentar `audit_log` à fila,
   para a trilha do aparelho chegar ao servidor, e acertar a diferença de
   colunas entre os dois lados.
2. **Definir o encarregado e o canal de titular** junto com a secretaria. É
   decisão administrativa, não de código, e sem ela os endpoints de titular não
   têm a quem responder.
3. **Criar a ação de eliminação** para gerente ou admin, chamando
   `anonimizarMorador`, com registro na trilha.
4. **Levar `consentimentos` para o servidor** e registrar a ciência do titular
   no cadastro do morador, ou remover a tabela e a função, se a decisão for que
   a base legal dispensa.
5. **Escrever o procedimento de incidente**, com prazo e responsável, conforme
   o art. 48.

---

## Onde está o código

```
ConectAgente-mobile/src/utils/lgpd.ts              funções e base legal
ConectAgente-mobile/src/utils/__tests__/lgpd.test.ts
ConectAgente-mobile/src/database/schema.ts         audit_log, consentimentos
ConectAgente-web/src/services/auditService.ts      leitura e escrita da trilha
ConectAgente-web/supabase/migration_rls_completo.sql  policies e imutabilidade
```
