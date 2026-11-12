import {
  MENSAGEM_CONTA_NAO_LIBERADA, MENSAGEM_SEM_REDE, explicarFalhaDeSincronizacao, falhaDeConta,
} from '../falhaDeSincronizacao';

describe('falha de sincronização', () => {
  it('senha recusada pelo servidor vira orientação para a coordenação liberar a conta', () => {
    expect(explicarFalhaDeSincronizacao('Invalid login credentials')).toBe(MENSAGEM_CONTA_NAO_LIBERADA);
    expect(explicarFalhaDeSincronizacao('Sem sessão no servidor. Entre novamente para a sincronização voltar.'))
      .toBe(MENSAGEM_CONTA_NAO_LIBERADA);
    expect(falhaDeConta('Invalid login credentials')).toBe(true);
  });

  it('falha de rede diz que o dado está salvo e sobe quando a conexão voltar', () => {
    expect(explicarFalhaDeSincronizacao('TypeError: Network request failed')).toBe(MENSAGEM_SEM_REDE);
    expect(falhaDeConta('Network request failed')).toBe(false);
  });

  it('erro desconhecido não some: pede para tentar de novo e avisar a coordenação', () => {
    const texto = explicarFalhaDeSincronizacao('relation "medicamentos" does not exist');
    expect(texto).toMatch(/Tente de novo/);
    expect(texto).toMatch(/salvos neste celular/);
    expect(explicarFalhaDeSincronizacao(null)).toMatch(/salvos neste celular/);
  });

  it('a mensagem nunca repete detalhe técnico do servidor', () => {
    expect(explicarFalhaDeSincronizacao('relation "medicamentos" does not exist')).not.toMatch(/relation|medicamentos/);
  });
});
