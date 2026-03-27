import {
  criarAuditLog,
  criarConsentimento,
  anonimizarMorador,
  minimizarParaLista,
  calcularDataExpiracao,
  BASE_LEGAL_LGPD,
} from '../lgpd';

describe('criarAuditLog', () => {
  it('cria log de auditoria com campos obrigatórios', () => {
    const log = criarAuditLog({
      agente_id: 'agente-123',
      acao: 'CREATE',
      tabela: 'moradores',
      registro_id: 'morador-456',
    });

    expect(log.agente_id).toBe('agente-123');
    expect(log.acao).toBe('CREATE');
    expect(log.tabela).toBe('moradores');
    expect(log.registro_id).toBe('morador-456');
    expect(log.id).toBeTruthy();
    expect(log.created_at).toBeTruthy();
  });

  it('omite campos sensíveis dos dados auditados', () => {
    const log = criarAuditLog({
      agente_id: 'agente-123',
      acao: 'UPDATE',
      tabela: 'agentes',
      registro_id: 'agente-123',
      dados_novos: { nome: 'João', senha: 'secreta123', email: 'joao@ex.com' },
    });

    const dadosNovos = JSON.parse(log.dados_novos!);
    expect(dadosNovos.senha).toBe('[OMITIDO]');
    expect(dadosNovos.nome).toBe('João');
    expect(dadosNovos.email).toBe('joao@ex.com');
  });

  it('omite senha_hash e assinatura_base64', () => {
    const log = criarAuditLog({
      agente_id: 'agente-123',
      acao: 'CREATE',
      tabela: 'moradores',
      registro_id: 'morador-456',
      dados_anteriores: {
        senha_hash: 'hash-secreto',
        assinatura_base64: 'assinatura-base64',
        nome: 'Maria',
      },
    });

    const dadosAnteriores = JSON.parse(log.dados_anteriores!);
    expect(dadosAnteriores.senha_hash).toBe('[OMITIDO]');
    expect(dadosAnteriores.assinatura_base64).toBe('[OMITIDO]');
    expect(dadosAnteriores.nome).toBe('Maria');
  });

  it('gera ID único para cada log', () => {
    const log1 = criarAuditLog({ agente_id: 'a', acao: 'r', tabela: 't', registro_id: 'r1' });
    const log2 = criarAuditLog({ agente_id: 'a', acao: 'r', tabela: 't', registro_id: 'r2' });
    expect(log1.id).not.toBe(log2.id);
  });
});

describe('criarConsentimento', () => {
  it('cria consentimento com dados corretos', () => {
    const consentimento = criarConsentimento({
      morador_id: 'morador-123',
      tipo: 'coleta_dados_saude',
      aceito: true,
      dados_coletados: ['nome', 'cpf', 'historico_saude'],
    });

    expect(consentimento.morador_id).toBe('morador-123');
    expect(consentimento.tipo).toBe('coleta_dados_saude');
    expect(consentimento.aceito).toBe(true);
    expect(consentimento.dados_coletados).toBe('nome,cpf,historico_saude');
    expect(consentimento.versao_politica).toBeTruthy();
    expect(consentimento.data_aceite).toBeTruthy();
  });

  it('registra recusa de consentimento', () => {
    const consentimento = criarConsentimento({
      morador_id: 'morador-456',
      tipo: 'compartilhamento',
      aceito: false,
      dados_coletados: [],
    });

    expect(consentimento.aceito).toBe(false);
  });
});

describe('anonimizarMorador', () => {
  const moradorOriginal = {
    id: 'morador-123',
    nome: 'João da Silva',
    cpf: '52998224725',
    cartao_sus: '700123456789012',
    telefone: '11987654321',
    nome_pai: 'José da Silva',
    nome_mae: 'Maria da Silva',
    data_nascimento: '1990-03-15',
    cidade_nascimento: 'São Paulo',
    profissao: 'Pedreiro',
    residencia_id: 'res-456',
    sexo: 'masculino',
  };

  it('anonimiza campos pessoais identificáveis', () => {
    const anonimizado = anonimizarMorador(moradorOriginal);

    expect(anonimizado.nome).toBe('ANONIMIZADO');
    expect(anonimizado.cpf).toBe('00000000000');
    expect(anonimizado.cartao_sus).toBe('000000000000000');
    expect(anonimizado.telefone).toBeNull();
    expect(anonimizado.nome_pai).toBeNull();
    expect(anonimizado.nome_mae).toBeNull();
    expect(anonimizado.cidade_nascimento).toBeNull();
    expect(anonimizado.profissao).toBeNull();
  });

  it('preserva campos não-sensíveis', () => {
    const anonimizado = anonimizarMorador(moradorOriginal);

    expect(anonimizado.id).toBe('morador-123');
    expect(anonimizado.residencia_id).toBe('res-456');
    expect(anonimizado.sexo).toBe('masculino');
  });

  it('define data de nascimento padrão', () => {
    const anonimizado = anonimizarMorador(moradorOriginal);
    expect(anonimizado.data_nascimento).toBe('1900-01-01');
  });

  it('define deleted_at na anonimização', () => {
    const anonimizado = anonimizarMorador(moradorOriginal);
    expect(anonimizado.deleted_at).toBeTruthy();
  });
});

describe('minimizarParaLista', () => {
  const moradorCompleto = {
    id: 'morador-123',
    nome: 'João da Silva',
    cpf: '52998224725',
    cartao_sus: '700123456789012',
    telefone: '11987654321',
    sexo: 'masculino',
    data_nascimento: '1990-03-15',
    is_hipertenso: true,
    is_diabetico: false,
    residencia_id: 'res-456',
    nome_pai: 'José da Silva',
    nome_mae: 'Maria da Silva',
  };

  it('retorna apenas campos necessários para listagem', () => {
    const minimizado = minimizarParaLista(moradorCompleto);

    expect(minimizado.id).toBeDefined();
    expect(minimizado.nome).toBeDefined();
    expect(minimizado.sexo).toBeDefined();
    expect(minimizado.data_nascimento).toBeDefined();
    expect(minimizado.is_hipertenso).toBeDefined();
    expect(minimizado.is_diabetico).toBeDefined();
    expect(minimizado.residencia_id).toBeDefined();
  });

  it('não expõe dados sensíveis', () => {
    const minimizado = minimizarParaLista(moradorCompleto);

    expect(minimizado.cpf).toBeUndefined();
    expect(minimizado.cartao_sus).toBeUndefined();
    expect(minimizado.telefone).toBeUndefined();
    expect(minimizado.nome_pai).toBeUndefined();
    expect(minimizado.nome_mae).toBeUndefined();
  });
});

describe('calcularDataExpiracao', () => {
  it('calcula expiração de 20 anos para dados de saúde', () => {
    const expiracao = calcularDataExpiracao('saude');
    const dataExp = new Date(expiracao);
    const hoje = new Date();
    const diffAnos = dataExp.getFullYear() - hoje.getFullYear();

    expect(diffAnos).toBe(20);
  });

  it('calcula expiração de 5 anos para dados gerais', () => {
    const expiracao = calcularDataExpiracao('geral');
    const dataExp = new Date(expiracao);
    const hoje = new Date();
    const diffAnos = dataExp.getFullYear() - hoje.getFullYear();

    expect(diffAnos).toBe(5);
  });

  it('retorna data no futuro', () => {
    const expiracao = calcularDataExpiracao('saude');
    expect(new Date(expiracao).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('BASE_LEGAL_LGPD', () => {
  it('contém referência ao artigo correto da LGPD', () => {
    expect(BASE_LEGAL_LGPD.ARTIGO).toContain('13.709/2018');
    expect(BASE_LEGAL_LGPD.ARTIGO).toContain('Art. 7°');
  });

  it('contém finalidade de saúde pública', () => {
    expect(BASE_LEGAL_LGPD.FINALIDADE).toContain('saúde');
  });

  it('contém contato do DPO', () => {
    expect(BASE_LEGAL_LGPD.DPO_CONTATO).toContain('@');
  });
});
