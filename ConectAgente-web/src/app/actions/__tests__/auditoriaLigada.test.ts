/**
 * Guarda da trilha de auditoria do painel.
 *
 * `src/services/auditService.ts` tem `registrarAcao` desde o começo, escrito
 * com cuidado: usa o cliente de servidor, pega o usuário da sessão, e não
 * propaga erro para não quebrar o fluxo principal. E nenhuma linha do projeto
 * o chamava. Função pronta e nunca usada é o mesmo que não existir, e aqui o
 * que não existia era o rastro exigido pelo art. 37 da Lei 13.709/2018.
 *
 * Os dois atos administrativos do painel são aprovar e rejeitar cadastro.
 * Aprovar cria acesso ao prontuário de munícipes; rejeitar nega acesso a um
 * colega. Os dois precisam ser atribuíveis a uma pessoa.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const REGISTRO = join(__dirname, '..', 'registro.ts');

function codigo(): string {
  return readFileSync(REGISTRO, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

describe('as ações administrativas deixam rastro', () => {
  it('aprovar cadastro registra na auditoria', () => {
    expect(codigo()).toContain("registrarAcao('APROVAR_CADASTRO'");
  });

  it('rejeitar cadastro registra na auditoria', () => {
    expect(codigo()).toContain("registrarAcao('REJEITAR_CADASTRO'");
  });

  it('redefinir a senha de sincronização registra na auditoria, sem a senha', () => {
    const fonte = codigo();
    const trecho = fonte.slice(fonte.indexOf("registrarAcao('REDEFINIR_SENHA'"));
    const ateFechar = trecho.slice(0, trecho.indexOf('});'));

    expect(ateFechar).toContain('redefinida_por');
    expect(ateFechar.toLowerCase()).not.toContain('senha:');
    expect(ateFechar).not.toContain('parsed.data');
  });

  it('o registro guarda quem decidiu, e não o dado do solicitante', () => {
    const fonte = codigo();
    const trecho = fonte.slice(fonte.indexOf("registrarAcao('APROVAR_CADASTRO'"));
    const ateFechar = trecho.slice(0, trecho.indexOf('});'));

    expect(ateFechar).toContain('aprovado_por');
    // Nada de dado pessoal do solicitante na trilha.
    for (const campo of ['cpf', 'email', 'telefone', 'nome']) {
      expect(ateFechar.toLowerCase()).not.toContain(campo);
    }
  });

  it('o serviço de auditoria continua sem propagar erro', () => {
    // Se isto virar `throw`, uma falha de log passa a derrubar a aprovação.
    const servico = readFileSync(
      join(__dirname, '..', '..', '..', 'services', 'auditService.ts'),
      'utf-8'
    );
    const registrar = servico.slice(servico.indexOf('export async function registrarAcao'));
    const ateOFim = registrar.slice(0, registrar.indexOf('\n}'));

    expect(ateOFim).toContain('catch');
    expect(ateOFim).toContain('console.error');
  });
});
