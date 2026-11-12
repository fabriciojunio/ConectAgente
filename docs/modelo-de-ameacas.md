# Modelo de ameaças

STRIDE para segurança e LINDDUN para privacidade, sobre o fluxo do dado de
saúde do momento em que o agente digita até a coordenação ler no painel. Cada
ameaça aponta o controle que existe e onde ele é provado. O que não está
coberto aparece como **aberto**, com o motivo.

Atualizado em 11/11/2026, versão 1.2.5 do aplicativo.

## Fluxo do dado e fronteiras de confiança

```
 Agente ──▶ [1] Aplicativo Android ──▶ [2] SQLite cifrado no aparelho
                    │
                    │ fronteira A: rede pública, HTTPS com certificado fixado
                    ▼
              [3] Supabase: PostgREST + Auth ──▶ [4] PostgreSQL com RLS
                    ▲
                    │ fronteira B: navegador, sessão por cookie
                    │
 Coordenação ──▶ [5] Painel Next.js (Vercel)
```

Ativos: dado clínico do morador (condição de saúde, gestação, criança,
violência doméstica, medicamentos em uso e dúvidas levadas à equipe), dado de identificação (nome, CPF, Cartão SUS), conta do
agente e trilha de auditoria. Atores de ameaça: celular perdido ou roubado em
campo, pessoa com a chave pública do Supabase (que vai dentro do APK),
agente curioso sobre paciente de outro agente, conta de coordenação
comprometida e atacante na mesma rede Wi-Fi.

## STRIDE

| # | Ameaça | Onde | Controle | Evidência | Situação |
|---|---|---|---|---|---|
| S1 | Alguém se passa pelo agente no aparelho | [1] | senha com PBKDF2-HMAC-SHA256 (100 mil iterações), bloqueio de 15 min depois de 5 erros, gravado no aparelho | `utils/encryption.ts`, `database/limiteDeTentativas.ts`, testes de `agenteRepository` | atende |
| S2 | Alguém usa a chave pública para gravar como outro agente | [3][4] | toda policy decide por `auth.uid()`; a chave pública não dá privilégio a quem não fez login | suíte `08-sem-anonimo.sql` | atende |
| S3 | Conta de coordenação tomada | [5] | segundo fator (TOTP, nível `aal2` no JWT) exigido pelo middleware em toda página e conferido de novo nas ações com chave de serviço; sessão por cookie `HttpOnly`; conta desativada perde acesso | `lib/segundoFator.ts`, `middleware.ts`, testes de `segundo-fator` e de `registro`, suíte `07-conta-ativa.sql` | parcial: **a API do banco ainda aceita sessão de um fator** (o aplicativo usa a mesma conta) |
| T1 | Arquivo do banco alterado no aparelho | [2] | SQLCipher autentica cada página; arquivo adulterado não abre | `database/database.ts`, `docs/apk.md` | atende |
| T2 | Dado alterado no caminho | A | HTTPS com pino na intermediária e na raiz | `plugins/fixar-certificado.js`, MobSF | atende |
| T3 | Aprovação de cadastro forjada para virar gerente | [5] | Server Action confere sessão e papel de quem chama | teste de `cadastro`, suíte `04-cadastro-aprovacao.sql` | atende |
| T4 | Fórmula injetada na planilha exportada | [1][5] | célula que começa com `=`, `+`, `-` ou `@` é neutralizada | `services/exportService.ts` (`neutralizarFormula`) | atende |
| R1 | Leitura de prontuário sem rastro | [4] | documento, doença e medicação só saem por função que grava a leitura; colunas clínicas das fichas e dos medicamentos fechadas na API | suítes `05-leitura-auditada.sql`, `09-prontuario-fechado.sql`, `10-medicamentos.sql` | atende |
| R2 | Apagar ou editar a trilha | [4] | `audit_log` só aceita INSERT; UPDATE e DELETE revogados | `setup-completo.sql`, suíte de permissão | atende |
| I1 | Celular perdido expõe o banco | [2] | banco inteiro cifrado (AES-256), chave no Keystore; backup automático desligado | `database/chave.ts`, `app.json` (`allowBackup: false`) | atende |
| I2 | Agente lê paciente de outro agente | [4] | RLS por agente, unidade e papel | suíte `03-jornada-agente.sql` e permissão por papel | atende |
| I3 | Visitante lê dado pela API pública | [4] | papel `anon` sem privilégio em tabela e função | suíte `08-sem-anonimo.sql` | atende |
| I4 | Erro devolve detalhe interno | [5] | mensagem genérica ao usuário, detalhe só no log do servidor | Server Actions do painel | atende |
| I5 | Captura de tela ou app em segundo plano mostra prontuário | [1] | `FLAG_SECURE` no aplicativo inteiro: print e gravação saem pretos, a miniatura dos recentes não mostra conteúdo | `app/_layout.tsx` (`usePreventScreenCapture`), teste de guarda `protecaoDeTela` | atende |
| D1 | Força bruta no login do painel | [5] | limite por endereço e por CPF contado no Postgres (`registrar_tentativa`), igual para todas as instâncias; chave em SHA-256, sem CPF nem IP em claro; reserva em memória se o banco não responder | `lib/rateLimit.ts`, `migration_limite_de_tentativas.sql`, suíte de permissão | atende |
| D2 | Fila de sincronização travada por falha de sessão | [1] | sincronização para sem sessão em vez de gastar as tentativas; 5 tentativas antes de erro visível | `services/syncService.ts` e testes | atende |
| E1 | Agente se promove a gerente ou admin | [4] | papel em CHECK; cadastro público só cria agente pendente; trigger `trg_agentes_proteger_campos`: só administração muda papel, nunca o próprio, e a mudança vai para a trilha. Até 12/11/2026 a própria linha aceitava `role` por PATCH (ver seguranca.md, "Qualquer conta virava administradora") | suítes `04-cadastro-aprovacao.sql` e `12-papel-protegido.sql`; prova em produção numa transação desfeita | atende desde a 1.3.0 |
| E3 | Coordenação muda de unidade para ler pacientes de outra | [4][5] | troca de unidade só pela gerência; a coordenação escolhe uma vez, por função que grava na trilha; unidade vazia não casa com nada | suítes `11-unidades.sql` e `12-papel-protegido.sql` | atende |
| E4 | Conta desativada se reativa | [4] | `ativo` só muda por gerência ou administração, nunca na própria conta | suíte `12-papel-protegido.sql` | atende |
| T5 | Agente grava visita na família de outro, que sai do alerta de atraso | [4] | gatilho `fn_exigir_familia_propria` em visita, morador e agendamento; policies antigas `FOR ALL` removidas | suíte `13-visita-propria.sql`; prova em produção | atende desde a 1.3.0 |
| S4 | Pessoa seguinte no computador da UBS herda a sessão do painel | [5] | sessão cai com 30 min sem uso e 12 h desde a senha; cookie `Secure` | `lib/sessao.ts`, `sessao.test.ts`; cookie conferido em produção | atende desde a 1.3.0 |
| I8 | Exportação tira dado de saúde do sistema sem rastro | [5] | exportação registrada na trilha antes do arquivo sair; aviso de sigilo no arquivo | `relatorioConsultas.test.ts`; 15 exportações conferidas na trilha | atende desde a 1.3.0 |
| I7 | Próxima pessoa no computador da UBS lê o cache do painel | [5] | cache no `sessionStorage`, apagado no login, no sair e na troca de conta | `lib/cache.ts`, `cache.test.ts`, `useAuth.test.ts` | atende |
| I6 | Medicamento e dúvida de um morador gravados por outro agente | [4] | INSERT só para morador do próprio agente (`morador_do_agente`), UPDATE e DELETE só do dono; trilha sem o nome do remédio | suíte `10-medicamentos.sql`, teste de `medicamentoRepository` | atende |
| E2 | Tela de biblioteca exposta a outros apps | [1] | atividades com `exported="false"` | `plugins/endurecer-manifesto.js`, MobSF | atende |

## LINDDUN (privacidade)

| # | Ameaça | Controle | Situação |
|---|---|---|---|
| L (vinculação) | cruzar visitas para montar o perfil de uma família fora da finalidade | acesso só por papel e unidade; exportação sem senha e sem assinatura | atende |
| I (identificação) | identificar o morador nos números do painel | agregados por unidade e microárea, sem nome | parcial: **pseudonimização dos agregados não formalizada** |
| N (não repúdio indesejado) | trilha guardar conteúdo clínico | a trilha registra quem leu e quando, nunca o conteúdo | atende |
| D (detecção) | saber que alguém é paciente só por existir registro | leitura por função auditada; visitante sem acesso | atende |
| D (divulgação) | vazamento do dado sensível | itens I1 a I6 acima | atende |
| U (desconhecimento) | titular não saber do tratamento | registro de ciência no cadastro; base legal documentada | parcial: **canal do titular e encarregado são decisão da secretaria** |
| N (não conformidade) | tratar além da finalidade ou do prazo | prazo de retenção visível ao gerente; anonimização a pedido | atende; a eliminação é decisão da coordenação |

## O que fica aberto, em ordem de risco

1. **Segundo fator também na API (S3).** O painel exige o código do
   autenticador desde a 1.2.5, mas o banco ainda aceita sessão de um fator,
   porque o aplicativo usa a mesma conta. Fechar exige levar o TOTP para o
   aplicativo e então uma policy restritiva com `aal2` para coordenação e
   gestão.
2. **Pseudonimização formal dos agregados e definição do encarregado (LINDDUN).**
   Dependem da secretaria de saúde.

Fechados na 1.2.5: segundo fator no painel, `FLAG_SECURE` e limite de
tentativas compartilhado. Fechados na 1.3.0: escalada de papel pela própria
linha (E1), troca de unidade e reativação pela própria conta (E3, E4) e cache
de dado de saúde no navegador (I7).

Ver também [seguranca.md](seguranca.md), [masvs.md](masvs.md) e
[auditoria-lgpd.md](auditoria-lgpd.md).
