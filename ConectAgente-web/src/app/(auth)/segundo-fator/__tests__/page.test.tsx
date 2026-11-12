import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SegundoFatorPage from '../page';

const mockMfa = {
  listFactors: jest.fn(),
  unenroll: jest.fn(),
  enroll: jest.fn(),
  challengeAndVerify: jest.fn(),
};
const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { mfa: mockMfa, signOut: () => mockSignOut() } }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const replace = jest.fn();
beforeAll(() => {
  Object.defineProperty(window, 'location', { value: { replace }, writable: true });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMfa.unenroll.mockResolvedValue({ data: {}, error: null });
});

function semFator(extras: object[] = []) {
  mockMfa.listFactors.mockResolvedValue({ data: { totp: [], all: extras }, error: null });
  mockMfa.enroll.mockResolvedValue({
    data: { id: 'f-novo', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SEGREDO123', uri: '' } },
    error: null,
  });
}

describe('tela do segundo fator', () => {
  it('conta sem autenticador vê o QR code e a chave para cadastrar', async () => {
    semFator();
    render(<SegundoFatorPage />);
    expect(await screen.findByAltText('QR code para cadastrar o autenticador')).toBeInTheDocument();
    expect(screen.getByText('SEGREDO123')).toBeInTheDocument();
    expect(mockMfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'ConectAgente' });
  });

  it('cadastro que ficou pela metade é desfeito antes de começar outro', async () => {
    semFator([{ id: 'f-velho', status: 'unverified' }, { id: 'f-ok', status: 'verified', factor_type: 'phone' }]);
    render(<SegundoFatorPage />);
    await screen.findByText('SEGREDO123');
    expect(mockMfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mockMfa.unenroll).toHaveBeenCalledWith({ factorId: 'f-velho' });
  });

  it('conta com autenticador só digita o código, sem cadastrar outro', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    render(<SegundoFatorPage />);
    expect(await screen.findByText(/Digite o código de 6 números/)).toBeInTheDocument();
    expect(mockMfa.enroll).not.toHaveBeenCalled();
  });

  it('código com formato errado nem vai ao servidor', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    render(<SegundoFatorPage />);
    const campo = await screen.findByLabelText('Código do autenticador');
    fireEvent.change(campo, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Digite os 6 números');
    expect(mockMfa.challengeAndVerify).not.toHaveBeenCalled();
  });

  it('o campo aceita só números', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    render(<SegundoFatorPage />);
    const campo = (await screen.findByLabelText('Código do autenticador')) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '12a34 5678' } });
    expect(campo.value).toBe('123456');
  });

  it('código certo entra no painel', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    mockMfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    render(<SegundoFatorPage />);
    fireEvent.change(await screen.findByLabelText('Código do autenticador'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f-1', code: '123456' });
  });

  it('código errado avisa e limpa o campo', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    mockMfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } });
    render(<SegundoFatorPage />);
    const campo = (await screen.findByLabelText('Código do autenticador')) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou vencido');
    expect(campo.value).toBe('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('falha ao listar os fatores mostra erro em vez de liberar', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: null, error: { message: 'rede' } });
    render(<SegundoFatorPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar');
    expect(screen.queryByLabelText('Código do autenticador')).not.toBeInTheDocument();
  });

  it('dá para sair e entrar com outra conta', async () => {
    mockMfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f-1' }], all: [] }, error: null });
    mockSignOut.mockResolvedValue({});
    render(<SegundoFatorPage />);
    fireEvent.click(await screen.findByText('Sair e entrar com outra conta'));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });
});
