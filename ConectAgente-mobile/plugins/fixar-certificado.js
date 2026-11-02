/**
 * Fixa o certificado do Supabase (certificate pinning) pela configuração de
 * segurança de rede do Android.
 *
 * O aplicativo só aceita a sincronização se a cadeia TLS do Supabase passar
 * por uma destas duas chaves públicas, mesmo que o aparelho confie em outra
 * autoridade. Fixamos a intermediária (Google Trust Services WE1) e a raiz
 * (GTS Root R4), não o certificado da folha: a folha do Supabase rotaciona
 * sozinha, as duas âncoras não. Dois pinos para a rotação de um não derrubar
 * a sincronização em campo.
 *
 * `expiration` é proposital. Se o Google trocar a própria cadeia, um pino fixo
 * para sempre travaria a sincronização do agente sem conserto remoto. Depois
 * da data, o Android deixa de exigir o pino (volta a valer só a loja de
 * confiança do sistema), o que é falhar-seguro. Renovar: recalcular os pinos
 * com `openssl s_client -connect <host>:443 ... | openssl ... dgst -sha256`,
 * trocar aqui e empurrar uma versão nova antes da data. Ver docs/seguranca.md.
 *
 * É plugin pelo mesmo motivo dos outros: o `android/` é gerado pelo prebuild,
 * e arquivo escrito à mão nele some na próxima geração.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config>
    <domain includeSubdomains="true">supabase.co</domain>
    <trust-anchors>
      <certificates src="system"/>
    </trust-anchors>
    <pin-set expiration="2027-05-01">
      <!-- Google Trust Services WE1 (intermediária que assina o host) -->
      <pin digest="SHA-256">kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4=</pin>
      <!-- GTS Root R4 (raiz), pino de reserva -->
      <pin digest="SHA-256">mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=</pin>
    </pin-set>
  </domain-config>
</network-security-config>
`;

/** Aponta o manifesto para o arquivo de configuração de rede. */
function apontarNoManifesto(manifesto) {
  const aplicacao = manifesto.application[0];
  aplicacao.$['android:networkSecurityConfig'] = '@xml/network_security_config';
  return manifesto;
}

function escreverArquivo(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pasta = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(path.join(pasta, 'network_security_config.xml'), XML);
      return cfg;
    },
  ]);
}

module.exports = function fixarCertificado(config) {
  config = escreverArquivo(config);
  config = withAndroidManifest(config, (mod) => {
    mod.modResults.manifest = apontarNoManifesto(mod.modResults.manifest);
    return mod;
  });
  return config;
};

module.exports.XML = XML;
module.exports.apontarNoManifesto = apontarNoManifesto;
