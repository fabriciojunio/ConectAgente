// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fecharAtividades } = require('../../plugins/endurecer-manifesto');

const CORTADOR = 'com.canhub.cropper.CropImageActivity';

function manifesto(atividades: Array<Record<string, string>>) {
  return { $: {}, application: [{ $: {}, activity: atividades.map((a) => ({ $: a })) }] };
}

describe('plugin endurecer-manifesto', () => {
  it('fecha o cortador que a biblioteca exporta', () => {
    const resultado = fecharAtividades(manifesto([]));
    const cortador = resultado.application[0].activity.find(
      (a: { $: Record<string, string> }) => a.$['android:name'] === CORTADOR
    );
    expect(cortador.$['android:exported']).toBe('false');
    // Sem tools:replace o merge do Gradle recusa a troca do atributo da biblioteca.
    expect(cortador.$['tools:replace']).toBe('android:exported');
    expect(resultado.$['xmlns:tools']).toBe('http://schemas.android.com/tools');
  });

  it('não duplica a atividade se ela já estiver declarada', () => {
    const resultado = fecharAtividades(manifesto([{ 'android:name': CORTADOR, 'android:exported': 'true' }]));
    const iguais = resultado.application[0].activity.filter(
      (a: { $: Record<string, string> }) => a.$['android:name'] === CORTADOR
    );
    expect(iguais).toHaveLength(1);
    expect(iguais[0].$['android:exported']).toBe('false');
  });

  it('não mexe nas atividades do próprio aplicativo', () => {
    const resultado = fecharAtividades(manifesto([{ 'android:name': '.MainActivity', 'android:exported': 'true' }]));
    const principal = resultado.application[0].activity.find(
      (a: { $: Record<string, string> }) => a.$['android:name'] === '.MainActivity'
    );
    expect(principal.$['android:exported']).toBe('true');
  });
});
