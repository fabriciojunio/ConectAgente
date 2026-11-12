# 1. Monólito com o banco como fronteira de segurança

Data: 2026-11-12
Situação: aceita

## Contexto

O sistema tem um domínio só (acompanhamento das famílias pelos agentes
comunitários de saúde), dois clientes sobre o mesmo dado (o aplicativo de
campo e o painel da coordenação) e uma equipe de uma pessoa. O dado é de
saúde (LGPD, art. 11), e o aplicativo leva dentro do pacote a chave pública
da API: qualquer regra que dependa do cliente se contorna.

## Decisão

Um banco PostgreSQL gerenciado (Supabase) com autenticação, API REST gerada
(PostgREST) e todas as regras de acesso dentro do próprio banco: Row Level
Security em toda tabela, funções `SECURITY DEFINER` para leitura auditada e
gatilhos para as regras que dependem de quem grava. O painel (Next.js) e o
aplicativo (Expo) são clientes, não fronteira de segurança.

Microsserviços foram descartados. A regra da casa é usá-los quando há domínios
independentes, escala distinta ou times distintos, e aqui não há nenhum dos
três. Separar agora traria rede, consistência eventual e operação de vários
processos para proteger um único conjunto de tabelas.

## Consequências

**O que se ganha.** A regra fica num lugar só: o aplicativo, o painel e uma
chamada direta à API passam pela mesma policy. As regras são testadas num
PostgreSQL de verdade (suítes em `ConectAgente-web/supabase/testes`), sem
simulação.

**O que se perde.** Regra em SQL pede disciplina. O pentest de novembro de
2026 achou policies antigas `FOR ALL` que se somavam às novas com OU e
anulavam regras finas. Por isso toda regra nova entra com um caso de teste
que falhava antes, e as que dependem de quem grava viram gatilho (ADR 5).
