#!/usr/bin/env bash
# ===========================================================================
# Liga o projeto a um Supabase de verdade
# ===========================================================================
#
# Por que este script existe. O aplicativo e o painel funcionam sem servidor,
# e é de propósito: o agente precisa registrar a visita em campo, sem sinal.
# Mas sem credencial nada sincroniza, e o único jeito de saber se a credencial
# está certa era compilar, instalar e tentar usar, que leva meia hora.
#
# Aqui a credencial é conferida contra o servidor antes de qualquer coisa:
#
#   1. o endereço responde
#   2. a chave é aceita
#   3. o schema foi aplicado (a tabela `agentes` existe)
#
# Só depois os arquivos `.env` são escritos.
#
# Uso:
#   bash scripts/configurar-supabase.sh \
#     --url https://xxxxxxxxxxxx.supabase.co \
#     --anon eyJhbGciOi...
#
#   bash scripts/configurar-supabase.sh --url ... --anon ... --service eyJ...
#   bash scripts/configurar-supabase.sh --url ... --anon ... --compilar
#
# A chave de serviço é opcional e vale só para o painel. Ela ignora o RLS por
# definição: não entra no aplicativo, e nunca em variável com prefixo público.
#
# Onde achar os valores: supabase.com, projeto, Settings, API. "Project URL" e
# "anon public".
# ===========================================================================

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

URL=""; ANON=""; SERVICE=""; COMPILAR=0

while [ $# -gt 0 ]; do
  case "$1" in
    --url)      URL="${2:-}"; shift 2 ;;
    --anon)     ANON="${2:-}"; shift 2 ;;
    --service)  SERVICE="${2:-}"; shift 2 ;;
    --compilar) COMPILAR=1; shift ;;
    -h|--help)  sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opção desconhecida: $1"; exit 2 ;;
  esac
done

if [ -z "$URL" ] || [ -z "$ANON" ]; then
  echo "Faltou --url ou --anon. Use --help."
  exit 2
fi

falhar() { echo; echo "PAROU: $1"; echo "Nenhum arquivo foi escrito."; exit 1; }

# ---------------------------------------------------------------------------
# 1. Formato, antes de gastar rede
# ---------------------------------------------------------------------------
echo "==> conferindo o formato"

case "$URL" in
  https://*.supabase.co|https://*.supabase.co/) ;;
  *) falhar "a URL não parece de um projeto Supabase: $URL" ;;
esac

case "$URL" in
  *seu-projeto*|*placeholder*) falhar "a URL ainda é a de exemplo" ;;
esac

# A chave anon é um JWT: três partes separadas por ponto, e passa de 100
# caracteres. O que vem no .env.example tem 39, que é só o cabeçalho.
if [ "${#ANON}" -lt 100 ]; then
  falhar "a chave anon tem ${#ANON} caracteres. A real passa de 100: provavelmente foi copiada pela metade."
fi
case "$ANON" in
  *.*.*) ;;
  *) falhar "a chave anon não tem formato de JWT (esperado cabeçalho.corpo.assinatura)" ;;
esac
if [ -n "$SERVICE" ] && [ "${#SERVICE}" -lt 100 ]; then
  falhar "a chave de serviço parece truncada"
fi
if [ -n "$SERVICE" ] && [ "$SERVICE" = "$ANON" ]; then
  falhar "a chave de serviço é igual à anon. Uma das duas foi copiada do campo errado."
fi

echo "    ok"

# ---------------------------------------------------------------------------
# 2. O servidor responde e aceita a chave
# ---------------------------------------------------------------------------
echo "==> falando com o servidor"

BASE="${URL%/}"
codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "$BASE/rest/v1/" 2>/dev/null)

case "$codigo" in
  000) falhar "não consegui falar com $BASE. Sem internet, ou o endereço está errado." ;;
  401|403) falhar "o servidor respondeu $codigo: a chave anon foi recusada." ;;
  200|404) echo "    o servidor respondeu e aceitou a chave (HTTP $codigo)" ;;
  *) falhar "resposta inesperada do servidor: HTTP $codigo" ;;
esac

# ---------------------------------------------------------------------------
# 3. O schema foi aplicado
# ---------------------------------------------------------------------------
echo "==> conferindo se o banco já tem o schema"

tabela=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  "$BASE/rest/v1/agentes?select=id&limit=1" 2>/dev/null)

case "$tabela" in
  200) echo "    a tabela agentes existe e o RLS deixou consultar" ;;
  401|403)
    # Sem sessão, a policy nega. Isso é o certo: significa que a tabela existe
    # e está protegida. Tabela ausente responderia 404.
    echo "    a tabela agentes existe e está protegida por RLS (HTTP $tabela)" ;;
  404)
    falhar "a tabela agentes não existe. Rode antes o supabase/setup-completo.sql no editor SQL do Supabase." ;;
  *) falhar "resposta inesperada ao procurar a tabela agentes: HTTP $tabela" ;;
esac

# ---------------------------------------------------------------------------
# 4. Escreve os arquivos
# ---------------------------------------------------------------------------
echo "==> escrevendo os .env"

salvar_anterior() {
  [ -f "$1" ] && cp "$1" "$1.anterior" && echo "    guardei o anterior em $(basename "$1").anterior"
}

MOBILE="$RAIZ/ConectAgente-mobile/.env"
salvar_anterior "$MOBILE"
cat > "$MOBILE" <<EOF
# Gerado por scripts/configurar-supabase.sh
# A chave anon é pública por desenho: ela vai dentro do APK. Quem protege o
# dado é o RLS no servidor, com a sessão do Supabase Auth.
EXPO_PUBLIC_SUPABASE_URL=$BASE
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON
EOF
echo "    ConectAgente-mobile/.env"

WEB="$RAIZ/ConectAgente-web/.env.local"
salvar_anterior "$WEB"
{
  echo "# Gerado por scripts/configurar-supabase.sh"
  echo "NEXT_PUBLIC_SUPABASE_URL=$BASE"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON"
  [ -n "$SERVICE" ] && {
    echo "# Ignora o RLS por definição. Nunca com prefixo NEXT_PUBLIC_."
    echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE"
  }
} > "$WEB"
echo "    ConectAgente-web/.env.local"

echo
echo "Pronto. O aplicativo e o painel passam a sincronizar."
echo
echo "Lembretes:"
echo "  - os .env estão no .gitignore e não vão para o repositório"
echo "  - agente criado pelo primeiro acesso do aplicativo não sincroniza:"
echo "    quem cria o usuário no Supabase Auth é a aprovação no painel"

# ---------------------------------------------------------------------------
# 5. Compilar, se pedido
# ---------------------------------------------------------------------------
if [ "$COMPILAR" -eq 1 ]; then
  echo
  echo "==> compilando o APK"
  echo "    Isto leva uns 30 minutos e tem armadilhas de caminho longo no"
  echo "    Windows. As instruções estão em docs/apk.md; o passo manual é"
  echo "    necessário porque o build precisa de uma pasta curta."
  echo
  sed -n '/^## Gerar/,/^---/p' "$RAIZ/docs/apk.md"
fi
