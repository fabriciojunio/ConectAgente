#!/usr/bin/env bash
# ===========================================================================
# Testes de Row Level Security do ConectAgente
# ===========================================================================
#
# Sobe um PostgreSQL descartável, carrega o schema inteiro e tenta invadir o
# banco do jeito que alguém invadiria de verdade: com a chave pública, e com
# um agente legítimo tentando ler o paciente de outro agente.
#
# Por que isto existe como teste e não como conferência manual: RLS quebra em
# silêncio. Uma policy mal escrita não derruba a aplicação, ela só passa a
# devolver dado para quem não devia, e ninguém percebe até alguém de fora
# perceber. A única forma de saber é tentar invadir a cada mudança.
#
# Uso:
#   bash rodar-testes-rls.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql).
# Nada toca em banco existente: o cluster é criado numa pasta temporária,
# numa porta própria, e é destruído no fim.
# ===========================================================================

set -uo pipefail

PORTA="${PGTEST_PORTA:-55433}"
PGDATA="${PGTEST_DIR:-/tmp/pgtest-conectagente}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"

# Descobre os binários do Postgres no Windows e no Linux.
if command -v initdb >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v initdb)")"
elif [ -d "/c/Program Files/PostgreSQL" ]; then
  # Windows, instalação padrão do instalador oficial.
  PGBIN="/c/Program Files/PostgreSQL/$(ls -1 '/c/Program Files/PostgreSQL' | sort -rn | head -1)/bin"
elif ls -d /usr/lib/postgresql/*/bin >/dev/null 2>&1; then
  # Debian e Ubuntu, inclusive os runners do GitHub Actions: os binários de
  # servidor não entram no PATH, só o cliente.
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
# No Linux, o PostgreSQL cria o socket em /var/run/postgresql, onde o usuario
# comum nao escreve. Nos runners do GitHub isso derruba o servidor com
#
#   FATAL: could not create lock file "/var/run/postgresql/.s.PGSQL.NNNNN.lock":
#          Permission denied
#
# Apontar o socket para o proprio diretorio de dados resolve. No Windows nao
# ha socket Unix, e o caminho aqui e do MSYS (/c/tmp/...), que o PostgreSQL do
# Windows nao entende: passar a opcao la derruba o servidor tambem. Por isso a
# opcao so entra fora do Windows.
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) OPCAO_SOCKET="" ;;
  *)                    OPCAO_SOCKET="-c unix_socket_directories=$PGDATA" ;;
esac

rm -rf "$PGDATA"; mkdir -p "$PGDATA"

"$PSQL" --version || { echo "psql nao executa em $PGBIN"; exit 1; }

# A saida do initdb e do pg_ctl nao e descartada de proposito. Quando isto
# roda em integracao continua, o log e a unica coisa que existe para entender
# a falha, e esconder o erro aqui custou uma rodada vermelha sem diagnostico.
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
"$PSQL" $H -q -c "CREATE DATABASE conectagente_teste;" >/dev/null 2>&1
D="$H -d conectagente_teste -v ON_ERROR_STOP=1 -q"
Q="$H -d conectagente_teste -t -A"

echo "==> carregando schema e migrações"
for f in \
  "$AQUI/01-stub-supabase.sql" \
  "$RAIZ/ConectAgente-mobile/supabase/schema.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_web.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_registro.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_risco.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_sync_mobile.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_prontuario_sync.sql" \
  "$AQUI/02-cenario.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_rls_completo.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_sem_anonimo.sql"
do
  erro=$("$PSQL" $D -f "$f" 2>&1 | grep -iE "^ERRO|^ERROR" | head -2)
  [ -n "$erro" ] && { echo "FALHOU ao carregar $(basename "$f"):"; echo "$erro"; exit 1; }
done

ok=0; falhou=0
ANA='11111111-1111-1111-1111-111111111111'
BRUNO='22222222-2222-2222-2222-222222222222'
CARLA='33333333-3333-3333-3333-333333333333'
DAVI='44444444-4444-4444-4444-444444444444'
PRONT_ANA='aaaaaaaa-3333-0000-0000-000000000001'
PRONT_BRUNO='bbbbbbbb-4444-0000-0000-000000000002'

checar() {
  local nome="$1" esperado="$2" sql="$3"
  local obtido; obtido=$("$PSQL" $Q -c "$sql" 2>&1 | tail -1)
  if [ "$obtido" = "$esperado" ]; then
    printf "  ok    %-46s %s\n" "$nome" "$obtido"; ok=$((ok+1))
  else
    printf "  FALHA %-46s esperado=%s obtido=%s\n" "$nome" "$esperado" "$obtido"; falhou=$((falhou+1))
  fi
}
# Desde migration_sem_anonimo o visitante nem chega ao RLS: o banco recusa
# antes, por falta de privilégio na tabela. Contar 0 linhas não provaria isso.
checar_recusa() {
  local nome="$1" sql="$2"
  local obtido; obtido=$("$PSQL" $Q -c "$sql" 2>&1 | tail -1)
  case "$obtido" in
    *"permission denied"*|*"permissão negada"*)
      printf "  ok    %-46s %s\n" "$nome" "recusado"; ok=$((ok+1)) ;;
    *)
      printf "  FALHA %-46s esperado=recusado obtido=%s\n" "$nome" "$obtido"; falhou=$((falhou+1)) ;;
  esac
}
como_anon()  { echo "SET ROLE anon; $1"; }
como()       { echo "SET ROLE authenticated; SET request.jwt.claim.sub='$1'; $2"; }

echo
echo "ATAQUES (visitante recusado; usuário logado vê 0)"
checar_recusa "visitante lê prontuário de saúde"    "$(como_anon 'SELECT count(*) FROM prontuario_saude;')"
checar_recusa "visitante lê prontuário de gestante" "$(como_anon 'SELECT count(*) FROM prontuario_gestante;')"
checar_recusa "visitante lê puericultura"           "$(como_anon 'SELECT count(*) FROM prontuario_puericultura;')"
checar_recusa "visitante lê saúde da mulher"        "$(como_anon 'SELECT count(*) FROM prontuario_mulher;')"
checar_recusa "visitante lê dados sociais"          "$(como_anon 'SELECT count(*) FROM prontuario_social;')"
checar_recusa "visitante lê agentes e CPF"          "$(como_anon 'SELECT count(*) FROM agentes;')"
checar_recusa "visitante lê trilha de auditoria"    "$(como_anon 'SELECT count(*) FROM audit_log;')"
checar_recusa "visitante apaga visitas"             "$(como_anon 'DELETE FROM visitas;')"
checar "agente lê paciente de outro agente" 0 "$(como $BRUNO "SELECT count(*) FROM prontuario_saude WHERE prontuario_id='$PRONT_ANA';")"
checar "coordenador lê outra unidade"       0 "$(como $CARLA "SELECT count(*) FROM prontuario_saude WHERE prontuario_id='$PRONT_BRUNO';")"

echo
echo "ACESSO LEGÍTIMO (não pode quebrar)"
checar "agente lê o próprio paciente"       1 "$(como $ANA "SELECT count(*) FROM prontuario_saude WHERE prontuario_id='$PRONT_ANA';")"
checar "coordenador lê a própria unidade"   1 "$(como $CARLA "SELECT count(*) FROM prontuario_saude WHERE prontuario_id='$PRONT_ANA';")"
checar "gerente lê os dois pacientes"       2 "$(como $DAVI 'SELECT count(*) FROM prontuario_saude;')"
checar "agente lê as próprias residências"  1 "$(como $ANA 'SELECT count(*) FROM residencias;')"
checar "agente lê os próprios moradores"    1 "$(como $ANA 'SELECT count(*) FROM moradores;')"
checar "agente lê os próprios prontuários"  1 "$(como $ANA 'SELECT count(*) FROM prontuarios;')"
checar "gerente lê todas as residências"    2 "$(como $DAVI 'SELECT count(*) FROM residencias;')"
checar "gerente vê todos os agentes"        4 "$(como $DAVI 'SELECT count(*) FROM agentes;')"
checar "coordenador vê só a própria UBS"    2 "$(como $CARLA 'SELECT count(*) FROM agentes;')"
checar "agente vê o próprio cadastro"       1 "$(como $ANA 'SELECT count(*) FROM agentes;')"

echo
echo "CREDENCIAL E AUDITORIA"
r=$("$PSQL" $Q -c "$(como $ANA 'SELECT senha_hash FROM agentes;')" 2>&1 | tail -1)
case "$r" in
  *"permission denied"*) printf "  ok    %-46s bloqueado\n" "hash de senha é ilegível pelo cliente"; ok=$((ok+1));;
  *) printf "  FALHA %-46s vazou: %s\n" "hash de senha é ilegível pelo cliente" "$r"; falhou=$((falhou+1));;
esac
r=$("$PSQL" $Q -c "$(como $BRUNO 'DELETE FROM audit_log;')" 2>&1 | tail -1)
case "$r" in
  *"permission denied"*) printf "  ok    %-46s bloqueado\n" "agente não apaga a auditoria"; ok=$((ok+1));;
  *) printf "  FALHA %-46s permitiu: %s\n" "agente não apaga a auditoria" "$r"; falhou=$((falhou+1));;
esac

echo
echo "COBERTURA: nenhuma tabela pode ficar sem RLS ou sem policy"
sem_protecao=$("$PSQL" $Q -c "
  SELECT COALESCE(string_agg(t.relname, ', '), '')
  FROM (
    SELECT c.relname, c.relrowsecurity, count(p.polname) AS n
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE ns.nspname='public' AND c.relkind='r'
    GROUP BY c.relname, c.relrowsecurity
  ) t
  WHERE t.relrowsecurity = false OR t.n = 0;" 2>&1 | tail -1)
if [ -z "$sem_protecao" ]; then
  printf "  ok    %-46s todas protegidas\n" "varredura do schema"; ok=$((ok+1))
else
  printf "  FALHA %-46s %s\n" "tabelas desprotegidas" "$sem_protecao"; falhou=$((falhou+1))
fi

echo
echo "======================================================================"
echo "  $ok passaram, $falhou falharam"
echo "======================================================================"
[ "$falhou" -eq 0 ] || exit 1
