import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { CartaoDoMedicamento, FormularioDoMedicamento } from '../componentes';
import type { Medicamento } from '../../../database/repositories/medicamentoRepository';

const base: Medicamento = {
  id: 'm1', morador_id: 'mor', agente_id: 'ag', nome: 'Losartana', dosagem: '50 mg', frequencia: '8h e 20h',
  problemas_uso: 'esquece,armazenamento', duvida: null, duvida_respondida: false, resposta_medico: null,
  respondido_por: null, data_resposta: null, created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z',
};

describe('CartaoDoMedicamento', () => {
  it('mostra nome, dose, horário e os problemas observados', () => {
    const { getByText } = render(<CartaoDoMedicamento medicamento={base} onResponder={jest.fn()} onRemover={jest.fn()} />);
    expect(getByText('Losartana')).toBeTruthy();
    expect(getByText('50 mg • 8h e 20h')).toBeTruthy();
    expect(getByText('Esquece de tomar')).toBeTruthy();
    expect(getByText('Guarda em local inadequado')).toBeTruthy();
  });

  it('dúvida pendente permite registrar a resposta, que exige quem respondeu', async () => {
    const onResponder = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText, queryByText } = render(
      <CartaoDoMedicamento medicamento={{ ...base, duvida: 'Pode tomar à noite?' }} onResponder={onResponder} onRemover={jest.fn()} />
    );
    expect(getByText('Aguardando resposta da equipe')).toBeTruthy();

    fireEvent.press(getByText('Registrar resposta da equipe'));
    fireEvent.changeText(getByPlaceholderText('Anote a orientação como a equipe passou, sem nome'), 'Pode, após o jantar.');
    fireEvent.press(getByText('Salvar resposta'));
    await waitFor(() => expect(getByText('Escolha quem respondeu')).toBeTruthy());
    expect(onResponder).not.toHaveBeenCalled();

    fireEvent.press(getByText('Enfermeiro(a)'));
    fireEvent.press(getByText('Salvar resposta'));
    await waitFor(() => expect(onResponder).toHaveBeenCalledWith({ respondido_por: 'enfermeiro', resposta: 'Pode, após o jantar.' }));
    await waitFor(() => expect(queryByText('Salvar resposta')).toBeNull());
  });

  it('dúvida respondida mostra quem respondeu e a resposta, sem botão de responder', () => {
    const respondida = {
      ...base, duvida: 'Pode tomar à noite?', duvida_respondida: true,
      resposta_medico: 'Pode, após o jantar.', respondido_por: 'farmaceutico', data_resposta: '2026-11-11T15:00:00Z',
    };
    const { getByText, queryByText } = render(
      <CartaoDoMedicamento medicamento={respondida} onResponder={jest.fn()} onRemover={jest.fn()} />
    );
    expect(getByText('Dúvida respondida')).toBeTruthy();
    expect(getByText(/Farmacêutico\(a\) em/)).toBeTruthy();
    expect(getByText('Pode, após o jantar.')).toBeTruthy();
    expect(queryByText('Registrar resposta da equipe')).toBeNull();
  });

  it('o lixo pede a remoção', () => {
    const onRemover = jest.fn();
    const { getByLabelText } = render(<CartaoDoMedicamento medicamento={base} onResponder={jest.fn()} onRemover={onRemover} />);
    fireEvent.press(getByLabelText('Remover Losartana'));
    expect(onRemover).toHaveBeenCalled();
  });
});

describe('FormularioDoMedicamento', () => {
  it('não salva sem nome', async () => {
    const onSalvar = jest.fn();
    const { getByText } = render(<FormularioDoMedicamento onSalvar={onSalvar} onCancelar={jest.fn()} />);
    fireEvent.press(getByText('Salvar'));
    await waitFor(() => expect(getByText('Informe o nome do medicamento')).toBeTruthy());
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('salva com os problemas marcados e desmarca ao tocar de novo', async () => {
    const onSalvar = jest.fn().mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText } = render(<FormularioDoMedicamento onSalvar={onSalvar} onCancelar={jest.fn()} />);
    fireEvent.changeText(getByPlaceholderText('Ex: Losartana'), 'Metformina');
    fireEvent.press(getByText('Automedicação'));
    fireEvent.press(getByText('Esquece de tomar'));
    fireEvent.press(getByText('Automedicação'));
    fireEvent.press(getByText('Salvar'));
    await waitFor(() => expect(onSalvar).toHaveBeenCalled());
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ nome: 'Metformina' });
    expect(onSalvar.mock.calls[0][1]).toEqual(['esquece']);
  });

  it('cancelar avisa a tela', () => {
    const onCancelar = jest.fn();
    const { getByText } = render(<FormularioDoMedicamento onSalvar={jest.fn()} onCancelar={onCancelar} />);
    fireEvent.press(getByText('Cancelar'));
    expect(onCancelar).toHaveBeenCalled();
  });
});
