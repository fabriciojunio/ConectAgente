#!/usr/bin/env bash
# ===========================================================================
# Testes do cadastro publico e da aprovacao no painel
# ===========================================================================
#
# Sobe um PostgreSQL descartavel, aplica o schema e as migracoes, reproduz o
# caminho pelo qual um agente entra no sistema e confere o resultado.
#
# Por que isto existe como teste de banco: o vocabulario de papel estava em
# cinco versoes diferentes e cada arquivo de codigo era coerente consigo
# mesmo. So o CHECK do banco reclamava, e ninguem rodava o CHECK.
#
# Uso:
#   bash rodar-testes-cadastro.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql).
# ===========================================================================

set -uo pipefail

PORTA="${PGTEST_PORTA:-55441}"
PGDATA="${PGTEST_DIR:-/tmp/pgtest-cadastro-conectagente}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"

if command -v initdb >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v initdb)")"
elif [ -d "/c/Program Files/PostgreSQL" ]; then
  # Windows, instalacao padrao do instalador oficial.
  PGBIN="/c/Program Files/PostgreSQL/$(ls -1 '/c/Program Files/PostgreSQL' | sort -rn | head -1)/bin"
elif ls -d /usr/lib/postgresql/*/bin >/dev/null 2>&1; then
  # Debian e Ubuntu, inclusive os runners do GitHub Actions: os binarios de
  # servidor nao entram no PATH, so o cliente.
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
elif [ -d /opt/homebrew/opt/postgresql/bin ]; then
  PGBIN=/opt/homebrew/opt/postgresql/bin
else
  echo "PostgreSQL nao encontrado. Instale o pacote de servidor e tente de novo."
  exit 1
fi

INITDB="$PGBIN/initdb"; PGCTL="$PGBIN/pg_ctl"; PSQL="$PGBIN/psql"
[ -x "$INITDB.exe" ] && { INITDB="$INITDB.exe"; PGCTL="$PGCTL.exe"; PSQL="$PSQL.exe"; }

encerrar() {
  "$PGCTL" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$PGDATA".*.log 2>/dev/null || true
}
trap encerrar EXIT

echo "==> criando cluster temporario em $PGDATA (porta $PORTA)"
rm -rf "$PGDATA"; mkdir -p "$PGDATA"

"$PSQL" --version || { echo "psql nao executa em $PGBIN"; exit 1; }

# A saida do initdb e do pg_ctl nao e descartada de proposito. Quando isto
# roda em integracao continua, o log e a unica coisa que existe para entender
# a falha, e esconder o erro aqui custou uma rodada vermelha sem diagnostico.
if ! "$INITDB" -D "$PGDATA" -U postgres -A trust -E UTF8 --locale=C \
     > "$PGDATA.initdb.log" 2>&1; then
  echo "FALHOU ao criar o cluster:"; tail -20 "$PGDATA.initdb.log"; exit 1
fi

if ! "$PGCTL" -D "$PGDATA" -o "-p $PORTA -c listen_addresses=localhost" \
     -l "$PGDATA/log.txt" -w start > "$PGDATA.pgctl.log" 2>&1; then
  echo "FALHOU ao subir o servidor:"; tail -20 "$PGDATA.pgctl.log"
  [ -f "$PGDATA/log.txt" ] && tail -20 "$PGDATA/log.txt"
  exit 1
fi

# `pg_ctl -w` ja espera, mas em maquina lenta a primeira conexao ainda pode
# chegar antes de o servidor aceitar. Espera ate responder, com teto.
pronto=0
for _ in $(seq 1 30); do
  if "$PSQL" -h localhost -p "$PORTA" -U postgres -d postgres \
       -c "SELECT 1" >/dev/null 2>&1; then pronto=1; break; fi
  sleep 1
done
if [ "$pronto" -ne 1 ]; then
  echo "O servidor subiu mas nao aceitou conexao na porta $PORTA:"
  [ -f "$PGDATA/log.txt" ] && tail -20 "$PGDATA/log.txt"
  exit 1
fi

H="-h localhost -p $PORTA -U postgres"
"$PSQL" $H -q -c "CREATE DATABASE conectagente_cadastro;" >/dev/null 2>&1
D="$H -d conectagente_cadastro -v ON_ERROR_STOP=1 -q"
Q="$H -d conectagente_cadastro -t -A"

echo "==> aplicando schema e migracoes"
for f in \
  "$AQUI/01-stub-supabase.sql" \
  "$RAIZ/ConectAgente-mobile/supabase/schema.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_web.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_registro.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_sync_mobile.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_prontuario_sync.sql"
do
  [ -f "$f" ] || continue
  erro=$("$PSQL" $D -f "$f" 2>&1 | grep -iE "^ERRO|^ERROR" | head -2)
  [ -n "$erro" ] && { echo "FALHOU ao aplicar $(basename "$f"):"; echo "$erro"; exit 1; }
done

ok=0; falhou=0

checar() {
  local nome="$1" esperado="$2" sql="$3"
  local obtido; obtido=$("$PSQL" $Q -c "$sql" 2>&1 | tr -d '\r' | tail -1)
  if [ "$obtido" = "$esperado" ]; then
    printf "  ok    %-50s %s\n" "$nome" "$obtido"; ok=$((ok+1))
  else
    printf "  FALHA %-50s esperado=%s obtido=%s\n" "$nome" "$esperado" "$obtido"; falhou=$((falhou+1))
  fi
}

recusa() {
  local nome="$1" sql="$2"
  local saida; saida=$("$PSQL" $Q -c "$sql" 2>&1 | tr -d '\r')
  if echo "$saida" | grep -qi "violates check constraint"; then
    printf "  ok    %-50s recusado pelo CHECK\n" "$nome"; ok=$((ok+1))
  else
    printf "  FALHA %-50s o banco aceitou valor invalido\n" "$nome"; falhou=$((falhou+1))
  fi
}

echo
echo "==> reproduzindo cadastro e aprovacao"
saida=$("$PSQL" $H -d conectagente_cadastro -v ON_ERROR_STOP=1 -q -f "$AQUI/04-cadastro-aprovacao.sql" 2>&1)
if echo "$saida" | grep -qiE "^ERRO|^ERROR|psql:.*ERROR"; then
  echo "O FLUXO FALHOU. Nenhum agente seria provisionado:"
  echo "$saida" | grep -iE "ERRO|ERROR" | head -5
  falhou=$((falhou+1))
else
  printf "  ok    %-50s sem erro\n" "fluxo inteiro aceito pelo servidor"; ok=$((ok+1))
fi

echo
echo "O CADASTRO E A APROVACAO FUNCIONAM"
checar "tres solicitacoes gravadas"         "3" \
  "SELECT count(*) FROM solicitacoes_registro;"
checar "todas aprovadas"                     "3" \
  "SELECT count(*) FROM solicitacoes_registro WHERE status='aprovado';"
checar "coordenador virou coordenador"       "coordenador" \
  "SELECT role FROM agentes WHERE cpf='52998224725';"
checar "gerente virou gerente"               "gerente" \
  "SELECT role FROM agentes WHERE cpf='15350946056';"
checar "cargo 'outro' virou agente"          "agente" \
  "SELECT role FROM agentes WHERE cpf='28625587887';"

echo
echo "O BANCO RECUSA O VOCABULARIO ANTIGO"
recusa "cargo_pretendido = 'supervisor'" \
  "INSERT INTO solicitacoes_registro (nome,cpf,telefone,area_atuacao,unidade_saude,cargo_pretendido,justificativa) VALUES ('X','00000000191','1','a','b','supervisor','c');"
recusa "agentes.role = 'supervisor'" \
  "INSERT INTO agentes (nome,cpf,email,senha_hash,area_atuacao,unidade_saude,role) VALUES ('X','00000000191','x@y.z','h','a','b','supervisor');"

echo
echo "TODO PAPEL DO CHECK E ACEITO DE FATO"
# Grava e le em consultas separadas. Com RETURNING, o psql imprime o valor e
# em seguida a linha de status do comando, e pegar a ultima linha devolvia
# "INSERT 0 1" em vez do papel.
for papel in agente coordenador gerente admin; do
  "$PSQL" $Q -c "INSERT INTO agentes (nome,cpf,email,senha_hash,area_atuacao,unidade_saude,role) VALUES ('Teste $papel','9$papel','$papel@teste.local','h','a','b','$papel');" >/dev/null 2>&1
  checar "role = '$papel'" "$papel" \
    "SELECT role FROM agentes WHERE email='$papel@teste.local';"
done

echo
echo "======================================================================"
echo "  $ok passaram, $falhou falharam"
echo "======================================================================"
[ "$falhou" -eq 0 ] || exit 1
