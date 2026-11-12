import { readFileSync } from 'fs';
import { join } from 'path';

const arquivo = readFileSync(join(__dirname, '..', '..', 'public', '.well-known', 'security.txt'), 'utf8');
const middleware = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf8');

describe('security.txt (RFC 9116)', () => {
  it('tem contato e política', () => {
    expect(arquivo).toMatch(/^Contact: mailto:/m);
    expect(arquivo).toMatch(/^Policy: https:\/\//m);
  });

  it('não está vencido e vence em no máximo um ano', () => {
    const expira = new Date(/^Expires: (.+)$/m.exec(arquivo)![1]);
    const agora = Date.now();
    expect(expira.getTime()).toBeGreaterThan(agora);
    expect(expira.getTime() - agora).toBeLessThanOrEqual(366 * 24 * 3600 * 1000);
  });

  it('abre sem login', () => {
    expect(middleware).toContain("'/.well-known/security.txt'");
  });
});
