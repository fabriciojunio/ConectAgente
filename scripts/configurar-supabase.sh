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

# O Supabase tem dois formatos de chave em circulação, e os dois valem.
#
# O antigo é um JWT: `eyJ...` em três partes separadas por ponto, passando de
# 100 caracteres. O `.env.example` traz só o cabeçalho dele, com 39.
#
# O novo começa com `sb_publishable_` (pública) ou `sb_secret_` (secreta), e
# tem 46 caracteres. Projeto criado depois da mudança sai só com ele. Exigir
# 100 caracteres, como estava aqui, recusava chave boa e mandava a pessoa
# procurar erro onde não havia.
#
# O formato novo é melhor numa coisa: as duas se distinguem à vista. No
# formato antigo a `anon` e a `service_role` eram dois JWTs parecidos, e
# trocar uma pela outra só aparecia em produção, com o RLS ignorado.
publica_valida() {
  case "$1" in
    sb_secret_*) return 1 ;;
    sb_publishable_?*) return 0 ;;
    *.*.*) [ "${#1}" -ge 100 ] && return 0 || return 1 ;;
    *) return 1 ;;
  esac
}

secreta_valida() {
  case "$1" in
    sb_publishable_*) return 1 ;;
    sb_secret_?*) return 0 ;;
    *.*.*) [ "${#1}" -ge 100 ] && return 0 || return 1 ;;
    *) return 1 ;;
  esac
}

if ! publica_valida "$ANON"; then
  case "$ANON" in
    sb_secret_*)
      falhar "isso é a chave SECRETA. Ela ignora o RLS e iria dentro do APK. A publicável está em Settings, API, campo sb_publishable." ;;
    *)
      falhar "a chave não tem formato de chave publicável: esperado sb_publishable_... ou um JWT de três partes com mais de 100 caracteres. Esta tem ${#ANON}." ;;
  esac
fi

if [ -n "$SERVICE" ] && ! secreta_valida "$SERVICE"; then
  falhar "a chave de serviço não tem formato de chave secreta: esperado sb_secret_... ou um JWT de três partes"
fi
if [ -n "$SERVICE" ] && [ "$SERVICE" = "$ANON" ]; then
  falhar "a chave de serviço é igual à publicável. Uma das duas foi copiada do campo errado."
fi

echo "    ok"

# ---------------------------------------------------------------------------
# 2. O servidor responde, aceita a chave, e o schema está aplicado
# ---------------------------------------------------------------------------
#
# Uma requisição só responde as três perguntas, e é na tabela `agentes`, não na
# raiz do REST.
#
# A raiz recusa chave publicável de propósito:
#
#   {"message":"Secret API key required",
#    "hint":"Only secret API keys can be used for this endpoint."}
#
# A primeira versão deste script sondava a raiz, e por isso recusava toda chave
# no formato novo dizendo que o servidor a tinha rejeitado. A chave estava
# certa; a pergunta é que estava errada. Custou uma rodada de "a credencial não
# funciona" com uma credencial que funcionava.
echo "==> falando com o servidor"

BASE="${URL%/}"
resposta=$(curl -s -w '
%{http_code}' --max-time 45   -H "apikey: $ANON" -H "Authorization: Bearer $ANON"   "$BASE/rest/v1/agentes?select=id&limit=1" 2>/dev/null)

codigo="${resposta##*$'
'}"
corpo="${resposta%$'
'*}"

case "$codigo" in
  000)
    falhar "não consegui falar com $BASE. Sem internet, ou o endereço está errado." ;;
  200)
    echo "    o servidor respondeu, a chave foi aceita e a tabela agentes existe" ;;
  401|403)
    # Sem sessão o RLS nega, e negar prova que a tabela existe e está
    # protegida. Mas 401 também é o que volta com chave errada, então o corpo
    # da resposta é que separa os dois casos.
    case "$corpo" in
      *"API key"*|*"apikey"*|*"JWT"*)
        falhar "o servidor recusou a chave (HTTP $codigo): $corpo" ;;
      *)
        echo "    a tabela agentes existe e está protegida por RLS (HTTP $codigo)" ;;
    esac ;;
  404)
    case "$corpo" in
      *PGRST205*|*"Could not find the table"*)
        falhar "a chave funciona, mas o banco está vazio. Rode antes o ConectAgente-web/supabase/setup-completo.sql no editor SQL do Supabase." ;;
      *)
        falhar "o servidor respondeu 404: $corpo" ;;
    esac ;;
  503)
    falhar "o projeto ainda está subindo (HTTP 503). Espere um minuto e tente de novo." ;;
  *)
    falhar "resposta inesperada do servidor: HTTP $codigo. $corpo" ;;
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
