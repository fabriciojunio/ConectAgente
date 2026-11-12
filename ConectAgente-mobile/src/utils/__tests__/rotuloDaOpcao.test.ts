import { ESCOLARIDADE_OPTIONS, MOTIVOS_VISITA_LABEL, TIPO_IMOVEL_OPTIONS, rotuloDaOpcao } from '../constants';

describe('rotuloDaOpcao', () => {
  it('troca o valor guardado pelo rótulo da tela', () => {
    expect(rotuloDaOpcao(ESCOLARIDADE_OPTIONS, 'medio_completo')).toBe('Médio Completo');
    expect(rotuloDaOpcao(TIPO_IMOVEL_OPTIONS, 'proprio')).toBe('Própria');
    expect(rotuloDaOpcao(MOTIVOS_VISITA_LABEL, 'busca_ativa')).toBe('Busca ativa');
  });

  it('vazio vira o texto de "não informado"', () => {
    expect(rotuloDaOpcao(ESCOLARIDADE_OPTIONS, null, 'Não informada')).toBe('Não informada');
    expect(rotuloDaOpcao(TIPO_IMOVEL_OPTIONS, '')).toBe('Não informado');
  });

  it('valor desconhecido aparece como veio, sem esconder dado', () => {
    expect(rotuloDaOpcao(TIPO_IMOVEL_OPTIONS, 'barraco')).toBe('barraco');
  });
});
