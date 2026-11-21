import { memo } from 'react';
import { formatBRL, formatShortDate } from '@app/shared';
import type { TransactionListItem } from '@/data/repositories/transactions';
import { IconBadge, ListItem, MoneyText } from '@/components/ui';

interface Props {
  item: TransactionListItem;
  onPress?: (id: string) => void;
  showDate?: boolean;
  divider?: boolean;
  hideAmount?: boolean;
}

const KIND_LABEL = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' } as const;

export const TransactionRow = memo(function TransactionRow({
  item,
  onPress,
  showDate,
  divider,
  hideAmount,
}: Props) {
  const isTransfer = item.kind === 'transfer';
  const title = item.description || item.categoryName || KIND_LABEL[item.kind];
  const subtitleParts = [
    isTransfer ? 'Transferência' : item.categoryName,
    item.accountName,
    showDate ? formatShortDate(item.date) : null,
  ].filter(Boolean);
  const signed = item.kind === 'expense' ? -item.amountCents : item.amountCents;
  return (
    <ListItem
      testID={`tx-${item.id}`}
      title={title}
      subtitle={subtitleParts.join(' · ')}
      divider={divider}
      onPress={onPress ? () => onPress(item.id) : undefined}
      accessibilityLabel={`${title}, ${KIND_LABEL[item.kind]}, ${formatBRL(item.amountCents)}, ${formatShortDate(item.date)}`}
      left={
        <IconBadge
          name={isTransfer ? 'arrow-left-right' : (item.categoryIcon ?? 'circle-ellipsis')}
          tint={isTransfer ? undefined : (item.categoryColor ?? undefined)}
        />
      }
      right={
        <MoneyText
          cents={isTransfer ? item.amountCents : signed}
          signed={!isTransfer}
          tone={isTransfer ? 'neutral' : undefined}
          variant="bodyStrong"
          hidden={hideAmount}
        />
      }
    />
  );
});
