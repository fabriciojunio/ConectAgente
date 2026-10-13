#!/usr/bin/env bash
# ===========================================================================
# O setup-completo.sql precisa aguentar rodar duas vezes
# ===========================================================================
#
# Por que isto importa. O setup-completo.sql é o arquivo que a secretaria vai
# colar no editor do Supabase. Quem instala não roda uma vez só: roda, vê um
# aviso, mexe numa linha, roda de novo. Se a segunda execução falhar no meio,
# o banco fica num estado parcial, e a pessoa não tem como saber o que entrou
# e o que não entrou.
#
# E falhava. Medido num PostgreSQL limpo, a segunda execução parava em:
#
#   ERROR: policy "agente_residencias" for table "residencias" already exists
#
# Seis policies eram criadas sem o DROP IF EXISTS que as outras 52 tinham.
#
# Este teste roda o arquivo duas vezes e, além de exigir que as duas passem,
# compara a contagem de objetos entre elas: idempotente de verdade é terminar
# com o mesmo banco, e não só não dar erro.
#
# Uso:
#   bash rodar-testes-idempotencia.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql). Nada toca em banco
# existente: o cluster é criado numa pasta temporária, numa porta própria, e é
# destruído no fim.
# ===========================================================================

set -uo pipefail

PORTA="${PGTEST_PORTA:-55436}"
PGDATA="${PGTEST_DIR:-/tmp/pgtest-conectagente-idem}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP="$AQUI/../setup-completo.sql"

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
"$PSQL" $H -q -c "CREATE DATABASE conectagente_idem;" >/dev/null 2>&1
D="$H -d conectagente_idem -v ON_ERROR_STOP=1 -q"
Q="$H -d conectagente_idem -t -A"

contar() {
  "$PSQL" $Q -c "
    SELECT
      (SELECT count(*) FROM pg_tables  WHERE schemaname = 'public') || ' tabelas, ' ||
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') || ' policies, ' ||
      (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') || ' indices, ' ||
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public') || ' funcoes'
  " 2>/dev/null | tr -d '\r'
}

falhas=0

# O arquivo usa `auth.uid()` e `auth.users`, que no Supabase já existem e num
# PostgreSQL limpo não. O mesmo substituto que as outras suítes usam entra
# antes, senão a primeira execução para na linha 316 e o teste mede a ausência
# do Supabase em vez de medir a idempotência.
echo "==> carregando o substituto do schema auth"
"$PSQL" $D -f "$AQUI/01-stub-supabase.sql" > "$PGDATA.stub.log" 2>&1 || {
  echo "    FALHOU ao carregar o substituto:"; tail -5 "$PGDATA.stub.log"; exit 1; }

echo "==> primeira execução do setup-completo.sql"
if "$PSQL" $D -f "$SETUP" > "$PGDATA.run1.log" 2>&1; then
  echo "    ok"
else
  echo "    FALHOU. Últimas linhas:"
  grep -iE "ERROR|FATAL" "$PGDATA.run1.log" | tail -5 | sed 's/^/      /'
  falhas=$((falhas + 1))
fi
depois_1="$(contar)"
echo "    estado: $depois_1"

echo "==> segunda execução, no banco que a primeira deixou"
if "$PSQL" $D -f "$SETUP" > "$PGDATA.run2.log" 2>&1; then
  echo "    ok"
else
  echo "    FALHOU. O arquivo não é idempotente:"
  grep -iE "ERROR|FATAL" "$PGDATA.run2.log" | tail -5 | sed 's/^/      /'
  falhas=$((falhas + 1))
fi
depois_2="$(contar)"
echo "    estado: $depois_2"

echo "==> o banco terminou igual nas duas?"
if [ "$depois_1" = "$depois_2" ]; then
  echo "    ok, mesmo número de objetos"
else
  echo "    DIFERENTE. Rodar de novo mudou o banco:"
  echo "      depois da 1a: $depois_1"
  echo "      depois da 2a: $depois_2"
  falhas=$((falhas + 1))
fi

echo
if [ "$falhas" -eq 0 ]; then
  echo "TUDO CERTO: o setup-completo.sql pode ser executado mais de uma vez."
  exit 0
fi
echo "$falhas verificação(ões) falharam."
exit 1
