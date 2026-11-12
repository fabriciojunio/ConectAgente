import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * `select('*')` em agentes inclui senha_hash, que é fechada, e o banco
 * recusa a consulta inteira. A tela de Agentes ficava vazia por isso.
 */
describe('consultas de agentes', () => {
  const pasta = join(__dirname, '..');
  const servicos = readdirSync(pasta).filter((f) => f.endsWith('.ts'));

  it.each(servicos)('%s não pede todas as colunas de agentes', (arquivo) => {
    const fonte = readFileSync(join(pasta, arquivo), 'utf8').replace(/\s+/g, ' ');
    expect(fonte).not.toMatch(/from\('agentes'\)\s*\.select\('\*'/);
  });

  it('a lista não inclui o hash de senha', async () => {
    const { AGENTE_COLUNAS_LISTA } = await import('../agenteColunas');
    expect(AGENTE_COLUNAS_LISTA).not.toMatch(/senha/);
  });
});
