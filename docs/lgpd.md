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

## O que foi ligado, e como se confere

Até 13/10/2026 as funções deste módulo existiam e **nenhuma tela as chamava**.
O sistema dizia estar em conformidade na tela do agente e não tinha prova de
consentimento, trilha de acesso nem caminho para o direito de eliminação.

Situação agora, por obrigação legal:

| Obrigação | Onde está | Como se confere |
|---|---|---|
| Art. 37, registro das operações | `auditRepository` no aplicativo; `fn_ler_morador` no banco | `rodar-testes-leitura.sh`, 10 verificações |
| Art. 7º/11, prova do consentimento | `lgpdRepository.registrarConsentimento`, no cadastro do morador | `lgpdRepository.test.ts` |
| Art. 18, IV, eliminação | `lgpdRepository.anonimizar`, na ficha do morador | `lgpdRepository.test.ts` |
| Art. 16, retenção | `lgpdRepository.levantarVencidos`, no painel do gerente | `lgpdRepository.test.ts` |

### Os eventos que entram na trilha

No aplicativo: entrar no sistema, abrir prontuário, exportar relatório e
anonimizar morador. No painel: aprovar e rejeitar cadastro, e abrir a ficha de
um paciente.

A leitura no painel precisou de solução diferente das outras. Lá o navegador
fala direto com o PostgREST usando a chave `anon`, sob RLS, e não existe
servidor nosso no meio onde gravar. Gravar pelo cliente seria teatro, porque
bastaria não chamar. A saída foi `fn_ler_morador`, uma função `SECURITY
DEFINER` com `search_path` preso, que grava o registro na mesma transação em
que lê. Ela também grava `LEITURA_NEGADA` quando recusa: sem isso, varrer
identificadores não deixaria marca nenhuma.

### A trilha e o consentimento chegam ao servidor

Os dois entram na fila de sincronização. A prova do aceite não pode ficar só
no aparelho: se o celular sumir, some junto a demonstração de que o titular foi
informado.

A trilha vinda do aparelho não é porta para forjar ação de outro agente: a
policy de inserção do servidor exige `agente_id = auth.uid()`, então o
aplicativo só grava evento em nome de quem está de fato autenticado.

Uma diferença de tipo precisou de tradução. No SQLite não existe JSON, e o
contexto do registro é TEXT com o JSON serializado dentro; no PostgreSQL a
coluna é JSONB. Mandando a string crua, o servidor aceita e grava um JSONB que
é uma string, não um objeto, e a consulta por campo dentro do JSON deixa de
encontrar qualquer coisa. Sem erro nenhum. É o tipo de defeito que só aparece
quando alguém precisa investigar um incidente e a trilha não responde.

### O que a trilha não guarda

Conteúdo. O registro diz qual tabela e qual identificador foram tocados, e um
contexto curto. Trilha que copia o prontuário multiplica o problema que
deveria vigiar, e há teste conferindo campo a campo que nenhum dado clínico
aparece no que foi gravado.

### Falhar ao auditar não desfaz a operação

Nenhuma chamada usa `await`. A razão é concreta: a auditoria já quebrou neste
projeto por nome de coluna errado, a exceção subiu, e a tela disse que a troca
de senha não deu certo depois de ela ter acontecido. O agente em campo não
pode perder a visita registrada porque o log falhou.

---

## O que continua faltando

**Art. 48, notificação de incidente.** Não há procedimento documentado nem
canal definido. É decisão administrativa com a secretaria, não de código.

**Encarregado e canal do titular.** Sem definição, os pedidos de titular não
têm a quem responder. Também é decisão administrativa.

**Prazo vencido não apaga nada.** É deliberado: o painel conta e mostra, e
quem decide eliminar é a coordenação. Um sistema que apaga prontuário sozinho
é pior que um que guarda demais.

---

## Onde está o código

```
ConectAgente-mobile/src/utils/lgpd.ts              funções e base legal
ConectAgente-mobile/src/utils/__tests__/lgpd.test.ts
ConectAgente-mobile/src/database/schema.ts         audit_log, consentimentos
ConectAgente-mobile/src/database/repositories/lgpdRepository.ts   consentimento, eliminacao, retencao
ConectAgente-mobile/src/database/repositories/auditRepository.ts  trilha do aplicativo
ConectAgente-web/src/services/auditService.ts      leitura e escrita da trilha
ConectAgente-web/supabase/migration_auditoria_leitura.sql  fn_ler_morador
ConectAgente-web/supabase/migration_rls_completo.sql  policies e imutabilidade
ConectAgente-web/supabase/testes/rodar-testes-leitura.sh   prova da leitura auditada
```
