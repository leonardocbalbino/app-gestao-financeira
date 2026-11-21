import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { formatBRL, percent } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  IconBadge,
  MoneyText,
  ProgressBar,
  Screen,
  SectionHeader,
} from '@/components/ui';
import { MoneyField } from '@/components/ui/MoneyField';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { useBudgets, useCategories, useDeleteBudget, useUpsertBudget } from '@/data/hooks';
import { useUI } from '@/state/ui';
import { isOverLimit, openPaywall, useLimit } from '@/entitlements';

export default function BudgetsScreen() {
  const t = useTheme();
  const { month, setMonth } = useUI();
  const budgets = useBudgets(month);
  const categories = useCategories('expense');
  const upsert = useUpsertBudget();
  const remove = useDeleteBudget();
  const [editing, setEditing] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState(0);
  const [error, setError] = useState<string>();

  const list = budgets.data ?? [];
  const totalLimit = list.reduce((s, b) => s + b.limitCents, 0);
  const totalSpent = list.reduce((s, b) => s + b.spentCents, 0);
  const remaining = totalLimit - totalSpent;

  const limitState = useLimit('budgets.max');
  const openNew = () => (limitState.reached ? openPaywall('budgets.max') : openForm());

  const openForm = (catId: string | null = null, current = 0) => {
    setCategoryId(catId);
    setLimit(current);
    setError(undefined);
    setEditing(true);
  };

  const save = async () => {
    if (!categoryId) return setError('Escolha uma categoria');
    if (limit <= 0) return setError('Informe um limite maior que zero');
    await upsert.mutateAsync({ categoryId, limitCents: limit, startMonth: month });
    setEditing(false);
  };

  const confirmDelete = (id: string, name: string) =>
    Alert.alert(`Remover orçamento de ${name}?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen testID="screen-budgets">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title" accessibilityRole="header">
          Orçamentos
        </AppText>
        <Chip
          label="Metas"
          icon={<Icon name="target" size={14} />}
          onPress={() => router.push('/goals')}
        />
      </View>
      <MonthSwitcher month={month} onChange={setMonth} />

      {list.length > 0 ? (
        <Card>
          <AppText variant="caption" color="inkMuted">
            {remaining >= 0 ? 'Disponível no mês' : 'Acima do planejado'}
          </AppText>
          <MoneyText
            cents={Math.abs(remaining)}
            variant="title"
            tone={remaining >= 0 ? 'neutral' : 'expense'}
          />
          <View style={{ marginVertical: t.spacing.sm }}>
            <ProgressBar
              value={totalLimit ? totalSpent / totalLimit : 0}
              accessibilityLabel={`Total gasto: ${percent(totalSpent, totalLimit)}% do orçado`}
            />
          </View>
          <AppText variant="caption" color="inkMuted" tabular>
            {formatBRL(totalSpent)} de {formatBRL(totalLimit)} · {percent(totalSpent, totalLimit)}%
          </AppText>
        </Card>
      ) : null}

      {editing ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <AppText variant="headline">Definir orçamento</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {(categories.data ?? []).map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                  icon={<Icon name={c.icon} size={14} rawColor={c.color} />}
                />
              ))}
            </View>
            <MoneyField
              label="Limite mensal"
              value={limit}
              onChange={setLimit}
              error={error}
              testID="budget-limit"
            />
            <Button label="Salvar" onPress={save} loading={upsert.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setEditing(false)} />
          </View>
        </Card>
      ) : null}

      <SectionHeader
        title="Por categoria"
        actionLabel={editing ? undefined : 'Adicionar'}
        onAction={openNew}
      />
      {list.length === 0 && !editing ? (
        <Card>
          <EmptyState
            testID="budgets-empty"
            icon="wallet"
            title="Nenhum orçamento"
            message="Defina limites por categoria para controlar seus gastos do mês."
            actionLabel="Criar orçamento"
            onAction={openNew}
          />
        </Card>
      ) : (
        list.map((b, index) => {
          const over = b.spentCents > b.limitCents;
          const readOnly = isOverLimit(limitState, index);
          return (
            <Card
              key={b.id}
              onPress={() =>
                readOnly ? openPaywall('budgets.max') : openForm(b.categoryId, b.limitCents)
              }
              style={readOnly ? { opacity: 0.55 } : undefined}
              accessibilityLabel={`${b.categoryName}: gasto ${formatBRL(b.spentCents)} de ${formatBRL(b.limitCents)}. ${readOnly ? 'Somente leitura: acima do limite do plano' : 'Toque para editar, toque longo para remover'}`}
              onLongPress={() => confirmDelete(b.id, b.categoryName)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <IconBadge name={b.categoryIcon} tint={b.categoryColor} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{b.categoryName}</AppText>
                  {readOnly ? (
                    <AppText variant="micro" color="inkMuted">
                      SOMENTE LEITURA · LIMITE DO PLANO
                    </AppText>
                  ) : null}
                  <AppText variant="caption" color={over ? 'danger' : 'inkMuted'} tabular>
                    {over
                      ? `${formatBRL(b.spentCents - b.limitCents)} acima`
                      : `Restam ${formatBRL(b.limitCents - b.spentCents)}`}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" tabular color={over ? 'danger' : 'ink'}>
                  {percent(b.spentCents, b.limitCents)}%
                </AppText>
              </View>
              <View style={{ marginTop: t.spacing.md }}>
                <ProgressBar
                  value={b.ratio}
                  accessibilityLabel={`${b.categoryName}: ${percent(b.spentCents, b.limitCents)}%`}
                />
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
