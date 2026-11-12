# 5. Regra que depende de quem grava vai em gatilho, além da policy

Data: 2026-11-12
Situação: aceita

## Contexto

Row Level Security filtra linha, não coluna, e policies permissivas se somam
com OU. Duas falhas reais vieram disso: a própria linha de `agentes` aceitava
mudança de `role` (qualquer conta virava administradora), e policies antigas
`FOR ALL` deixavam o agente gravar visita na família de outro.

## Decisão

Regras de integridade que dependem de quem grava e de qual coluna muda ficam
em gatilho `BEFORE`, que vale qualquer que seja a policy existente ou futura:
`trg_agentes_proteger_campos` (papel, situação e unidade) e
`fn_exigir_familia_propria` (visita, morador e agendamento só na família do
próprio agente). O gatilho roda como quem gravou (`SECURITY INVOKER`) e só se
aplica a chamadas da API; as funções do servidor que já aplicam a própria
regra passam direto.

## Consequências

**O que se ganha.** Defesa em profundidade: uma policy mal escrita no futuro
não reabre a falha, e cada gatilho tem suíte de teste com o ataque.

**O que se perde.** A regra fica em dois lugares (policy e gatilho), e quem
mexer em um precisa olhar o outro. O teste de banco é o que avisa.
