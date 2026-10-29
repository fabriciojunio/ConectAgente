/**
 * Fecha no manifesto o que o MobSF apontou e não vem do nosso código.
 *
 * A `CropImageActivity`, da biblioteca de recorte que o expo-image-picker usa
 * para a foto de perfil, sai exportada: qualquer aplicativo do aparelho pode
 * abri-la e mandar o arquivo que quiser. O ConectAgente só a chama por dentro,
 * e chamada de dentro do mesmo aplicativo funciona com `exported="false"`.
 *
 * É plugin pelo mesmo motivo da assinatura: o `android/` é gerado pelo
 * prebuild, e ajuste feito à mão nele some na próxima geração.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const ATIVIDADES_INTERNAS = ['com.canhub.cropper.CropImageActivity'];

function fecharAtividades(manifesto) {
  manifesto.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  const aplicacao = manifesto.application[0];
  aplicacao.activity = aplicacao.activity ?? [];
  for (const nome of ATIVIDADES_INTERNAS) {
    let atividade = aplicacao.activity.find((a) => a.$['android:name'] === nome);
    if (!atividade) {
      atividade = { $: { 'android:name': nome } };
      aplicacao.activity.push(atividade);
    }
    atividade.$['android:exported'] = 'false';
    // `merge` mantém o resto da declaração da biblioteca e troca só o exported.
    atividade.$['tools:node'] = 'merge';
    atividade.$['tools:replace'] = 'android:exported';
  }
  return manifesto;
}

module.exports = function endurecerManifesto(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults.manifest = fecharAtividades(mod.modResults.manifest);
    return mod;
  });
};

module.exports.fecharAtividades = fecharAtividades;
