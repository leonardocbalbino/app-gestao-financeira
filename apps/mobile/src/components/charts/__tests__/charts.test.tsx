import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { IncomeExpenseBars, niceMax } from '../IncomeExpenseBars';
import { arcPath, DonutChart } from '../DonutChart';

describe('niceMax', () => {
  it.each([
    [0, 100],
    [87, 100],
    [130, 200],
    [240, 250],
    [410, 500],
    [7200, 10000],
  ])('%d → %d', (v, e) => expect(niceMax(v)).toBe(e));
});

describe('arcPath', () => {
  it('gera caminho fechado', () => {
    const d = arcPath(50, 50, 40, 20, 0, 90);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('IncomeExpenseBars', () => {
  it('cada mês é tocável e descreve valores', async () => {
    await render(
      <ThemeProvider>
        <IncomeExpenseBars
          width={320}
          data={[
            { month: '2026-10', incomeCents: 500000, expenseCents: 320000 },
            { month: '2026-11', incomeCents: 510000, expenseCents: 410000 },
          ]}
        />
      </ThemeProvider>,
    );
    const oct = screen.getByLabelText('Outubro 2026: entradas R$ 5.000,00, saídas R$ 3.200,00');
    await fireEvent.press(oct);
    expect(screen.getByText('Entradas R$ 5.000,00')).toBeTruthy();
  });
});

describe('DonutChart', () => {
  it('expõe descrição acessível', async () => {
    await render(
      <ThemeProvider>
        <DonutChart
          accessibilityLabel="Gastos: Alimentação 60%, Lazer 40%"
          segments={[
            { key: 'a', label: 'Alimentação', value: 60, color: '#0B6E4F' },
            { key: 'b', label: 'Lazer', value: 40, color: '#F3C49B' },
          ]}
        />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('Gastos: Alimentação 60%, Lazer 40%')).toBeTruthy();
  });
});
