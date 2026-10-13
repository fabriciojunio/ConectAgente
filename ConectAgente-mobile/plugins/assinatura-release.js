/**
 * Faz o APK de release ser assinado com a chave do projeto, e não com a de
 * depuração.
 *
 * Por que isto existe, e por que é um plugin e não um passo manual.
 *
 * O `android/` é gerado pelo `expo prebuild` e não fica no repositório. O
 * `build.gradle` que ele gera assina o release com `debug.keystore`, que o
 * próprio prebuild recria a cada vez. O comentário dele admite: "Caution! In
 * production, you need to generate your own keystore file."
 *
 * O efeito disso só aparece na segunda instalação:
 *
 *   INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package signatures do not
 *   match newer version
 *
 * Para atualizar, o agente teria que desinstalar. E num aplicativo
 * offline-first isso quer dizer **perder a visita que ainda não sincronizou**,
 * que é exatamente o dado que só existe no aparelho dele. Medido em 13/10/2026,
 * com a instalação falhando no emulador.
 *
 * Como passo manual, isso seria esquecido: o prebuild roda de novo a cada
 * pacote nativo novo. Como plugin, a assinatura volta sozinha.
 *
 * A chave e a senha ficam em `chaves/`, fora do git. **Perder esse arquivo tem
 * consequência:** qualquer APK novo passa a ser recusado como atualização, e
 * todo agente teria que desinstalar. Guarde uma cópia fora desta máquina.
 */
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');

const PASTA_CHAVES = 'chaves';
const ARQUIVO_CHAVE = 'conectagente-release.keystore';
const ARQUIVO_SENHA = 'senha-keystore.txt';
const ALIAS = 'conectagente';

function caminhoDaChave(raiz) {
  return path.join(raiz, PASTA_CHAVES, ARQUIVO_CHAVE);
}

function lerSenha(raiz) {
  const arquivo = path.join(raiz, PASTA_CHAVES, ARQUIVO_SENHA);
  return fs.readFileSync(arquivo, 'utf8').trim();
}

/** Copia a chave para dentro de `android/app`, de onde o Gradle a lê. */
function copiarChave(config) {
  return withDangerousMod(config, [
    'android',
    (c) => {
      const origem = caminhoDaChave(c.modRequest.projectRoot);
      if (!fs.existsSync(origem)) {
        // Sem a chave, o build continua e sai assinado com a de depuração. O
        // aviso é alto de propósito: APK assim não serve para distribuir.
        console.warn(
          '\n[assinatura-release] ' + origem + ' não existe.\n' +
            '  O APK sairá assinado com a chave de depuração, e não poderá\n' +
            '  atualizar uma instalação anterior.\n'
        );
        return c;
      }
      const destino = path.join(c.modRequest.platformProjectRoot, 'app', ARQUIVO_CHAVE);
      fs.copyFileSync(origem, destino);
      return c;
    },
  ]);
}

/** Acrescenta o signingConfig e aponta o release para ele. */
function configurarGradle(config) {
  return withAppBuildGradle(config, (c) => {
    const raiz = c.modRequest.projectRoot;
    if (!fs.existsSync(caminhoDaChave(raiz))) return c;

    const senha = lerSenha(raiz);
    let gradle = c.modResults.contents;

    if (gradle.includes('release {\n            storeFile')) return c; // já aplicado

    // 1. declara a configuração de assinatura, ao lado da de depuração
    gradle = gradle.replace(
      /(signingConfigs \{\s*\n\s*debug \{[\s\S]*?\n        \})/,
      `$1
        release {
            storeFile file('${ARQUIVO_CHAVE}')
            storePassword '${senha}'
            keyAlias '${ALIAS}'
            keyPassword '${senha}'
        }`
    );

    // 2. aponta o buildType release para ela, no lugar da de depuração
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release'
    );

    c.modResults.contents = gradle;
    return c;
  });
}

module.exports = function assinaturaRelease(config) {
  return configurarGradle(copiarChave(config));
};
