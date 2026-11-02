// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apontarNoManifesto, XML } = require('../../plugins/fixar-certificado');

describe('plugin fixar-certificado', () => {
  it('aponta o manifesto para a configuração de rede', () => {
    const manifesto = { $: {}, application: [{ $: {} }] };
    const resultado = apontarNoManifesto(manifesto);
    expect(resultado.application[0].$['android:networkSecurityConfig']).toBe(
      '@xml/network_security_config'
    );
  });

  it('fixa a intermediária e a raiz do Supabase, com expiração', () => {
    expect(XML).toContain('kIdp6NNEd8wsugYyyIYFsi1ylMCED3hZbSR8ZFsa/A4=');
    expect(XML).toContain('mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=');
    expect(XML).toContain('includeSubdomains="true"');
    expect(XML).toContain('supabase.co');
    expect(XML).toMatch(/expiration="\d{4}-\d{2}-\d{2}"/);
  });

  it('fixa duas chaves, para a rotação de uma não travar o sync', () => {
    const pinos = XML.match(/<pin digest="SHA-256">/g) || [];
    expect(pinos).toHaveLength(2);
  });
});
