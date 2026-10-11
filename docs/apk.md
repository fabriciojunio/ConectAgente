# Gerar e testar o APK

O aplicativo é gerenciado pelo Expo, então a pasta `android/` não fica no
repositório: ela é gerada por `expo prebuild` quando se precisa de um APK. Isso
mantém o time trabalhando com Expo Go no dia a dia.

---

## O que precisa estar instalado

| Ferramenta | Versão | Por quê |
|---|---|---|
| JDK | **17** | O React Native 0.81 pede o 17. O JDK do sistema aqui é o 20, por causa do trabalho, e não deve ser trocado: aponte `JAVA_HOME` só para o comando do build |
| Android SDK | platform 35 ou 36 | compilação |
| NDK | 27.x | o React Native compila C++ |
| CMake | **3.22.1** | sem ele o build morre em `configureCMakeRelWithDebInfo` com `IOException: A sintaxe do nome do arquivo... está incorreta`, que não diz nada sobre o que falta |

Instalar o CMake, se faltar:

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager.bat" "cmake;3.22.1"
```

---

## Gerar

```bash
cd ConectAgente-mobile

export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="$HOME/scoop/apps/temurin17-jdk/current"
export PATH="$JAVA_HOME/bin:$PATH"

npx expo prebuild --platform android --no-install

cd android
echo "sdk.dir=C:/Users/junio/AppData/Local/Android/Sdk" > local.properties
./gradlew assembleRelease --no-daemon
```

O APK sai em `android/app/build/outputs/apk/release/app-release.apk`.

Duas coisas que custaram tempo e vale registrar:

**`local.properties` com barra normal.** O arquivo é lido como `.properties` do
Java, onde a contrabarra é caractere de escape. `C:\Users\junio` vira
`C:Usersjunio`, e o erro que aparece depois é sobre CMake, não sobre o
caminho. Barra normal funciona no Windows e evita o problema.

**`expo prebuild` troca os scripts do `package.json`**, de
`expo start --android` para `expo run:android`. Reverta: a pasta `android/` é
ignorada pelo git, o projeto continua gerenciado, e forçar build nativo em
quem só quer rodar no Expo Go é pior.

---

## Assinatura

O template do React Native deixa o build de release assinado com a **chave de
depuração**, que é a mesma em toda máquina do mundo. Qualquer pessoa consegue
assinar uma atualização que o Android aceita por cima do aplicativo instalado.

Por isso há uma chave própria, em `ConectAgente-mobile/chaves/`, com a senha ao
lado. As duas estão fora do git, e o `.gitignore` cobre `chaves/`, `*.keystore`
e `*.jks`.

**Guarde essa chave.** Se ela se perder, não há como publicar atualização do
aplicativo em cima da versão já instalada: o Android recusa APK assinado com
chave diferente, e na Play Store seria preciso criar outro aplicativo.

O `build.gradle` só usa a chave própria se a propriedade existir:

```gradle
signingConfig project.hasProperty('CONECTAGENTE_STORE_FILE')
    ? signingConfigs.release
    : signingConfigs.debug
```

Assim quem clonar sem a chave ainda consegue compilar, com a de depuração, e
sabe que aquilo não serve para distribuir.

---

## Testar de verdade

```bash
bash ConectAgente-mobile/testar-apk.sh
```

Sobe o emulador, instala, abre o aplicativo e confere com evidência:

- o processo fica vivo depois de abrir
- não há exceção fatal no logcat
- o banco SQLite local foi criado
- fecha e reabre sem quebrar
- aguenta 400 toques aleatórios sem exceção fatal

As capturas de tela e os logs ficam em `ConectAgente-mobile/evidencias-apk/`.

"Compila" e "abre" são coisas diferentes, e a segunda é a que importa. Módulo
nativo faltando, variável de ambiente ausente e falha de migração do banco só
aparecem quando o processo sobe no aparelho.

---

## O que o APK faz sem servidor configurado

O aplicativo é offline-first, e a maior parte dele **não depende de servidor
nenhum**:

| Funciona sem servidor | Precisa do Supabase configurado |
|---|---|
| entrar com CPF e senha | sincronizar o que foi coletado |
| cadastrar residência, morador e visita | o painel web ver o dado do agente |
| preencher as cinco fichas do prontuário | a coordenação acompanhar |
| classificar risco da família | |
| exportar relatório em CSV e Excel | |
| as telas de administração | |

Com o `.env` em branco ou com valor de exemplo, o aplicativo avisa no console e
continua funcionando offline. A sincronização para antes de tentar e diz o
motivo, em vez de falhar calada e queimar as tentativas da fila.

**Para a sincronização funcionar** são necessários, nesta ordem:

1. um projeto no Supabase, com a URL e a chave `anon` no `.env`
2. as migrações de `ConectAgente-web/supabase/` aplicadas, na ordem:
   `migration_web`, `migration_registro`, `migration_risco`,
   `migration_sync_mobile`, `migration_prontuario_sync`,
   `migration_rls_completo`
3. ao menos um agente aprovado pelo painel web, que é quem cria o usuário no
   Supabase Auth. Agente criado só pelo primeiro acesso do aplicativo não tem
   usuário no servidor e não sincroniza

Sem o passo 3, o RLS nega toda gravação, e isso foi medido:
`new row violates row-level security policy for table "residencias"`.
