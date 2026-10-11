#!/usr/bin/env bash
# ===========================================================================
# Testes de sincronizacao entre o aplicativo e o servidor
# ===========================================================================
#
# Sobe um PostgreSQL descartavel, aplica o schema e todas as migracoes,
# reproduz a jornada completa de um agente com os payloads exatos que o
# aplicativo envia, e confere que o dado chegou.
#
# Por que isto existe como teste de banco e nao como teste de unidade: os
# defeitos que isto pega nao existem em nenhum dos dois lados isoladamente.
# O aplicativo estava coerente consigo mesmo, o servidor tambem. O que estava
# errado era a juncao, e so o banco de verdade reclama. Antes desta suite,
# nenhuma residencia, morador, visita ou prontuario preenchido em campo
# chegava ao painel, e os 276 testes de unidade passavam.
#
# Uso:
#   bash rodar-testes-sync.sh
#
# Requisito: PostgreSQL instalado (usa initdb/pg_ctl/psql).
# Nada toca em banco existente: o cluster e criado numa pasta temporaria,
# numa porta propria, e e destruido no fim.
# ===========================================================================

set -uo pipefail

PORTA="${PGTEST_PORTA:-55435}"
PGDATA="${PGTEST_DIR:-/tmp/pgtest-sync-conectagente}"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"

# Descobre os binarios do Postgres no Windows e no Linux.
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
"$PSQL" $H -q -c "CREATE DATABASE conectagente_sync;" >/dev/null 2>&1
D="$H -d conectagente_sync -v ON_ERROR_STOP=1 -q"
Q="$H -d conectagente_sync -t -A"

echo "==> aplicando schema e migracoes"
"$PSQL" $D -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' >/dev/null 2>&1
for f in \
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
PRONT='b0000000-0000-0000-0000-000000000004'
AGENTE='b0000000-0000-0000-0000-00000000000a'

checar() {
  local nome="$1" esperado="$2" sql="$3"
  local obtido; obtido=$("$PSQL" $Q -c "$sql" 2>&1 | tr -d '\r' | tail -1)
  if [ "$obtido" = "$esperado" ]; then
    printf "  ok    %-52s %s\n" "$nome" "$obtido"; ok=$((ok+1))
  else
    printf "  FALHA %-52s esperado=%s obtido=%s\n" "$nome" "$esperado" "$obtido"; falhou=$((falhou+1))
  fi
}

echo
echo "==> reproduzindo a jornada do agente"
saida=$("$PSQL" $H -d conectagente_sync -v ON_ERROR_STOP=1 -q -f "$AQUI/03-jornada-agente.sql" 2>&1)
if echo "$saida" | grep -qiE "^ERRO|^ERROR|psql:.*ERROR"; then
  echo "A JORNADA FALHOU. O aplicativo nao conseguiria sincronizar:"
  echo "$saida" | grep -iE "ERRO|ERROR" | head -5
  falhou=$((falhou+1))
else
  printf "  ok    %-52s sem erro\n" "jornada inteira aceita pelo servidor"; ok=$((ok+1))
fi

echo
echo "O DADO DE CAMPO CHEGOU (o que antes era recusado)"
checar "visita: pressao arterial"        "150/95" \
  "SELECT pa_visita FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003';"
checar "visita: glicemia"                "118" \
  "SELECT glicemia_visita FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003';"
checar "visita: motivo"                  "Acompanhamento de hipertensao" \
  "SELECT motivo_visita FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003';"
checar "visita: encaminhamento"          "Encaminhada ao clinico geral" \
  "SELECT encaminhamentos FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003';"
checar "visita: assinatura gravada"      "1" \
  "SELECT count(*) FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003' AND assinatura_base64 IS NOT NULL;"
checar "prontuario pai subiu"            "1" \
  "SELECT count(*) FROM prontuarios WHERE id='$PRONT';"
checar "ficha saude: hipertenso"         "t" \
  "SELECT is_hipertenso FROM prontuario_saude WHERE prontuario_id='$PRONT';"
checar "ficha saude: pressao"            "150/95" \
  "SELECT pa_valor FROM prontuario_saude WHERE prontuario_id='$PRONT';"
checar "ficha gestante: semanas"         "22" \
  "SELECT semanas_gestacao FROM prontuario_gestante WHERE prontuario_id='$PRONT';"
checar "ficha gestante: pre-natal em dia" "t" \
  "SELECT pre_natal_em_dia FROM prontuario_gestante WHERE prontuario_id='$PRONT';"
checar "ficha mulher: papanicolau"       "t" \
  "SELECT papanicolau_em_dia FROM prontuario_mulher WHERE prontuario_id='$PRONT';"
checar "ficha puericultura gravada"      "1" \
  "SELECT count(*) FROM prontuario_puericultura WHERE prontuario_id='$PRONT';"
checar "ficha social: vulnerabilidade"   "alto" \
  "SELECT vulnerabilidade_social FROM prontuario_social WHERE prontuario_id='$PRONT';"
checar "ficha social: violencia"         "t" \
  "SELECT violencia_domestica FROM prontuario_social WHERE prontuario_id='$PRONT';"
checar "ficha social: encaminhada"       "t" \
  "SELECT encaminhado_assistente_social FROM prontuario_social WHERE prontuario_id='$PRONT';"

echo
echo "IDENTIFICADOR E IDEMPOTENCIA"
checar "visita ficou com o id do aparelho" "1" \
  "SELECT count(*) FROM visitas WHERE id='b0000000-0000-0000-0000-000000000003';"
checar "agendamento nao duplicou"          "1" \
  "SELECT count(*) FROM agendamentos WHERE agente_id='$AGENTE';"
checar "cancelamento chegou"               "cancelada" \
  "SELECT status FROM agendamentos WHERE id='b0000000-0000-0000-0000-000000000005';"
checar "meta nao duplicou no mesmo mes"    "1" \
  "SELECT count(*) FROM metas_visitas WHERE agente_id='$AGENTE' AND mes=10 AND ano=2026;"
checar "meta guardou o ultimo valor"       "120" \
  "SELECT meta FROM metas_visitas WHERE agente_id='$AGENTE' AND mes=10 AND ano=2026;"

echo
echo "REENVIO: a fila tenta de novo, e nao pode duplicar nada"
"$PSQL" $H -d conectagente_sync -q -f "$AQUI/03-jornada-agente.sql" >/dev/null 2>&1
checar "residencias depois do reenvio"   "1" \
  "SELECT count(*) FROM residencias WHERE agente_id='$AGENTE';"
checar "moradores depois do reenvio"     "1" \
  "SELECT count(*) FROM moradores WHERE agente_id='$AGENTE';"
checar "visitas depois do reenvio"       "1" \
  "SELECT count(*) FROM visitas WHERE agente_id='$AGENTE';"
checar "fichas de saude depois do reenvio" "1" \
  "SELECT count(*) FROM prontuario_saude WHERE prontuario_id='$PRONT';"

echo
echo "CAMPO LOCAL NAO VAZA PARA O SERVIDOR"
checar "residencias nao tem status_sync"  "0" \
  "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='residencias' AND column_name='status_sync';"
checar "sync_status recebeu o default"    "sincronizado" \
  "SELECT sync_status FROM residencias WHERE id='b0000000-0000-0000-0000-000000000001';"

echo
echo "======================================================================"
echo "  $ok passaram, $falhou falharam"
echo "======================================================================"
[ "$falhou" -eq 0 ] || exit 1
