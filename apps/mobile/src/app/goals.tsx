import { useState } from 'react';
import { Alert, View } from 'react-native';
import {
  daysBetween,
  formatBRL,
  formatShortDate,
  percent,
  toISODate,
  addMonthsToDate,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  ProgressBar,
  Screen,
  TextField,
} from '@/components/ui';
import { MoneyField } from '@/components/ui/MoneyField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { isOverLimit, LimitedAddButton, openPaywall, useLimit } from '@/entitlements';
import { useAddToGoal, useCreateGoal, useDeleteGoal, useGoals } from '@/data/hooks';

const DEADLINES = [
  { label: 'Sem prazo', months: 0 },
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
];

export default function GoalsScreen() {
  const t = useTheme();
  const goals = useGoals();
  const create = useCreateGoal();
  const add = useAddToGoal();
  const remove = useDeleteGoal();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState(0);
  const [months, setMonths] = useState(0);
  const [error, setError] = useState<string>();
  const [depositFor, setDepositFor] = useState<string | null>(null);
  const [deposit, setDeposit] = useState(0);
  const today = toISODate(new Date());
  const limitState = useLimit('goals.max');
  const startAdding = () => (limitState.reached ? openPaywall('goals.max') : setAdding(true));

  const save = async () => {
    if (!name.trim()) return setError('Informe o nome');
    if (target <= 0) return setError('Informe o objetivo');
    await create.mutateAsync({
      name,
      targetCents: target,
      deadline: months ? addMonthsToDate(today, months) : null,
      icon: 'target',
      color: t.colors.primary,
    });
    setAdding(false);
    setName('');
    setTarget(0);
    setError(undefined);
  };

  const move = async (sign: 1 | -1) => {
    if (!depositFor || deposit <= 0) return;
    await add.mutateAsync({ id: depositFor, deltaCents: sign * deposit });
    setDepositFor(null);
    setDeposit(0);
  };

  return (
    <Screen testID="screen-goals">
      <ScreenHeader title="Metas" />
      {(goals.data ?? []).length === 0 && !adding ? (
        <Card>
          <EmptyState
            icon="piggy-bank"
            title="Nenhuma meta"
            message="Crie uma meta de economia — viagem, reserva de emergência, um sonho."
            actionLabel="Criar meta"
            onAction={startAdding}
          />
        </Card>
      ) : null}

      {(goals.data ?? []).map((g, index) => {
        const readOnly = isOverLimit(limitState, index);
        const ratio = g.targetCents ? g.savedCents / g.targetCents : 0;
        const done = g.savedCents >= g.targetCents;
        const daysLeft = g.deadline ? daysBetween(today, g.deadline) : null;
        const monthly =
          g.deadline && daysLeft && daysLeft > 0 && !done
            ? Math.ceil((g.targetCents - g.savedCents) / Math.max(1, Math.ceil(daysLeft / 30)))
            : null;
        return (
          <Card
            key={g.id}
            onLongPress={() =>
              Alert.alert(`Excluir meta "${g.name}"?`, undefined, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir', style: 'destructive', onPress: () => remove.mutate(g.id) },
              ])
            }
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <IconBadge name={done ? 'check' : g.icon} tint={g.color} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{g.name}</AppText>
                <AppText variant="caption" color="inkMuted" tabular>
                  {formatBRL(g.savedCents)} de {formatBRL(g.targetCents)}
                  {g.deadline ? ` · até ${formatShortDate(g.deadline)}` : ''}
                </AppText>
              </View>
              <AppText variant="bodyStrong" tabular>
                {percent(g.savedCents, g.targetCents)}%
              </AppText>
            </View>
            <View style={{ marginVertical: t.spacing.md }}>
              <ProgressBar
                value={ratio}
                tone="primary"
                accessibilityLabel={`${g.name}: ${percent(g.savedCents, g.targetCents)}%`}
              />
            </View>
            {monthly ? (
              <AppText variant="caption" color="inkMuted">
                Guarde cerca de {formatBRL(monthly)} por mês para chegar lá.
              </AppText>
            ) : done ? (
              <AppText variant="caption" color="primary" weight="bold">
                Meta alcançada! 🎉
              </AppText>
            ) : null}
            {readOnly ? (
              <Button
                label="Somente leitura · liberar no Pro"
                variant="pro"
                size="md"
                onPress={() => openPaywall('goals.max')}
                style={{ marginTop: t.spacing.md }}
              />
            ) : depositFor === g.id ? (
              <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
                <MoneyField label="Valor" value={deposit} onChange={setDeposit} />
                <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                  <Button label="Guardar" onPress={() => move(1)} style={{ flex: 1 }} />
                  <Button
                    label="Retirar"
                    variant="secondary"
                    onPress={() => move(-1)}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <Button
                label="Movimentar"
                variant="secondary"
                size="md"
                onPress={() => {
                  setDepositFor(g.id);
                  setDeposit(0);
                }}
                style={{ marginTop: t.spacing.md }}
              />
            )}
          </Card>
        );
      })}

      {adding ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <TextField
              label="Nome"
              placeholder="Ex.: Viagem"
              value={name}
              onChangeText={setName}
              maxLength={40}
            />
            <MoneyField label="Objetivo" value={target} onChange={setTarget} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {DEADLINES.map((d) => (
                <Chip
                  key={d.months}
                  label={d.label}
                  selected={months === d.months}
                  onPress={() => setMonths(d.months)}
                />
              ))}
            </View>
            {error ? (
              <AppText variant="caption" color="danger" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <Button label="Criar meta" onPress={save} loading={create.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (goals.data ?? []).length > 0 ? (
        <LimitedAddButton feature="goals.max" label="Nova meta" onPress={() => setAdding(true)} />
      ) : null}
    </Screen>
  );
}
