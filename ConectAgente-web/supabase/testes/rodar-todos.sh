#!/usr/bin/env bash
# ===========================================================================
# Roda as suites que exercitam o banco de verdade
# ===========================================================================
#
# Cada uma sobe um PostgreSQL descartavel numa porta propria, aplica o schema
# e as migracoes, exercita um caminho real e se autodestroi. Nada toca em
# banco existente.
#
#   rodar-testes-rls.sh        quem pode ler e gravar o que
#   rodar-testes-sync.sh       o dado coletado em campo chega ao servidor
#   rodar-testes-cadastro.sh   um agente consegue entrar no sistema
#   rodar-testes-idempotencia.sh  o arquivo de instalacao aguenta rodar 2x
#   rodar-testes-leitura.sh    abrir ficha de paciente deixa rastro
#   rodar-testes-colunas.sh    leitura auditada, unidades e papel que a conta não muda sozinha
#
# Por que existem fora do Jest. Os tres defeitos mais graves do projeto nao
# apareciam em teste de unidade, porque cada lado estava coerente consigo
# mesmo e o erro morava na juncao: sete tabelas sem RLS, 61 colunas que o
# aplicativo gravava e o servidor nao tinha, e cinco vocabularios diferentes
# para o campo de papel. So o banco de verdade reclama dessas coisas.
#
# Uso:
#   bash rodar-todos.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql).
# ===========================================================================

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SUITES=(
  "rodar-testes-rls.sh:permissao de leitura e escrita"
  "rodar-testes-sync.sh:sincronizacao do aplicativo com o servidor"
  "rodar-testes-cadastro.sh:cadastro publico e aprovacao"
  "rodar-testes-idempotencia.sh:instalacao executada mais de uma vez"
  "rodar-testes-leitura.sh:leitura de ficha registrada na trilha"
  "rodar-testes-colunas.sh:colunas sensiveis, unidades e protecao de papel"
)

falhas=0
resumo=()

for entrada in "${SUITES[@]}"; do
  arquivo="${entrada%%:*}"
  descricao="${entrada#*:}"

  echo
  echo "######################################################################"
  echo "# $descricao"
  echo "######################################################################"

  if bash "$AQUI/$arquivo"; then
    resumo+=("  ok     $descricao")
  else
    resumo+=("  FALHOU $descricao")
    falhas=$((falhas+1))
  fi
done

echo
echo "######################################################################"
echo "# RESULTADO"
echo "######################################################################"
printf '%s\n' "${resumo[@]}"
echo

if [ "$falhas" -eq 0 ]; then
  # Conta pelo tamanho do vetor: ja ficou escrito "tres" com quatro
  # suites na lista, e numero errado em saida de teste tira a
  # confianca do resto.
  echo "As ${#SUITES[@]} suites passaram."
  exit 0
fi

echo "$falhas suite(s) falharam."
exit 1
