import { monthlyInsights } from '../insights';

const cat = (categoryId: string, name: string, totalCents: number) => ({
  categoryId,
  name,
  icon: 'utensils',
  color: '#000000',
  totalCents,
});

describe('monthlyInsights', () => {
  it('taxa de poupança, maior gasto e maior aumento', () => {
    const res = monthlyInsights(
      { incomeCents: 500000, expenseCents: 300000, netCents: 200000, count: 10 },
      { incomeCents: 500000, expenseCents: 250000, netCents: 250000, count: 8 },
      [cat('a', 'Alimentação', 150000), cat('b', 'Lazer', 90000)],
      [cat('a', 'Alimentação', 140000), cat('b', 'Lazer', 40000)],
    );
    expect(res.map((i) => i.text)).toEqual([
      'Você guardou 40% do que recebeu este mês.',
      'Alimentação foi seu maior gasto: 50% das despesas.',
      'Lazer subiu R$ 500,00 em relação ao mês anterior.',
    ]);
  });

  it('gasto acima da renda e queda de gastos', () => {
    const res = monthlyInsights(
      { incomeCents: 100000, expenseCents: 150000, netCents: -50000, count: 3 },
      { incomeCents: 0, expenseCents: 200000, netCents: -200000, count: 3 },
      [],
      [],
    );
    expect(res.map((i) => i.id)).toEqual(['savings', 'decrease']);
    expect(res[0]?.text).toBe('Você gastou R$ 500,00 a mais do que recebeu.');
  });
});
