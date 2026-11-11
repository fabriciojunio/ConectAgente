import { readFileSync } from 'fs';
import { join } from 'path';
import { router } from 'expo-router';
import {
  ALTURA_DO_CONTEUDO_DA_BARRA,
  medidasDaBarraDeAbas,
  sairDoFormularioPara,
  voltar,
} from '../navegacao';

const roteador = router as jest.Mocked<typeof router>;

beforeEach(() => {
  jest.clearAllMocks();
  roteador.canGoBack.mockReturnValue(true);
});

describe('voltar', () => {
  it('volta para a tela anterior mesmo quando a tela tem destino fixo', () => {
    voltar('/(app)/residencias');
    expect(roteador.back).toHaveBeenCalledTimes(1);
    expect(roteador.push).not.toHaveBeenCalled();
    expect(roteador.replace).not.toHaveBeenCalled();
  });

  it('usa o destino fixo só quando não há histórico', () => {
    roteador.canGoBack.mockReturnValue(false);
    voltar('/(app)/residencias');
    expect(roteador.back).not.toHaveBeenCalled();
    expect(roteador.replace).toHaveBeenCalledWith('/(app)/residencias');
  });

  it('sem histórico e sem destino, vai para o início', () => {
    roteador.canGoBack.mockReturnValue(false);
    voltar();
    expect(roteador.replace).toHaveBeenCalledWith('/');
  });

  it('nunca empilha tela nova ao voltar', () => {
    voltar('/(app)/visitas');
    roteador.canGoBack.mockReturnValue(false);
    voltar('/(app)/visitas');
    expect(roteador.push).not.toHaveBeenCalled();
  });
});

describe('sairDoFormularioPara', () => {
  it('fecha o formulário antes de abrir o destino', () => {
    const destino = { pathname: '/(app)/residencia/[id]', params: { id: 'r1' } } as const;
    sairDoFormularioPara(destino);
    expect(roteador.back).toHaveBeenCalledTimes(1);
    expect(roteador.push).toHaveBeenCalledWith(destino);
    expect(roteador.back.mock.invocationCallOrder[0]).toBeLessThan(roteador.push.mock.invocationCallOrder[0]);
  });

  it('sem histórico, só abre o destino', () => {
    roteador.canGoBack.mockReturnValue(false);
    sairDoFormularioPara('/(app)/visitas');
    expect(roteador.back).not.toHaveBeenCalled();
    expect(roteador.push).toHaveBeenCalledWith('/(app)/visitas');
  });
});

describe('medidasDaBarraDeAbas', () => {
  it('reserva a faixa dos três botões do Android embaixo da barra', () => {
    expect(medidasDaBarraDeAbas(48)).toEqual({ height: ALTURA_DO_CONTEUDO_DA_BARRA + 48, paddingBottom: 48 });
  });

  it('mantém uma folga mínima na navegação por gestos', () => {
    expect(medidasDaBarraDeAbas(0)).toEqual({ height: ALTURA_DO_CONTEUDO_DA_BARRA + 8, paddingBottom: 8 });
  });
});

describe('layouts das abas', () => {
  const layout = (grupo: string) => readFileSync(join(__dirname, '..', '..', 'app', grupo, '_layout.tsx'), 'utf8');

  it.each(['(app)', '(admin)'])('%s volta pelo histórico e respeita os botões do sistema', (grupo) => {
    const codigo = layout(grupo);
    expect(codigo).toContain('backBehavior="history"');
    expect(codigo).toContain('medidasDaBarraDeAbas(insets.bottom)');
  });

  it('o cabeçalho não abre tela nova no lugar de voltar', () => {
    const cabecalho = readFileSync(join(__dirname, '..', '..', 'components', 'ui', 'PageHeader.tsx'), 'utf8');
    expect(cabecalho).not.toMatch(/router\.push/);
    expect(cabecalho).toContain('voltar(backTo)');
  });

  it('formulário salvo não fica no histórico', () => {
    for (const tela of ['residencia/nova.tsx', 'morador/novo.tsx', 'visita/nova.tsx']) {
      const codigo = readFileSync(join(__dirname, '..', '..', 'app', '(app)', tela), 'utf8');
      expect(codigo).not.toMatch(/router\.replace/);
      expect(codigo).toContain('sairDoFormularioPara(');
    }
  });
});
