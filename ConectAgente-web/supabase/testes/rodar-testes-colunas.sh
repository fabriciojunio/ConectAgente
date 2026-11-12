#!/usr/bin/env bash
# ===========================================================================
# Colunas sensíveis de morador só pela leitura auditada
# ===========================================================================
#
# `fn_ler_morador` registra quem leu a ficha (LGPD, art. 37). Ela só vale se
# a ficha não puder ser lida por outro caminho. Esta suíte prova que:
#
#   cpf, cartão do SUS, doença e medicação não saem por SELECT direto
#   as colunas de lista continuam legíveis, sob RLS
#   o aplicativo continua gravando com upsert e exclusão lógica
#   a busca por documento é exata, respeita o papel e fica registrada
#   conta desativada perde o acesso, e as funções de painel falham fechadas
#
# O banco imita o Supabase de verdade: lá, toda tabela nova nasce com
# permissão total para anon e authenticated, por privilégio padrão. Sem
# imitar isso, o REVOKE da migração passaria no teste sem provar nada.
#
# Uso:
#   bash rodar-testes-colunas.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql). O cluster é
# criado numa pasta temporária, numa porta própria, e destruído no fim.
# ===========================================================================

set -uo pipefail

PORTA="${PGTEST_PORTA:-55438}"
PGDATA="${PGTEST_DIR:-/tmp/pgtest-conectagente-colunas}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"

if command -v initdb >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v initdb)")"
elif [ -d "/c/Program Files/PostgreSQL" ]; then
  PGBIN="/c/Program Files/PostgreSQL/$(ls -1 '/c/Program Files/PostgreSQL' | sort -rn | head -1)/bin"
elif ls -d /usr/lib/postgresql/*/bin >/dev/null 2>&1; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
elif [ -d /opt/homebrew/opt/postgresql/bin ]; then
  PGBIN=/opt/homebrew/opt/postgresql/bin
else
  echo "PostgreSQL não encontrado. Instale o pacote de servidor e tente de novo."
  exit 1
fi

INITDB="$PGBIN/initdb"; PGCTL="$PGBIN/pg_ctl"; PSQL="$PGBIN/psql"
[ -x "$INITDB.exe" ] && { INITDB="$INITDB.exe"; PGCTL="$PGCTL.exe"; PSQL="$PSQL.exe"; }

encerrar() {
  "$PGCTL" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$PGDATA".*.log 2>/dev/null || true
}
trap encerrar EXIT

echo "==> criando cluster temporário em $PGDATA (porta $PORTA)"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) OPCAO_SOCKET="" ;;
  *)                    OPCAO_SOCKET="-c unix_socket_directories=$PGDATA" ;;
esac

rm -rf "$PGDATA"; mkdir -p "$PGDATA"

if ! "$INITDB" -D "$PGDATA" -U postgres -A trust -E UTF8 --locale=C \
     > "$PGDATA.initdb.log" 2>&1; then
  echo "FALHOU ao criar o cluster:"; tail -20 "$PGDATA.initdb.log"; exit 1
fi

if ! "$PGCTL" -D "$PGDATA" -o "-p $PORTA -c listen_addresses=localhost $OPCAO_SOCKET" \
     -l "$PGDATA/log.txt" -w start > "$PGDATA.pgctl.log" 2>&1; then
  echo "FALHOU ao subir o servidor:"; tail -20 "$PGDATA.pgctl.log"
  [ -f "$PGDATA/log.txt" ] && tail -20 "$PGDATA/log.txt"
  exit 1
fi

pronto=0
for _ in $(seq 1 30); do
  if "$PSQL" -h localhost -p "$PORTA" -U postgres -d postgres \
       -c "SELECT 1" >/dev/null 2>&1; then pronto=1; break; fi
  sleep 1
done
if [ "$pronto" -ne 1 ]; then
  echo "O servidor subiu mas não aceitou conexão na porta $PORTA:"
  [ -f "$PGDATA/log.txt" ] && tail -20 "$PGDATA/log.txt"
  exit 1
fi

H="-h localhost -p $PORTA -U postgres"
"$PSQL" $H -q -c "CREATE DATABASE conectagente_colunas;" >/dev/null 2>&1
D="$H -d conectagente_colunas -v ON_ERROR_STOP=1 -q"

echo "==> carregando o schema completo"
# Usa o setup-completo, e não as migrações soltas: é o arquivo que a
# secretaria executa, e a função precisa estar lá dentro para valer.
"$PSQL" $D -f "$AQUI/01-stub-supabase.sql" > "$PGDATA.stub.log" 2>&1 || {
  echo "FALHOU ao carregar o substituto do schema auth:"; tail -5 "$PGDATA.stub.log"; exit 1; }

"$PSQL" $D -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;" >/dev/null

if ! "$PSQL" $D -f "$AQUI/../setup-completo.sql" > "$PGDATA.setup.log" 2>&1; then
  echo "FALHOU ao carregar o setup-completo:"
  grep -iE "ERROR|FATAL" "$PGDATA.setup.log" | tail -5; exit 1
fi

echo "==> a função foi criada pelo arquivo de instalação?"
existe=$("$PSQL" $H -d conectagente_colunas -t -A \
  -c "SELECT COUNT(*) FROM pg_proc WHERE proname = 'fn_buscar_morador_por_documento'" 2>/dev/null | tr -d '\r')
if [ "$existe" != "1" ]; then
  echo "  FALHA  fn_buscar_morador_por_documento nao existe depois do setup-completo"
  exit 1
fi
echo "  ok     fn_buscar_morador_por_documento existe"

echo
echo "==> exercitando as colunas sensiveis"
saida=$( { "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/06-colunas-sensiveis.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/07-conta-ativa.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/08-sem-anonimo.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/09-prontuario-fechado.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/10-medicamentos.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/11-unidades.sql" 2>&1
          "$PSQL" $H -d conectagente_colunas -t -A -v ON_ERROR_STOP=1 \
            -f "$AQUI/12-papel-protegido.sql" 2>&1; } | tr -d '\r')

if echo "$saida" | grep -qiE "^ERRO|^ERROR|psql:.*ERROR"; then
  echo "  FALHA  o arquivo de casos nao rodou:"
  echo "$saida" | grep -iE "ERRO|ERROR" | head -5 | sed 's/^/         /'
  exit 1
fi

ok=0; falhou=0
while IFS='|' read -r nome status; do
  [ -z "$nome" ] && continue
  case "$status" in
    OK)     printf "  ok     %-34s\n" "$nome"; ok=$((ok+1)) ;;
    FALHOU) printf "  FALHA  %-34s\n" "$nome"; falhou=$((falhou+1)) ;;
  esac
done <<< "$(echo "$saida" | grep -E '\|(OK|FALHOU)$')"

echo
if [ "$ok" -eq 0 ]; then
  echo "Nenhuma verificacao rodou. Saida crua:"; echo "$saida" | tail -10; exit 1
fi
if [ "$falhou" -eq 0 ]; then
  echo "TUDO CERTO: $ok verificacoes de colunas sensiveis, conta ativa, acesso anonimo, fichas fechadas, medicamentos e unidades passaram."
  exit 0
fi
echo "$falhou de $((ok + falhou)) verificacoes falharam."
exit 1
