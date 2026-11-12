# OWASP ASVS 4.0.3: situação do painel web e da API

Cada capítulo do padrão de verificação de segurança de aplicações web da
OWASP, com o que o painel e a API do banco fazem e onde isso é conferido.
Alvo: **nível 2**, o recomendado para aplicação que trata dado sensível. Base:
versão 1.3.0, medida em 12/11/2026. O aplicativo tem a conferência própria em
[masvs.md](masvs.md).

| Capítulo | O que o ASVS pede | Como o sistema atende | Evidência | Situação |
|---|---|---|---|---|
| V1 Arquitetura | modelo de ameaças, fronteira de confiança, controle no servidor | a regra de acesso mora no banco (RLS, funções e gatilhos); painel e app são clientes | [modelo-de-ameacas.md](modelo-de-ameacas.md), [ADR 1](adr/0001-monolito-com-o-banco-como-fronteira.md) | atende |
| V2 Autenticação | MFA, limite de tentativas, senha forte | segundo fator TOTP obrigatório (`aal2` lido do JWT assinado); limite por endereço e por CPF contado no Postgres | `lib/segundoFator.ts`, `lib/rateLimit.ts`, testes de `segundo-fator` | atende no painel; a API ainda aceita sessão de um fator vinda do app |
| V3 Sessão | cookie seguro, expiração por inatividade e absoluta, encerrar no sair | cookie `Secure` e `SameSite=Lax`; cai com 30 min sem uso e 12 h desde a senha, encerrada no servidor; o sair apaga o cache local | `lib/sessao.ts`, `sessao.test.ts`, cookie conferido em produção | atende; o cookie não é `HttpOnly` porque o cliente do Supabase lê o token (mitigado pela CSP) |
| V4 Controle de acesso | negar por padrão, sem IDOR, sem escalada | RLS em toda tabela; gatilho impede mudar o próprio papel, unidade e situação; gravação só na família do próprio agente; portão de rotas igual ao menu | suítes `03`, `11`, `12` e `13`; [pentest](pentest-2026-11.md) | atende desde a 1.3.0 |
| V5 Validação e codificação | validação por esquema, saída codificada, sem injeção | Zod nas ações do servidor; PostgREST com parâmetros; React codifica a saída; fórmula neutralizada no CSV | `app/actions/registro.ts`, `relatorioService.ts` (`neutralizarFormula`) | atende |
| V6 Criptografia | algoritmos atuais, segredo fora do código | TLS na borda (Vercel e Supabase); resumo SHA-256 na chave do limite; nenhum segredo no repositório (gitleaks na CI) | `next.config`, workflow de segurança | atende |
| V7 Erros e registro | mensagem genérica, trilha de eventos de segurança | a tela mostra o que falhou, sem texto do banco; trilha de leitura, leitura negada, exportação, mudança de papel e de unidade | `falhaDeConsulta`, tabela `audit_log` | atende |
| V8 Proteção de dado | dado sensível fora de cache e do navegador, minimização | cache só no `sessionStorage`, apagado no login e no sair; CPF mascarado em lista; colunas clínicas fechadas na API | `lib/cache.ts`, `cache.test.ts`, suíte `06` | atende |
| V9 Comunicação | TLS, HSTS | HSTS de 2 anos com preload; `upgrade-insecure-requests` | cabeçalhos de produção | atende |
| V10 Código malicioso | dependências conferidas, integridade | lockfile, OSV-Scanner e `npm audit` na CI; Semgrep sem achado | `osv-scanner.toml`, workflows | atende |
| V11 Lógica de negócio | fluxo na ordem certa, limites de negócio | escolha de área uma única vez; exportação só depois do registro na trilha; família própria na visita | suítes `11` e `13`, `relatorioConsultas.test.ts` | atende |
| V12 Arquivos | upload seguro | o painel não recebe upload; os relatórios saem gerados no navegador | código | não se aplica |
| V13 API | autorização em toda chamada, sem anônimo | papel `anon` sem privilégio em tabela e função; CSRF conferido pela origem em toda escrita | suíte `08-sem-anonimo.sql`, `lib/csrf.ts` | atende |
| V14 Configuração | cabeçalhos de segurança, sem informação de versão, divulgação responsável | CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, COOP, COEP, CORP, `nosniff`; `security.txt` público | `middleware.ts` (`montarCsp`), `public/.well-known/security.txt` | atende |

## O que fica aberto

1. **Segundo fator na API (V2).** Depende de levar o TOTP ao aplicativo e então
   exigir `aal2` numa policy restritiva para coordenação e gestão.
2. **Cookie sem `HttpOnly` (V3).** Limitação do cliente do Supabase no
   navegador; a alternativa seria mover a autenticação inteira para o servidor
   do Next e deixar o navegador sem token. Registrado como risco aceito,
   mitigado pela CSP.
3. **DAST automático.** O workflow do OWASP ZAP existe, mas os runners do GitHub
   Actions estão sem cota nesta conta; a verificação desta versão foi manual
   ([pentest](pentest-2026-11.md)).
