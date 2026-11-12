# Auditoria LGPD e relatório de impacto

Avaliação do ConectAgente pelos oito grupos de teste de um programa de
auditoria interna da LGPD: tratamento e consentimento, direitos fundamentais,
princípios, medidas técnicas, direitos do titular, governança, relatório de
impacto e encarregado. Cada resposta aponta a prova. Base: versão 1.2.5, em
11/11/2026.

O controlador é a secretaria municipal de saúde que implantar o sistema. Por
isso parte das respostas é "depende do controlador": o software entrega o
meio, a decisão é administrativa.

## 1. Tratamento e base legal

| Pergunta | Resposta | Prova |
|---|---|---|
| Que tratamento é feito? | coleta em visita domiciliar, armazenamento no aparelho e no servidor, consulta pela coordenação, exportação de relatório | [arquitetura.md](arquitetura.md) |
| Qual a base legal? | dado comum: art. 7º, III e VIII; dado sensível: art. 11, II, "b" (política pública) e "f" (tutela da saúde). O consentimento **não** é a base: é política pública de saúde | `utils/lgpd.ts` (`BASE_LEGAL_LGPD`), [lgpd.md](lgpd.md) |
| Há dado sensível? | sim: condição de saúde, gestação, medicação, violência doméstica | [seguranca.md](seguranca.md) |
| Há dado de criança? | sim, na ficha de puericultura; o tratamento segue o art. 14 pelo melhor interesse, dentro da política de saúde | ficha de puericultura |
| Ciência do titular? | registrada no cadastro do morador, com data e versão do texto | `lgpdRepository.registrarConsentimento` |
| Há compartilhamento? | só com o Supabase (operador, infraestrutura); nenhum terceiro recebe o dado | contrato do controlador com o operador: **depende do controlador** |

## 2. Direitos fundamentais

Privacidade e intimidade (CF, art. 5º, X) são o centro do desenho: autorização
decidida no banco, leitura sensível registrada, violência doméstica visível só
para quem acompanha o morador. Não há decisão automatizada sobre o titular.

## 3. Princípios (art. 6º)

| Princípio | Como o sistema atende |
|---|---|
| Finalidade e adequação | campos das cinco fichas do acompanhamento da atenção básica e a lista de medicamentos com as dúvidas levadas à equipe, que apoia a orientação sobre uso correto prevista nas atribuições do ACS (PNAB 2017); nada além |
| Necessidade | exportação sem senha e sem assinatura; trilha sem conteúdo clínico (nem o nome do remédio); chave do limite de tentativas em hash, sem CPF nem IP |
| Livre acesso e transparência | texto da base legal na tela "Mais"; aviso no cadastro |
| Qualidade | validação na entrada (CPF, Cartão SUS com dígito verificador, datas) |
| Segurança e prevenção | grupo 4 abaixo |
| Não discriminação | o sistema não pontua nem classifica pessoas |
| Responsabilização | trilha `audit_log` imutável; este documento |

## 4. Medidas técnicas (art. 46)

| Contra | Medida | Prova |
|---|---|---|
| acesso não autorizado | RLS em todas as tabelas, visitante sem privilégio, colunas sensíveis fechadas (inclusive medicamentos), senha com PBKDF2, segundo fator no painel, limite de tentativas contado no banco | suítes em PostgreSQL real (permissão, colunas, anônimo, fichas, medicamentos); testes de `segundo-fator` |
| destruição e perda | gravação local primeiro, fila de sincronização com retentativa, exclusão lógica | testes do `syncService` |
| alteração | SQLCipher autenticado no aparelho, HTTPS com certificado fixado, trilha só de inclusão | [modelo-de-ameacas.md](modelo-de-ameacas.md) (T1, T2, R2) |
| comunicação e difusão indevidas | banco do aparelho cifrado, backup automático desligado, captura de tela bloqueada (`FLAG_SECURE`), relatório sem campo de senha | [masvs.md](masvs.md) |

## 5. Direitos do titular (art. 18) e incidentes

| Direito ou processo | Situação |
|---|---|
| confirmação e acesso | a coordenação consulta e exporta o cadastro do titular |
| correção | edição do cadastro pelo agente responsável |
| anonimização e eliminação | `lgpdRepository.anonimizar`, na ficha do morador |
| portabilidade | exportação em planilha |
| revogação da ciência | anonimização a pedido |
| comunicação de incidente | roteiro com o prazo de 3 dias úteis da Resolução CD/ANPD nº 15/2024, em [incidente.md](incidente.md) |
| eliminação ao fim do tratamento | o painel lista os registros com prazo vencido; quem decide é a coordenação |
| canal do titular | **depende do controlador** |

## 6. Governança (art. 50)

O software entrega política de segurança ([SECURITY.md](../SECURITY.md)),
modelo de ameaças, roteiro de incidente e esteira que barra falha antes de
publicar (Semgrep, OSV-Scanner, gitleaks, ZAP, MobSF). A integração com a
gestão de riscos da secretaria, a revisão periódica e o treinamento dos
agentes **dependem do controlador**.

## 7. Relatório de impacto (RIPD, art. 38)

| Item | Conteúdo |
|---|---|
| Descrição do tratamento | registro de visita domiciliar por ACS, sem conexão, sincronizado com o servidor da secretaria |
| Dados | identificação (nome, CPF, Cartão SUS, endereço) e saúde (condições, gestação, puericultura, saúde da mulher, situação social, medicamentos em uso e dúvidas) |
| Titulares | moradores da microárea, inclusive crianças e gestantes |
| Riscos principais | aparelho perdido em campo; acesso indevido entre agentes; conta de coordenação comprometida; vazamento por exportação |
| Medidas | grupo 4 e [modelo-de-ameacas.md](modelo-de-ameacas.md) |
| Risco residual | a API do banco ainda aceita sessão sem segundo fator, porque o aplicativo usa a mesma conta; texto livre (queixa, dúvida) pode conter identificação mesmo depois da anonimização do cadastro |
| Parecer | risco residual aceitável para piloto: o painel, que lê o dado de todos, já exige segundo fator; levar o segundo fator ao aplicativo antes de uso em escala |

## 8. Encarregado

Nomeação, divulgação do contato e canal de reclamação **dependem do
controlador**, antes da implantação. O sistema não precisa mudar para isso: o
contato entra no texto de transparência da tela "Mais".
