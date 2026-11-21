import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import { monthRange, type MonthKey } from '@app/shared';
import type { AppDB } from '@/data/db';
import {
  listTransactions,
  monthSummary,
  spendingByCategory,
} from '@/data/repositories/transactions';
import { monthlyReportHtml, transactionsToCsv } from './formats';

/** Gera o PDF do mês no aparelho e abre o compartilhamento do sistema. */
export async function exportMonthlyPdf(db: AppDB, month: MonthKey): Promise<void> {
  const html = monthlyReportHtml({
    month,
    summary: monthSummary(db, month),
    byCategory: spendingByCategory(db, month),
    transactions: listTransactions(db, { month, limit: 2000 }),
  });
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Compartilhar relatório',
  });
}

/** Exporta as transações do mês em CSV (abre no Excel/Planilhas). */
export async function exportMonthCsv(db: AppDB, month: MonthKey): Promise<void> {
  const r = monthRange(month);
  const csv = transactionsToCsv(listTransactions(db, { from: r.start, to: r.end, limit: 10_000 }));
  const uri = `${cacheDirectory}transacoes-${month}.csv`;
  await writeAsStringAsync(uri, csv, { encoding: EncodingType.UTF8 });
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Exportar transações',
  });
}
