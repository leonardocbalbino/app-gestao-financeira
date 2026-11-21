import { formatBRL, type Cents } from '@app/shared';
import { AppText, type AppTextProps } from './AppText';

interface Props extends Omit<AppTextProps, 'children' | 'tabular'> {
  cents: Cents;
  /** "+" em positivos e cor por sinal (receita verde / despesa laranja). */
  signed?: boolean;
  /** Força tom: income = primary, expense = danger. */
  tone?: 'income' | 'expense' | 'neutral';
  hidden?: boolean;
}

/** Valor monetário em BRL com números tabulares e menos tipográfico. */
export function MoneyText({ cents, signed, tone, hidden, color, ...rest }: Props) {
  const resolvedTone = tone ?? (signed ? (cents >= 0 ? 'income' : 'expense') : 'neutral');
  const resolvedColor =
    color ??
    (resolvedTone === 'income' ? 'primary' : resolvedTone === 'expense' ? 'danger' : 'ink');
  const text = hidden ? 'R$ ••••' : formatBRL(cents, { signed });
  return (
    <AppText
      tabular
      color={resolvedColor}
      accessibilityLabel={hidden ? 'Valor oculto' : text.replace('−', 'menos ')}
      {...rest}
    >
      {text}
    </AppText>
  );
}
