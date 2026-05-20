import { getDatabase } from '../database';
import {
  Prontuario, ProntuarioSaude, ProntuarioGestante,
  ProntuarioPuericultura, ProntuarioMulher, ProntuarioSocial, StatusSync,
} from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { syncQueueRepository } from './syncQueueRepository';

export const prontuarioRepository = {
  // ============================================================
  // PRONTUÁRIO CABEÇALHO
  // ============================================================
  async obterOuCriar(moradorId: string, agenteId: string): Promise<Prontuario> {
    const db = await getDatabase();
    let row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuarios WHERE morador_id = ?`,
      [moradorId]
    );

    if (!row) {
      const id = generateUUID();
      const now = isoNow();
      await db.runAsync(
        `INSERT INTO prontuarios (id, morador_id, agente_id, versao, created_at, updated_at, status_sync)
         VALUES (?, ?, ?, 1, ?, ?, 'pendente')`,
        [id, moradorId, agenteId, now, now]
      );
      row = await db.getFirstAsync<Record<string, unknown>>(
        `SELECT * FROM prontuarios WHERE id = ?`,
        [id]
      );
    }

    const prontuario = mapProntuario(row!);

    // Carregar sub-seções
    prontuario.saude = await this.obterSaude(prontuario.id) ?? undefined;
    prontuario.gestante = await this.obterGestante(prontuario.id) ?? undefined;
    prontuario.puericultura = await this.obterPuericultura(prontuario.id) ?? undefined;
    prontuario.mulher = await this.obterMulher(prontuario.id) ?? undefined;
    prontuario.social = await this.obterSocial(prontuario.id) ?? undefined;

    return prontuario;
  },

  async incrementarVersao(prontuarioId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE prontuarios SET versao = versao + 1, status_sync = 'pendente', updated_at = ? WHERE id = ?`,
      [isoNow(), prontuarioId]
    );
  },

  // ============================================================
  // SAÚDE GERAL
  // ============================================================
  async obterSaude(prontuarioId: string): Promise<ProntuarioSaude | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuario_saude WHERE prontuario_id = ?`,
      [prontuarioId]
    );
    return row ? mapSaude(row) : null;
  },

  async salvarSaude(prontuarioId: string, data: Partial<ProntuarioSaude>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    const existing = await this.obterSaude(prontuarioId);

    if (existing) {
      await db.runAsync(
        `UPDATE prontuario_saude SET
          is_hipertenso = COALESCE(?, is_hipertenso),
          is_diabetico = COALESCE(?, is_diabetico),
          is_domiciliado = COALESCE(?, is_domiciliado),
          is_tuberculose = COALESCE(?, is_tuberculose),
          is_hanseniase = COALESCE(?, is_hanseniase),
          hgt_ultima_afericao = COALESCE(?, hgt_ultima_afericao),
          hgt_valor = COALESCE(?, hgt_valor),
          pa_ultima_afericao = COALESCE(?, pa_ultima_afericao),
          pa_valor = COALESCE(?, pa_valor),
          tem_receita_atualizada = COALESCE(?, tem_receita_atualizada),
          ultima_consulta = COALESCE(?, ultima_consulta),
          proxima_consulta = COALESCE(?, proxima_consulta),
          precisa_agendamento = COALESCE(?, precisa_agendamento),
          especialidade_agendamento = COALESCE(?, especialidade_agendamento),
          queixas = COALESCE(?, queixas),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE prontuario_id = ?`,
        [
          boolOrNull(data.is_hipertenso), boolOrNull(data.is_diabetico),
          boolOrNull(data.is_domiciliado), boolOrNull(data.is_tuberculose),
          boolOrNull(data.is_hanseniase),
          data.hgt_ultima_aferição ?? null, data.hgt_valor ?? null,
          data.pa_ultima_aferição ?? null, data.pa_valor ?? null,
          boolOrNull(data.tem_receita_atualizada),
          data.ultima_consulta ?? null, data.proxima_consulta ?? null,
          boolOrNull(data.precisa_agendamento), data.especialidade_agendamento ?? null,
          data.queixas ?? null, data.observacoes ?? null,
          now, prontuarioId,
        ]
      );
    } else {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO prontuario_saude (
          id, prontuario_id, is_hipertenso, is_diabetico, is_domiciliado,
          is_tuberculose, is_hanseniase, hgt_ultima_afericao, hgt_valor,
          pa_ultima_afericao, pa_valor, tem_receita_atualizada, ultima_consulta,
          proxima_consulta, precisa_agendamento, especialidade_agendamento,
          queixas, observacoes, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, prontuarioId,
          data.is_hipertenso ? 1 : 0, data.is_diabetico ? 1 : 0,
          data.is_domiciliado ? 1 : 0, data.is_tuberculose ? 1 : 0,
          data.is_hanseniase ? 1 : 0,
          data.hgt_ultima_aferição ?? null, data.hgt_valor ?? null,
          data.pa_ultima_aferição ?? null, data.pa_valor ?? null,
          data.tem_receita_atualizada ? 1 : 0,
          data.ultima_consulta ?? null, data.proxima_consulta ?? null,
          data.precisa_agendamento ? 1 : 0, data.especialidade_agendamento ?? null,
          data.queixas ?? null, data.observacoes ?? null, now,
        ]
      );
    }

    await this.incrementarVersao(prontuarioId);
    await syncQueueRepository.enqueue('prontuario_saude', 'update', prontuarioId, data);
  },

  // ============================================================
  // GESTANTE
  // ============================================================
  async obterGestante(prontuarioId: string): Promise<ProntuarioGestante | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuario_gestante WHERE prontuario_id = ?`,
      [prontuarioId]
    );
    return row ? mapGestante(row) : null;
  },

  async salvarGestante(prontuarioId: string, data: Partial<ProntuarioGestante>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    const existing = await this.obterGestante(prontuarioId);

    if (existing) {
      await db.runAsync(
        `UPDATE prontuario_gestante SET
          is_gestante = COALESCE(?, is_gestante),
          data_dum = COALESCE(?, data_dum),
          semanas_gestacao = COALESCE(?, semanas_gestacao),
          pre_natal_em_dia = COALESCE(?, pre_natal_em_dia),
          local_pre_natal = COALESCE(?, local_pre_natal),
          proxima_consulta_pre_natal = COALESCE(?, proxima_consulta_pre_natal),
          vacina_tetano_em_dia = COALESCE(?, vacina_tetano_em_dia),
          vacina_hepatiteb_em_dia = COALESCE(?, vacina_hepatiteb_em_dia),
          sulfato_ferroso = COALESCE(?, sulfato_ferroso),
          acido_folico = COALESCE(?, acido_folico),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE prontuario_id = ?`,
        [
          boolOrNull(data.is_gestante), data.data_dum ?? null, data.semanas_gestacao ?? null,
          boolOrNull(data.pre_natal_em_dia), data.local_pre_natal ?? null,
          data.proxima_consulta_pre_natal ?? null,
          boolOrNull(data.vacina_tetano_em_dia), boolOrNull(data.vacina_hepatiteb_em_dia),
          boolOrNull(data.sulfato_ferroso), boolOrNull(data.acido_folico),
          data.observacoes ?? null, now, prontuarioId,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO prontuario_gestante (
          id, prontuario_id, is_gestante, data_dum, semanas_gestacao,
          pre_natal_em_dia, local_pre_natal, proxima_consulta_pre_natal,
          vacina_tetano_em_dia, vacina_hepatiteb_em_dia, sulfato_ferroso, acido_folico,
          observacoes, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateUUID(), prontuarioId,
          data.is_gestante ? 1 : 0, data.data_dum ?? null, data.semanas_gestacao ?? null,
          data.pre_natal_em_dia ? 1 : 0, data.local_pre_natal ?? null,
          data.proxima_consulta_pre_natal ?? null,
          data.vacina_tetano_em_dia ? 1 : 0, data.vacina_hepatiteb_em_dia ? 1 : 0,
          data.sulfato_ferroso ? 1 : 0, data.acido_folico ? 1 : 0,
          data.observacoes ?? null, now,
        ]
      );
    }

    await this.incrementarVersao(prontuarioId);
    await syncQueueRepository.enqueue('prontuario_gestante', 'update', prontuarioId, data);
  },

  // ============================================================
  // PUERICULTURA
  // ============================================================
  async obterPuericultura(prontuarioId: string): Promise<ProntuarioPuericultura | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuario_puericultura WHERE prontuario_id = ?`,
      [prontuarioId]
    );
    return row ? mapPuericultura(row) : null;
  },

  async salvarPuericultura(prontuarioId: string, data: Partial<ProntuarioPuericultura>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    const existing = await this.obterPuericultura(prontuarioId);

    if (existing) {
      await db.runAsync(
        `UPDATE prontuario_puericultura SET
          is_crianca = COALESCE(?, is_crianca),
          peso_atual = COALESCE(?, peso_atual),
          altura_atual = COALESCE(?, altura_atual),
          cartao_vacina_em_dia = COALESCE(?, cartao_vacina_em_dia),
          vacinas_em_atraso = COALESCE(?, vacinas_em_atraso),
          consulta_acompanhamento_em_dia = COALESCE(?, consulta_acompanhamento_em_dia),
          proxima_consulta = COALESCE(?, proxima_consulta),
          frequenta_escola = COALESCE(?, frequenta_escola),
          nome_escola = COALESCE(?, nome_escola),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE prontuario_id = ?`,
        [
          boolOrNull(data.is_crianca), data.peso_atual ?? null, data.altura_atual ?? null,
          boolOrNull(data.cartao_vacina_em_dia), data.vacinas_em_atraso ?? null,
          boolOrNull(data.consulta_acompanhamento_em_dia), data.proxima_consulta ?? null,
          boolOrNull(data.frequenta_escola), data.nome_escola ?? null,
          data.observacoes ?? null, now, prontuarioId,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO prontuario_puericultura (
          id, prontuario_id, is_crianca, peso_atual, altura_atual,
          cartao_vacina_em_dia, vacinas_em_atraso, consulta_acompanhamento_em_dia,
          proxima_consulta, frequenta_escola, nome_escola, observacoes, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateUUID(), prontuarioId,
          data.is_crianca ? 1 : 0, data.peso_atual ?? null, data.altura_atual ?? null,
          data.cartao_vacina_em_dia ? 1 : 0, data.vacinas_em_atraso ?? null,
          data.consulta_acompanhamento_em_dia ? 1 : 0, data.proxima_consulta ?? null,
          data.frequenta_escola ? 1 : 0, data.nome_escola ?? null,
          data.observacoes ?? null, now,
        ]
      );
    }

    await this.incrementarVersao(prontuarioId);
    await syncQueueRepository.enqueue('prontuario_puericultura', 'update', prontuarioId, data);
  },

  // ============================================================
  // MULHER
  // ============================================================
  async obterMulher(prontuarioId: string): Promise<ProntuarioMulher | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuario_mulher WHERE prontuario_id = ?`,
      [prontuarioId]
    );
    return row ? mapMulher(row) : null;
  },

  async salvarMulher(prontuarioId: string, data: Partial<ProntuarioMulher>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    const existing = await this.obterMulher(prontuarioId);

    if (existing) {
      await db.runAsync(
        `UPDATE prontuario_mulher SET
          ultima_menstruacao = COALESCE(?, ultima_menstruacao),
          papanicolau_em_dia = COALESCE(?, papanicolau_em_dia),
          data_ultimo_papanicolau = COALESCE(?, data_ultimo_papanicolau),
          mamografia_em_dia = COALESCE(?, mamografia_em_dia),
          data_ultima_mamografia = COALESCE(?, data_ultima_mamografia),
          usa_anticoncepcional = COALESCE(?, usa_anticoncepcional),
          tipo_anticoncepcional = COALESCE(?, tipo_anticoncepcional),
          consulta_ginecologica_em_dia = COALESCE(?, consulta_ginecologica_em_dia),
          prevencao_dts = COALESCE(?, prevencao_dts),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE prontuario_id = ?`,
        [
          data.ultima_menstruacao ?? null,
          boolOrNull(data.papanicolau_em_dia), data.data_ultimo_papanicolau ?? null,
          boolOrNull(data.mamografia_em_dia), data.data_ultima_mamografia ?? null,
          boolOrNull(data.usa_anticoncepcional), data.tipo_anticoncepcional ?? null,
          boolOrNull(data.consulta_ginecologica_em_dia), boolOrNull(data.prevencao_dts),
          data.observacoes ?? null, now, prontuarioId,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO prontuario_mulher (
          id, prontuario_id, ultima_menstruacao, papanicolau_em_dia, data_ultimo_papanicolau,
          mamografia_em_dia, data_ultima_mamografia, usa_anticoncepcional, tipo_anticoncepcional,
          consulta_ginecologica_em_dia, prevencao_dts, observacoes, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateUUID(), prontuarioId,
          data.ultima_menstruacao ?? null,
          data.papanicolau_em_dia ? 1 : 0, data.data_ultimo_papanicolau ?? null,
          data.mamografia_em_dia ? 1 : 0, data.data_ultima_mamografia ?? null,
          data.usa_anticoncepcional ? 1 : 0, data.tipo_anticoncepcional ?? null,
          data.consulta_ginecologica_em_dia ? 1 : 0, data.prevencao_dts ? 1 : 0,
          data.observacoes ?? null, now,
        ]
      );
    }

    await this.incrementarVersao(prontuarioId);
    await syncQueueRepository.enqueue('prontuario_mulher', 'update', prontuarioId, data);
  },

  // ============================================================
  // SOCIAL
  // ============================================================
  async obterSocial(prontuarioId: string): Promise<ProntuarioSocial | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM prontuario_social WHERE prontuario_id = ?`,
      [prontuarioId]
    );
    return row ? mapSocial(row) : null;
  },

  async salvarSocial(prontuarioId: string, data: Partial<ProntuarioSocial>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    const existing = await this.obterSocial(prontuarioId);

    if (existing) {
      await db.runAsync(
        `UPDATE prontuario_social SET
          vulnerabilidade_social = COALESCE(?, vulnerabilidade_social),
          descricao_vulnerabilidade = COALESCE(?, descricao_vulnerabilidade),
          negligencia_parental = COALESCE(?, negligencia_parental),
          descricao_negligencia = COALESCE(?, descricao_negligencia),
          violencia_domestica = COALESCE(?, violencia_domestica),
          descricao_violencia = COALESCE(?, descricao_violencia),
          depressao_suspeita = COALESCE(?, depressao_suspeita),
          uso_alcool_drogas = COALESCE(?, uso_alcool_drogas),
          descricao_uso = COALESCE(?, descricao_uso),
          encaminhado_assistente_social = COALESCE(?, encaminhado_assistente_social),
          data_encaminhamento = COALESCE(?, data_encaminhamento),
          observacoes = COALESCE(?, observacoes),
          updated_at = ?
        WHERE prontuario_id = ?`,
        [
          data.vulnerabilidade_social ?? null, data.descricao_vulnerabilidade ?? null,
          boolOrNull(data.negligencia_parental), data.descricao_negligencia ?? null,
          boolOrNull(data.violencia_domestica), data.descricao_violencia ?? null,
          boolOrNull(data.depressao_suspeita), boolOrNull(data.uso_alcool_drogas),
          data.descricao_uso ?? null,
          boolOrNull(data.encaminhado_assistente_social), data.data_encaminhamento ?? null,
          data.observacoes ?? null, now, prontuarioId,
        ]
      );
    } else {
      await db.runAsync(
        `INSERT INTO prontuario_social (
          id, prontuario_id, vulnerabilidade_social, descricao_vulnerabilidade,
          negligencia_parental, descricao_negligencia, violencia_domestica, descricao_violencia,
          depressao_suspeita, uso_alcool_drogas, descricao_uso,
          encaminhado_assistente_social, data_encaminhamento, observacoes, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateUUID(), prontuarioId,
          data.vulnerabilidade_social ?? 'nenhum', data.descricao_vulnerabilidade ?? null,
          data.negligencia_parental ? 1 : 0, data.descricao_negligencia ?? null,
          data.violencia_domestica ? 1 : 0, data.descricao_violencia ?? null,
          data.depressao_suspeita ? 1 : 0, data.uso_alcool_drogas ? 1 : 0,
          data.descricao_uso ?? null,
          data.encaminhado_assistente_social ? 1 : 0, data.data_encaminhamento ?? null,
          data.observacoes ?? null, now,
        ]
      );
    }

    await this.incrementarVersao(prontuarioId);
    await syncQueueRepository.enqueue('prontuario_social', 'update', prontuarioId, data);
  },
};

// ============================================================
// HELPERS
// ============================================================

function boolOrNull(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

function mapProntuario(row: Record<string, unknown>): Prontuario {
  return {
    id: row.id as string,
    morador_id: row.morador_id as string,
    agente_id: row.agente_id as string,
    versao: row.versao as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    status_sync: row.status_sync as StatusSync,
  };
}

function mapSaude(row: Record<string, unknown>): ProntuarioSaude {
  return {
    id: row.id as string,
    prontuario_id: row.prontuario_id as string,
    is_hipertenso: Boolean(row.is_hipertenso),
    is_diabetico: Boolean(row.is_diabetico),
    is_domiciliado: Boolean(row.is_domiciliado),
    is_tuberculose: Boolean(row.is_tuberculose),
    is_hanseniase: Boolean(row.is_hanseniase),
    hgt_ultima_aferição: row.hgt_ultima_afericao as string | undefined,
    hgt_valor: row.hgt_valor as string | undefined,
    pa_ultima_aferição: row.pa_ultima_afericao as string | undefined,
    pa_valor: row.pa_valor as string | undefined,
    tem_receita_atualizada: Boolean(row.tem_receita_atualizada),
    ultima_consulta: row.ultima_consulta as string | undefined,
    proxima_consulta: row.proxima_consulta as string | undefined,
    precisa_agendamento: Boolean(row.precisa_agendamento),
    especialidade_agendamento: row.especialidade_agendamento as string | undefined,
    queixas: row.queixas as string | undefined,
    observacoes: row.observacoes as string | undefined,
    updated_at: row.updated_at as string,
  };
}

function mapGestante(row: Record<string, unknown>): ProntuarioGestante {
  return {
    id: row.id as string,
    prontuario_id: row.prontuario_id as string,
    is_gestante: Boolean(row.is_gestante),
    data_dum: row.data_dum as string | undefined,
    semanas_gestacao: row.semanas_gestacao as number | undefined,
    pre_natal_em_dia: Boolean(row.pre_natal_em_dia),
    local_pre_natal: row.local_pre_natal as string | undefined,
    proxima_consulta_pre_natal: row.proxima_consulta_pre_natal as string | undefined,
    vacina_tetano_em_dia: Boolean(row.vacina_tetano_em_dia),
    vacina_hepatiteb_em_dia: Boolean(row.vacina_hepatiteb_em_dia),
    sulfato_ferroso: Boolean(row.sulfato_ferroso),
    acido_folico: Boolean(row.acido_folico),
    observacoes: row.observacoes as string | undefined,
    updated_at: row.updated_at as string,
  };
}

function mapPuericultura(row: Record<string, unknown>): ProntuarioPuericultura {
  return {
    id: row.id as string,
    prontuario_id: row.prontuario_id as string,
    is_crianca: Boolean(row.is_crianca),
    peso_atual: row.peso_atual as string | undefined,
    altura_atual: row.altura_atual as string | undefined,
    cartao_vacina_em_dia: Boolean(row.cartao_vacina_em_dia),
    vacinas_em_atraso: row.vacinas_em_atraso as string | undefined,
    consulta_acompanhamento_em_dia: Boolean(row.consulta_acompanhamento_em_dia),
    proxima_consulta: row.proxima_consulta as string | undefined,
    frequenta_escola: Boolean(row.frequenta_escola),
    nome_escola: row.nome_escola as string | undefined,
    observacoes: row.observacoes as string | undefined,
    updated_at: row.updated_at as string,
  };
}

function mapMulher(row: Record<string, unknown>): ProntuarioMulher {
  return {
    id: row.id as string,
    prontuario_id: row.prontuario_id as string,
    ultima_menstruacao: row.ultima_menstruacao as string | undefined,
    papanicolau_em_dia: Boolean(row.papanicolau_em_dia),
    data_ultimo_papanicolau: row.data_ultimo_papanicolau as string | undefined,
    mamografia_em_dia: Boolean(row.mamografia_em_dia),
    data_ultima_mamografia: row.data_ultima_mamografia as string | undefined,
    usa_anticoncepcional: Boolean(row.usa_anticoncepcional),
    tipo_anticoncepcional: row.tipo_anticoncepcional as string | undefined,
    consulta_ginecologica_em_dia: Boolean(row.consulta_ginecologica_em_dia),
    prevencao_dts: Boolean(row.prevencao_dts),
    observacoes: row.observacoes as string | undefined,
    updated_at: row.updated_at as string,
  };
}

function mapSocial(row: Record<string, unknown>): ProntuarioSocial {
  return {
    id: row.id as string,
    prontuario_id: row.prontuario_id as string,
    vulnerabilidade_social: row.vulnerabilidade_social as ProntuarioSocial['vulnerabilidade_social'],
    descricao_vulnerabilidade: row.descricao_vulnerabilidade as string | undefined,
    negligencia_parental: Boolean(row.negligencia_parental),
    descricao_negligencia: row.descricao_negligencia as string | undefined,
    violencia_domestica: Boolean(row.violencia_domestica),
    descricao_violencia: row.descricao_violencia as string | undefined,
    depressao_suspeita: Boolean(row.depressao_suspeita),
    uso_alcool_drogas: Boolean(row.uso_alcool_drogas),
    descricao_uso: row.descricao_uso as string | undefined,
    encaminhado_assistente_social: Boolean(row.encaminhado_assistente_social),
    data_encaminhamento: row.data_encaminhamento as string | undefined,
    observacoes: row.observacoes as string | undefined,
    updated_at: row.updated_at as string,
  };
}
