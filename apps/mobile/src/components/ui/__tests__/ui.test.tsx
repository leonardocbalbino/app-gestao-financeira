import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Button, Chip, EmptyState, MoneyText, ProgressBar } from '@/components/ui';

const wrap = (ui: ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('MoneyText', () => {
  it('formata BRL com menos tipográfico e rótulo acessível', async () => {
    await wrap(<MoneyText cents={-123456} />);
    expect(screen.getByText('−R$ 1.234,56')).toBeTruthy();
    expect(screen.getByLabelText('menos R$ 1.234,56')).toBeTruthy();
  });

  it('oculta o valor quando hidden', async () => {
    await wrap(<MoneyText cents={5000} hidden />);
    expect(screen.getByLabelText('Valor oculto')).toBeTruthy();
  });
});

describe('Button', () => {
  it('dispara onPress e expõe role', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Salvar" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('não dispara quando desabilitado', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Salvar" onPress={onPress} disabled />);
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('informa estado selecionado', async () => {
    await wrap(<Chip label="Despesa" selected onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Despesa' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

describe('ProgressBar', () => {
  it('expõe valor acessível', async () => {
    await wrap(<ProgressBar value={0.42} accessibilityLabel="Alimentação" />);
    expect(screen.getByLabelText('Alimentação').props.accessibilityValue).toMatchObject({
      now: 42,
    });
  });
});

describe('EmptyState', () => {
  it('renderiza ação', async () => {
    const onAction = jest.fn();
    await wrap(
      <EmptyState
        icon="receipt"
        title="Vazio"
        message="Nada aqui"
        actionLabel="Adicionar"
        onAction={onAction}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onAction).toHaveBeenCalled();
  });
});
