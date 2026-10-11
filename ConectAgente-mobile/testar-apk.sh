#!/usr/bin/env bash
# ===========================================================================
# Testa o APK num emulador de verdade
# ===========================================================================
#
# Sobe o emulador, instala o APK, abre o aplicativo e confere, com evidência,
# que ele não quebra: lê o logcat procurando exceção fatal e tira uma captura
# de tela de cada etapa.
#
# Por que isto existe. "O aplicativo compila" e "o aplicativo abre" são coisas
# diferentes, e a segunda é a que importa. Erro de módulo nativo faltando, de
# variável de ambiente ausente ou de migração de banco só aparece quando o
# processo sobe no aparelho.
#
# Uso:
#   bash testar-apk.sh
#
# Requisitos: Android SDK com um AVD chamado `celular`, e o APK já compilado.
# ===========================================================================

set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SDK="${ANDROID_HOME:-/c/Users/junio/AppData/Local/Android/Sdk}"
ADB="$SDK/platform-tools/adb.exe"
EMULADOR="$SDK/emulator/emulator.exe"
AVD="${AVD_NOME:-celular}"
APK="$AQUI/android/app/build/outputs/apk/release/app-release.apk"
PACOTE="com.conectagente.app"
SAIDA="$AQUI/evidencias-apk"

ok=0; falhou=0

checar() {
  local nome="$1" condicao="$2"
  if eval "$condicao" >/dev/null 2>&1; then
    printf "  ok    %s\n" "$nome"; ok=$((ok+1))
  else
    printf "  FALHA %s\n" "$nome"; falhou=$((falhou+1))
  fi
}

capturar() {
  local nome="$1"
  "$ADB" shell screencap -p /sdcard/captura.png >/dev/null 2>&1
  "$ADB" pull /sdcard/captura.png "$SAIDA/$nome.png" >/dev/null 2>&1
  "$ADB" shell rm /sdcard/captura.png >/dev/null 2>&1
}

mkdir -p "$SAIDA"
rm -f "$SAIDA"/*.png "$SAIDA"/*.txt 2>/dev/null

echo "==> conferindo o APK"
if [ ! -f "$APK" ]; then
  echo "APK não encontrado em $APK"
  echo "Compile antes:  cd android && ./gradlew assembleRelease"
  exit 1
fi
echo "    $(du -h "$APK" | cut -f1)  $APK"

echo
echo "==> subindo o emulador $AVD"
if "$ADB" devices | grep -q "emulator.*device"; then
  echo "    já havia um emulador rodando"
else
  "$EMULADOR" -avd "$AVD" -no-snapshot-load -no-boot-anim >/dev/null 2>&1 &
  echo "    aguardando o boot, isto leva alguns minutos"
fi

"$ADB" wait-for-device
# `wait-for-device` só espera o adb responder. O sistema ainda não terminou de
# subir, e instalar antes disso falha com INSTALL_FAILED_* sem explicação.
pronto=0
for _ in $(seq 1 180); do
  if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
    pronto=1; break
  fi
  sleep 2
done
if [ "$pronto" -ne 1 ]; then
  echo "O emulador não terminou de subir em 6 minutos."
  exit 1
fi
echo "    emulador pronto: $("$ADB" shell getprop ro.build.version.release | tr -d '\r')"

echo
echo "==> instalando"
"$ADB" uninstall "$PACOTE" >/dev/null 2>&1
saida_install=$("$ADB" install -r "$APK" 2>&1)
if echo "$saida_install" | grep -qi "Success"; then
  printf "  ok    instalação concluída\n"; ok=$((ok+1))
else
  printf "  FALHA instalação: %s\n" "$(echo "$saida_install" | tail -2)"; falhou=$((falhou+1))
  exit 1
fi

echo
echo "==> abrindo o aplicativo"
"$ADB" logcat -c
"$ADB" shell monkey -p "$PACOTE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12

"$ADB" logcat -d > "$SAIDA/logcat-abertura.txt" 2>&1
capturar "01-abertura"

echo
echo "O APLICATIVO SOBE E FICA DE PÉ"
checar "o processo está vivo" \
  "\"$ADB\" shell pidof $PACOTE | grep -q ."
checar "nenhuma exceção fatal no logcat" \
  "! grep -qE 'FATAL EXCEPTION|AndroidRuntime: Process: $PACOTE' '$SAIDA/logcat-abertura.txt'"
checar "o aplicativo está em primeiro plano" \
  "\"$ADB\" shell dumpsys window 2>/dev/null | grep -qi '$PACOTE'"
checar "a captura de tela foi gravada" \
  "[ -s '$SAIDA/01-abertura.png' ]"

echo
echo "O BANCO LOCAL FOI CRIADO"
sleep 3
checar "o arquivo do SQLite existe" \
  "\"$ADB\" shell run-as $PACOTE ls databases 2>/dev/null | grep -qi conectagente || \"$ADB\" shell ls /data/data/$PACOTE/databases 2>/dev/null | grep -qi conectagente"

echo
echo "AGUENTA SER FECHADO E REABERTO"
"$ADB" shell am force-stop "$PACOTE"
sleep 2
"$ADB" logcat -c
"$ADB" shell monkey -p "$PACOTE" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 10
"$ADB" logcat -d > "$SAIDA/logcat-reabertura.txt" 2>&1
capturar "02-reabertura"

checar "voltou a abrir" \
  "\"$ADB\" shell pidof $PACOTE | grep -q ."
checar "sem exceção fatal na reabertura" \
  "! grep -qE 'FATAL EXCEPTION' '$SAIDA/logcat-reabertura.txt'"

echo
echo "SOBREVIVE A TOQUE ALEATÓRIO (teste de macaco)"
# Não é teste de aceitação, é teste de robustez: 400 eventos aleatórios
# encontram tela que quebra ao receber toque fora de ordem.
"$ADB" logcat -c
"$ADB" shell monkey -p "$PACOTE" --throttle 120 --pct-syskeys 0 -s 42 400 > "$SAIDA/monkey.txt" 2>&1
sleep 3
"$ADB" logcat -d > "$SAIDA/logcat-monkey.txt" 2>&1
capturar "03-depois-do-macaco"

checar "o macaco terminou sem travar o aplicativo" \
  "grep -qE 'Events injected: [0-9]+' '$SAIDA/monkey.txt'"
checar "sem exceção fatal durante os toques" \
  "! grep -qE 'FATAL EXCEPTION' '$SAIDA/logcat-monkey.txt'"
checar "o processo continua vivo depois de 400 toques" \
  "\"$ADB\" shell pidof $PACOTE | grep -q ."

echo
echo "======================================================================"
echo "  $ok passaram, $falhou falharam"
echo "  evidências em: $SAIDA"
echo "======================================================================"
[ "$falhou" -eq 0 ] || exit 1
