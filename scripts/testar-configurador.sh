#!/usr/bin/env bash
# ===========================================================================
# Testes do configurador do Supabase
# ===========================================================================
#
# O que importa aqui não é o caminho feliz, que depende de uma credencial que
# só a secretaria tem. É o contrário: que o script **recuse** e **não escreva
# nada** quando a credencial está errada.
#
# A razão é concreta. Um `.env` meio preenchido não quebra o aplicativo: ele
# sobe, as telas aparecem, e a sincronização falha em silêncio. O agente
# conclui que está sem sinal. Escrever um arquivo com valor errado é pior que
# não escrever nenhum.
#
# Uso:
#   bash scripts/testar-configurador.sh
# ===========================================================================

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/.." && pwd)"
SCRIPT="$AQUI/configurar-supabase.sh"

JWT_PLAUSIVEL="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$(printf 'a%.0s' $(seq 1 120)).assinatura"

# O formato novo do Supabase, com 46 caracteres. Projeto criado depois da
# mudanca sai so com ele, e exigir 100 caracteres recusava chave boa.
PUBLICAVEL="sb_publishable_ExemploDeChaveParaTeste_000000"
SECRETA="sb_secret_ExemploDeChaveParaTeste_000000"

ok=0; falhou=0

# Guarda o estado dos arquivos antes, para provar que nenhum foi tocado.
assinatura_dos_env() {
  local saida=""
  for f in "$RAIZ/ConectAgente-mobile/.env" "$RAIZ/ConectAgente-web/.env.local"; do
    if [ -f "$f" ]; then
      saida="$saida$(wc -c < "$f" | tr -d ' ')|"
    else
      saida="${saida}ausente|"
    fi
  done
  echo "$saida"
}

ANTES="$(assinatura_dos_env)"

recusa() {
  local nome="$1"; shift
  local saida; saida=$(bash "$SCRIPT" "$@" 2>&1)
  local codigo=$?

  if [ "$codigo" -eq 0 ]; then
    printf "  FALHA  %-42s aceitou o que devia recusar\n" "$nome"
    falhou=$((falhou + 1)); return
  fi
  if [ "$(assinatura_dos_env)" != "$ANTES" ]; then
    printf "  FALHA  %-42s escreveu arquivo mesmo recusando\n" "$nome"
    falhou=$((falhou + 1)); return
  fi
  printf "  ok     %-42s %s\n" "$nome" "$(echo "$saida" | grep -m1 -E '^PAROU|^Faltou' | cut -c1-60)"
  ok=$((ok + 1))
}

echo "==> o configurador recusa credencial errada"

recusa "sem argumentos"
recusa "so a URL"               --url https://abcdefghijkl.supabase.co
recusa "URL de exemplo"         --url https://seu-projeto.supabase.co --anon "$JWT_PLAUSIVEL"
recusa "URL com placeholder"    --url https://placeholder.supabase.co --anon "$JWT_PLAUSIVEL"
recusa "URL que nao e supabase" --url https://exemplo.com             --anon "$JWT_PLAUSIVEL"
recusa "chave truncada"         --url https://abcdefghijkl.supabase.co --anon "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
recusa "chave sem formato JWT"  --url https://abcdefghijkl.supabase.co --anon "$(printf 'x%.0s' $(seq 1 150))"
recusa "servico igual a anon"   --url https://abcdefghijkl.supabase.co --anon "$JWT_PLAUSIVEL" --service "$JWT_PLAUSIVEL"
recusa "servico truncado"       --url https://abcdefghijkl.supabase.co --anon "$JWT_PLAUSIVEL" --service "eyJabc"
recusa "secreta no lugar da publicavel" --url https://abcdefghijkl.supabase.co --anon "$SECRETA"
recusa "publicavel no lugar da secreta" --url https://abcdefghijkl.supabase.co --anon "$PUBLICAVEL" --service "$PUBLICAVEL"
recusa "prefixo novo sem nada depois"   --url https://abcdefghijkl.supabase.co --anon "sb_publishable_"

echo
echo "==> projeto que nao existe (usa rede)"
recusa "endereco inexistente"   --url https://zzzznaoexistezzzz.supabase.co --anon "$JWT_PLAUSIVEL"
# O formato novo passa pela conferencia de formato e so para na rede, que e o
# que prova que ele nao e mais recusado por tamanho.
recusa "formato novo chega ate a rede" --url https://zzzznaoexistezzzz.supabase.co --anon "$PUBLICAVEL"

echo
echo "==> a ajuda funciona sem argumentos de credencial"
if bash "$SCRIPT" --help 2>&1 | grep -q "Uso:"; then
  printf "  ok     %-42s\n" "--help explica o uso"; ok=$((ok + 1))
else
  printf "  FALHA  %-42s\n" "--help nao explica o uso"; falhou=$((falhou + 1))
fi

echo
if [ "$falhou" -eq 0 ]; then
  echo "TUDO CERTO: $ok verificacoes do configurador passaram."
  exit 0
fi
echo "$falhou de $((ok + falhou)) verificacoes falharam."
exit 1
