# 4. A unidade de saúde é o escopo da coordenação

Data: 2026-11-12
Situação: aceita

## Contexto

Cada coordenação cuida de uma equipe e de um território. A unidade era texto
livre digitado em cada cadastro, então "UBS Centro" e "UBS centro" viravam
duas áreas, e a coordenação recém-criada nascia com a unidade vazia.

## Decisão

Catálogo de unidades (`unidades_saude`), legível só por conta ativa e gravado
só por duas funções: a coordenação sem unidade escolhe uma ou cria a sua, uma
vez; depois, só a gerência troca ou designa, e a linha de administrador só
outro administrador altera. Conta sem unidade guarda `NULL`, nunca texto
vazio: `NULL` não é igual a nada, então nenhuma policy casa uma conta sem área
com outra. Toda escolha e designação vai para a trilha.

## Consequências

**O que se ganha.** A coordenação não se muda sozinha para outra unidade para
ler pacientes de lá, e o filtro do painel vira lista em vez de campo de digitar.

**O que se perde.** A troca de área passa pela gerência: é o desejado, mas é
um passo a mais no dia a dia.
