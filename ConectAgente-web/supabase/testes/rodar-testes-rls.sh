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
  PGBIN="/c/Program Files/PostgreSQL/$(ls -1 '/c/Program Files/PostgreSQL' | sort -rn | head -1)/bin"
else
  echo "PostgreSQL não encontrado. Instale o pacote de servidor e tente de novo."
  exit 1
fi

INITDB="$PGBIN/initdb"; PGCTL="$PGBIN/pg_ctl"; PSQL="$PGBIN/psql"
[ -x "$INITDB.exe" ] && { INITDB="$INITDB.exe"; PGCTL="$PGCTL.exe"; PSQL="$PSQL.exe"; }

encerrar() {
  "$PGCTL" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$PGDATA" 2>/dev/null || true
}
trap encerrar EXIT

echo "==> criando cluster temporário em $PGDATA (porta $PORTA)"
rm -rf "$PGDATA"; mkdir -p "$PGDATA"
"$INITDB" -D "$PGDATA" -U postgres -A trust -E UTF8 --locale=C >/dev/null 2>&1
"$PGCTL" -D "$PGDATA" -o "-p $PORTA -c listen_addresses=localhost" \
         -l "$PGDATA/log.txt" start >/dev/null 2>&1
sleep 3

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
  "$RAIZ/ConectAgente-web/supabase/migration_sync_mobile.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_prontuario_sync.sql" \
  "$AQUI/02-cenario.sql" \
  "$RAIZ/ConectAgente-web/supabase/migration_rls_completo.sql"
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
como_anon()  { echo "SET ROLE anon; $1"; }
como()       { echo "SET ROLE authenticated; SET request.jwt.claim.sub='$1'; $2"; }

echo
echo "ATAQUES (todos devem devolver 0)"
checar "visitante lê prontuário de saúde"   0 "$(como_anon 'SELECT count(*) FROM prontuario_saude;')"
checar "visitante lê prontuário de gestante" 0 "$(como_anon 'SELECT count(*) FROM prontuario_gestante;')"
checar "visitante lê puericultura"          0 "$(como_anon 'SELECT count(*) FROM prontuario_puericultura;')"
checar "visitante lê saúde da mulher"       0 "$(como_anon 'SELECT count(*) FROM prontuario_mulher;')"
checar "visitante lê dados sociais"         0 "$(como_anon 'SELECT count(*) FROM prontuario_social;')"
checar "visitante lê agentes e CPF"         0 "$(como_anon 'SELECT count(*) FROM agentes;')"
checar "visitante lê trilha de auditoria"   0 "$(como_anon 'SELECT count(*) FROM audit_log;')"
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
