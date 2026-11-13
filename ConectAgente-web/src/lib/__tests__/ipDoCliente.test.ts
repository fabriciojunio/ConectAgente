import { ipDoCliente } from '../ipDoCliente';

const cab = (valores: Record<string, string>) => ({ get: (n: string) => valores[n.toLowerCase()] ?? null });

describe('IP do cliente para o limite de tentativas', () => {
  it('na Vercel, vale o cabeçalho que só a borda escreve, e não o que o cliente inventou', () => {
    const atacante = cab({
      'x-forwarded-for': '1.2.3.4, 200.10.10.10',
      'x-vercel-forwarded-for': '200.10.10.10',
    });
    expect(ipDoCliente(atacante)).toBe('200.10.10.10');
  });

  it('atrás de proxy comum, o x-real-ip da borda vence o X-Forwarded-For forjado', () => {
    expect(ipDoCliente(cab({ 'x-forwarded-for': '9.9.9.9, 177.1.1.1', 'x-real-ip': '177.1.1.1' }))).toBe('177.1.1.1');
  });

  it('sem cabeçalho da borda, cai no X-Forwarded-For', () => {
    expect(ipDoCliente(cab({ 'x-forwarded-for': '177.1.1.1' }))).toBe('177.1.1.1');
  });

  it('valor absurdo ou ausente não vira chave do limite', () => {
    expect(ipDoCliente(cab({}))).toBe('desconhecido');
    expect(ipDoCliente(cab({ 'x-forwarded-for': 'a'.repeat(500) }))).toBe('desconhecido');
  });
});
