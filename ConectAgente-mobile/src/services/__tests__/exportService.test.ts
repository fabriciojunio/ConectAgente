/**
 * Testes para exportService
 */
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///documents/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    json_to_sheet: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
    sheet_to_csv: jest.fn(() => 'col1;col2\nval1;val2'),
  },
  write: jest.fn(() => 'base64-xlsx-content'),
}));

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportService } from '../exportService';
import { Visita } from '../../types';

const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;
const mockedFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

const visitasMock: Visita[] = [
  {
    id: 'v1',
    agente_id: 'a1',
    residencia_id: 'r1',
    morador_id: null,
    data_visita: '2024-03-15T10:00:00.000Z',
    status: 'realizada',
    queixas: 'Dor de cabeça',
    observacoes: 'Paciente bem',
    precisa_agendamento: false,
    especialidade_agendamento: null,
    created_at: '2024-03-15T10:00:00.000Z',
    updated_at: '2024-03-15T10:00:00.000Z',
    sync_status: 'sincronizado',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedSharing.isAvailableAsync.mockResolvedValue(true);
  mockedSharing.shareAsync.mockResolvedValue(undefined);
  (mockedFileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
});

describe('exportService.exportarVisitas - CSV', () => {
  it('gera arquivo CSV e compartilha', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    expect(mockedFileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(mockedSharing.shareAsync).toHaveBeenCalled();
  });

  it('nome do arquivo CSV inclui data de referência e termina em .csv', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'mes', data_referencia: '2024-03-15' },
      'csv'
    );

    const writeCall = (mockedFileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(writeCall[0]).toContain('2024-03-15');
    expect(writeCall[0]).toContain('.csv');
  });

  it('conteúdo CSV não está vazio', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    const writeCall = (mockedFileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(writeCall[1]).toBeTruthy();
  });
});

describe('exportService.exportarVisitas - Excel', () => {
  it('gera arquivo Excel (.xlsx) e compartilha', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'semana', data_referencia: '2024-03-15' },
      'xlsx'
    );

    expect(mockedFileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(mockedSharing.shareAsync).toHaveBeenCalled();
  });

  it('nome do arquivo Excel termina com .xlsx', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'semana', data_referencia: '2024-03-15' },
      'xlsx'
    );

    const writeCall = (mockedFileSystem.writeAsStringAsync as jest.Mock).mock.calls[0];
    expect(writeCall[0]).toContain('.xlsx');
  });
});

describe('exportService.exportarVisitas - erros', () => {
  it('lança erro quando compartilhamento não disponível', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValue(false);

    await expect(
      exportService.exportarVisitas(
        { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
        'csv'
      )
    ).rejects.toThrow('Compartilhamento não disponível');
  });

  it('lança erro quando lista de visitas vazia', async () => {
    await expect(
      exportService.exportarVisitas(
        { visitas: [], periodo: 'dia', data_referencia: '2024-03-15' },
        'csv'
      )
    ).rejects.toThrow('Sem dados');
  });
});
