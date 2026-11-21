import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import {
  addDays,
  formatBRL,
  formatRelativeDay,
  formatShortDate,
  toISODate,
  type Recurrence,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  ListItem,
  MoneyText,
  Screen,
  SectionHeader,
  TextField,
} from '@/components/ui';
import { MoneyField } from '@/components/ui/MoneyField';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  useAccounts,
  useCreateBill,
  useDeleteBill,
  useOpenBills,
  usePaidBills,
  usePayBill,
} from '@/data/hooks';
import type { BillStatus, BillWithStatus } from '@/data/repositories/bills';

const STATUS_LABEL: Record<BillStatus, string> = {
  overdue: 'Atrasada',
  due_soon: 'Vence em breve',
  upcoming: 'Em dia',
  paid: 'Paga',
};

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Única' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

export default function BillsScreen() {
  const t = useTheme();
  const open = useOpenBills();
  const paid = usePaidBills();
  const accounts = useAccounts();
  const create = useCreateBill();
  const pay = usePayBill();
  const remove = useDeleteBill();
  const today = toISODate(new Date());

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(0);
  const [due, setDue] = useState(addDays(today, 7));
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [remind, setRemind] = useState(true);
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!name.trim()) return setError('Informe o nome');
    if (amount <= 0) return setError('Informe o valor');
    await create.mutateAsync({
      input: {
        name,
        amountCents: amount,
        dueDate: due,
        categoryId: null,
        recurrence,
        remindDaysBefore: 1,
      },
      remind,
    });
    setAdding(false);
    setName('');
    setAmount(0);
    setError(undefined);
  };

  const onPay = (b: BillWithStatus) => {
    const acc = accounts.data?.[0];
    Alert.alert(
      `Pagar "${b.name}"?`,
      `${formatBRL(b.amountCents)} será lançado como despesa${acc ? ` em ${acc.name}` : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Só marcar como paga', onPress: () => pay.mutate({ id: b.id, remind }) },
        {
          text: 'Pagar e lançar',
          onPress: () => pay.mutate({ id: b.id, accountId: acc?.id, remind }),
        },
      ],
    );
  };

  const list = open.data ?? [];
  const totalOpen = list.reduce((s, b) => s + b.amountCents, 0);

  return (
    <Screen testID="screen-bills">
      <ScreenHeader title="Contas a pagar" />
      <Card>
        <AppText variant="caption" color="inkMuted">
          Total em aberto
        </AppText>
        <MoneyText cents={totalOpen} variant="title" />
        <AppText variant="caption" color="inkMuted">
          {list.filter((b) => b.status === 'overdue').length} atrasada(s) · {list.length} em aberto
        </AppText>
      </Card>

      {adding ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <TextField
              label="Nome"
              placeholder="Ex.: Aluguel"
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
            <MoneyField label="Valor" value={amount} onChange={setAmount} />
            <View style={{ gap: t.spacing.sm }}>
              <AppText variant="caption" color="inkMuted" weight="semibold">
                Vencimento: {formatRelativeDay(due)}
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                <Chip label="−1 dia" onPress={() => setDue(addDays(due, -1))} />
                <Chip label="+1 dia" onPress={() => setDue(addDays(due, 1))} />
                <Chip label="+1 semana" onPress={() => setDue(addDays(due, 7))} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {RECURRENCES.map((r) => (
                <Chip
                  key={r.value}
                  label={r.label}
                  selected={recurrence === r.value}
                  onPress={() => setRecurrence(r.value)}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText variant="bodyStrong">Lembrar 1 dia antes</AppText>
              <Switch
                accessibilityLabel="Lembrar 1 dia antes"
                value={remind}
                onValueChange={setRemind}
                trackColor={{ true: t.colors.primary, false: t.colors.chipBorder }}
              />
            </View>
            {error ? (
              <AppText variant="caption" color="danger" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <Button label="Salvar conta" onPress={save} loading={create.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <Button
          label="Adicionar conta a pagar"
          variant="secondary"
          onPress={() => setAdding(true)}
        />
      )}

      <SectionHeader title="Em aberto" />
      <Card padding={t.spacing.md}>
        {list.length === 0 ? (
          <EmptyState
            icon="calendar-clock"
            title="Tudo em dia"
            message="Nenhuma conta em aberto."
          />
        ) : (
          list.map((b, i) => (
            <ListItem
              key={b.id}
              title={b.name}
              subtitle={`${STATUS_LABEL[b.status]} · ${formatRelativeDay(b.dueDate)}`}
              divider={i < list.length - 1}
              onPress={() => onPay(b)}
              onLongPress={() =>
                Alert.alert(`Excluir "${b.name}"?`, undefined, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: () => remove.mutate(b.id) },
                ])
              }
              left={
                <IconBadge
                  name="calendar-clock"
                  tint={
                    b.status === 'overdue'
                      ? t.colors.danger
                      : b.status === 'due_soon'
                        ? t.colors.pro
                        : t.colors.primary
                  }
                />
              }
              right={
                <MoneyText
                  cents={b.amountCents}
                  variant="bodyStrong"
                  color={b.status === 'overdue' ? 'danger' : 'ink'}
                />
              }
              accessibilityLabel={`${b.name}, ${formatBRL(b.amountCents)}, ${STATUS_LABEL[b.status]}, vence ${formatShortDate(b.dueDate)}. Toque para pagar`}
            />
          ))
        )}
      </Card>

      {(paid.data ?? []).length > 0 ? (
        <>
          <SectionHeader title="Pagas recentemente" />
          <Card padding={t.spacing.md}>
            {(paid.data ?? []).map((b, i, arr) => (
              <ListItem
                key={b.id}
                title={b.name}
                subtitle={`Venceu ${formatShortDate(b.dueDate)}`}
                divider={i < arr.length - 1}
                dimmed
                left={<IconBadge name="check" />}
                right={<MoneyText cents={b.amountCents} variant="bodyStrong" />}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
