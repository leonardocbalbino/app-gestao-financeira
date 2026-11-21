import type { TransactionListItem } from '@/data/repositories/transactions';
import { csvAmount, csvDate, escapeHtml, monthlyReportHtml, transactionsToCsv } from '../formats';

const tx = (p: Partial<TransactionListItem>) =>
  ({
    id: '1',
    kind: 'expense',
    amountCents: 123456,
    description: 'Mercado',
    categoryName: 'Alimentação',
    accountName: 'Carteira',
    date: '2026-11-21',
    notes: null,
    ...p,
  }) as TransactionListItem;

describe('CSV', () => {
  it('valores e datas no formato brasileiro', () => {
    expect(csvAmount(-123456)).toBe('-1234,56');
    expect(csvAmount(5)).toBe('0,05');
    expect(csvDate('2026-11-21')).toBe('21/11/2026');
  });

  it('cabeçalho, BOM, separador e escape', () => {
    const csv = transactionsToCsv([
      tx({}),
      tx({
        id: '2',
        kind: 'income',
        amountCents: 500000,
        description: 'Salário; extra',
        categoryName: 'Receita',
      }),
      tx({ id: '3', description: '=HYPERLINK("x")' }),
    ]);
    const lines = csv.slice(1).split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(lines[0]).toBe('Data;Tipo;Descrição;Categoria;Conta;Valor (R$);Observações');
    expect(lines[1]).toBe('21/11/2026;Despesa;Mercado;Alimentação;Carteira;-1234,56;');
    expect(lines[2]).toBe('21/11/2026;Receita;"Salário; extra";Receita;Carteira;5000,00;');
    expect(lines[3]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});

describe('Relatório PDF (HTML)', () => {
  it('contém resumo, categorias e escapa conteúdo do usuário', () => {
    const html = monthlyReportHtml({
      month: '2026-11',
      summary: { incomeCents: 500000, expenseCents: 123456, netCents: 376544, count: 2 },
      byCategory: [
        {
          categoryId: 'a',
          name: 'Alimentação',
          icon: 'utensils',
          color: '#0B6E4F',
          totalCents: 123456,
        },
      ],
      transactions: [tx({ description: '<script>alert(1)</script>' })],
      generatedAt: new Date(2026, 10, 21),
    });
    expect(html).toContain('Relatório de Novembro 2026');
    expect(html).toContain('R$ 5.000,00');
    expect(html).toContain('−R$ 1.234,56');
    expect(html).toContain('100%');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapeHtml', () => {
    expect(escapeHtml(`a&b"<'>`)).toBe('a&amp;b&quot;&lt;&#39;&gt;');
  });
});
