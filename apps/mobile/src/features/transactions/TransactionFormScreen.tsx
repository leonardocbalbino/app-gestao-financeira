import { useEffect, useMemo } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import {
  addDays,
  formatRelativeDay,
  toISODate,
  transactionFormSchema,
  type TransactionForm,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Chip, Icon, ProBadge, Segmented, TextField } from '@/components/ui';
import { openPaywall, useFeature } from '@/entitlements';
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useRecentDescriptions,
  useTransaction,
  useUpdateTransaction,
} from '@/data/hooks';
import { AmountInput } from './AmountInput';

const KIND_OPTIONS = [
  { value: 'expense' as const, label: 'Despesa' },
  { value: 'income' as const, label: 'Receita' },
  { value: 'transfer' as const, label: 'Transferência' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none' as const, label: 'Não repetir' },
  { value: 'weekly' as const, label: 'Semanal' },
  { value: 'monthly' as const, label: 'Mensal' },
  { value: 'yearly' as const, label: 'Anual' },
];

interface Props {
  /** Quando presente, edita a transação existente. */
  id?: string;
}

export function TransactionFormScreen({ id }: Props) {
  const t = useTheme();
  const isEdit = !!id;
  const accountsQ = useAccounts();
  const existing = useTransaction(id);
  const recent = useRecentDescriptions();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const today = toISODate(new Date());
  const recurringEnabled = useFeature('transactions.recurring');

  const { control, handleSubmit, setValue, reset, formState } = useForm<TransactionForm>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      kind: 'expense',
      amountCents: 0,
      description: '',
      categoryId: null,
      accountId: '',
      toAccountId: null,
      date: today,
      notes: null,
      recurrence: 'none',
    },
  });

  const kind = useWatch({ control, name: 'kind' });
  const accountId = useWatch({ control, name: 'accountId' });
  const categoriesQ = useCategories(kind === 'income' ? 'income' : 'expense');

  // Conta padrão = primeira conta ativa
  useEffect(() => {
    const first = accountsQ.data?.[0];
    if (!isEdit && !accountId && first) setValue('accountId', first.id);
  }, [accountsQ.data, accountId, isEdit, setValue]);

  // Carrega transação em edição
  useEffect(() => {
    const row = existing.data;
    if (row) {
      reset({
        kind: row.kind,
        amountCents: row.amountCents,
        description: row.description,
        categoryId: row.categoryId,
        accountId: row.accountId,
        toAccountId: row.toAccountId,
        date: row.date,
        notes: row.notes,
        recurrence: row.recurrence,
      });
    }
  }, [existing.data, reset]);

  const accounts = useMemo(() => accountsQ.data ?? [], [accountsQ.data]);

  const onSubmit = handleSubmit(async (form) => {
    if (isEdit && id) await update.mutateAsync({ id, form });
    else await create.mutateAsync(form);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  });

  const onDelete = () => {
    if (!id) return;
    Alert.alert('Excluir transação?', 'Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(id);
          router.back();
        },
      },
    ]);
  };

  const errors = formState.errors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.spacing.md,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => router.back()}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="x" size={24} />
          </Pressable>
          <AppText variant="headline" accessibilityRole="header">
            {isEdit ? 'Editar transação' : 'Nova transação'}
          </AppText>
          {isEdit ? (
            <Pressable
              testID="tx-delete"
              accessibilityRole="button"
              accessibilityLabel="Excluir transação"
              onPress={onDelete}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="trash" size={22} color="danger" />
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.xl, gap: t.spacing.lg }}
        >
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Segmented
                testID="tx-kind"
                options={KIND_OPTIONS}
                value={field.value}
                onChange={(k) => {
                  field.onChange(k);
                  setValue('categoryId', null);
                  if (k !== 'transfer') setValue('toAccountId', null);
                }}
              />
            )}
          />

          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => (
              <AmountInput
                value={field.value}
                onChange={field.onChange}
                tone={kind}
                error={errors.amountCents?.message}
                autoFocus={!isEdit}
              />
            )}
          />

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <View style={{ gap: t.spacing.sm }}>
                <TextField
                  label="Descrição"
                  placeholder={kind === 'income' ? 'Ex.: Salário' : 'Ex.: Mercado'}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={80}
                  returnKeyType="done"
                  testID="tx-description"
                />
                {!field.value && (recent.data?.length ?? 0) > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                      {recent.data?.map((d) => (
                        <Chip key={d} label={d} onPress={() => field.onChange(d)} />
                      ))}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
            )}
          />

          {kind !== 'transfer' ? (
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <View style={{ gap: t.spacing.sm }}>
                  <AppText variant="caption" color="inkMuted" weight="semibold">
                    Categoria
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                    {categoriesQ.data?.map((c) => (
                      <Chip
                        key={c.id}
                        testID={`cat-${c.slug ?? c.id}`}
                        label={c.name}
                        selected={field.value === c.id}
                        onPress={() => field.onChange(c.id)}
                        icon={<Icon name={c.icon} size={14} rawColor={c.color} />}
                      />
                    ))}
                  </View>
                  {errors.categoryId ? (
                    <AppText variant="caption" color="danger" accessibilityRole="alert">
                      {errors.categoryId.message}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="accountId"
            render={({ field }) => (
              <View style={{ gap: t.spacing.sm }}>
                <AppText variant="caption" color="inkMuted" weight="semibold">
                  {kind === 'transfer' ? 'De' : 'Conta'}
                </AppText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {accounts.map((a) => (
                    <Chip
                      key={a.id}
                      label={a.name}
                      selected={field.value === a.id}
                      onPress={() => field.onChange(a.id)}
                    />
                  ))}
                </View>
              </View>
            )}
          />

          {kind === 'transfer' ? (
            <Controller
              control={control}
              name="toAccountId"
              render={({ field }) => (
                <View style={{ gap: t.spacing.sm }}>
                  <AppText variant="caption" color="inkMuted" weight="semibold">
                    Para
                  </AppText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                    {accounts
                      .filter((a) => a.id !== accountId)
                      .map((a) => (
                        <Chip
                          key={a.id}
                          label={a.name}
                          selected={field.value === a.id}
                          onPress={() => field.onChange(a.id)}
                        />
                      ))}
                  </View>
                  {accounts.length < 2 ? (
                    <AppText variant="caption" color="inkMuted">
                      Cadastre outra conta para fazer transferências.
                    </AppText>
                  ) : null}
                  {errors.toAccountId ? (
                    <AppText variant="caption" color="danger" accessibilityRole="alert">
                      {errors.toAccountId.message}
                    </AppText>
                  ) : null}
                </View>
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="date"
            render={({ field }) => (
              <View style={{ gap: t.spacing.sm }}>
                <AppText variant="caption" color="inkMuted" weight="semibold">
                  Data
                </AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dia anterior"
                    onPress={() => field.onChange(addDays(field.value, -1))}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="chevron-left" />
                  </Pressable>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <AppText variant="bodyStrong" accessibilityLiveRegion="polite">
                      {formatRelativeDay(field.value)}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Próximo dia"
                    onPress={() => field.onChange(addDays(field.value, 1))}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="chevron-right" />
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                  <Chip
                    label="Hoje"
                    selected={field.value === today}
                    onPress={() => field.onChange(today)}
                  />
                  <Chip
                    label="Ontem"
                    selected={field.value === addDays(today, -1)}
                    onPress={() => field.onChange(addDays(today, -1))}
                  />
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="recurrence"
            render={({ field }) => (
              <View style={{ gap: t.spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                  <AppText variant="caption" color="inkMuted" weight="semibold">
                    Repetir
                  </AppText>
                  {!recurringEnabled ? <ProBadge /> : null}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {RECURRENCE_OPTIONS.map((o) => {
                    const locked = !recurringEnabled && o.value !== 'none';
                    return (
                      <Chip
                        key={o.value}
                        testID={`recurrence-${o.value}`}
                        label={o.label}
                        tone={locked ? 'pro' : 'default'}
                        selected={field.value === o.value}
                        icon={locked ? <Icon name="lock" size={12} color="inkMuted" /> : undefined}
                        accessibilityLabel={locked ? `${o.label}, recurso Pro` : o.label}
                        onPress={() =>
                          locked ? openPaywall('transactions.recurring') : field.onChange(o.value)
                        }
                      />
                    );
                  })}
                </View>
              </View>
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextField
                label="Observações"
                placeholder="Opcional"
                value={field.value ?? ''}
                onChangeText={(v) => field.onChange(v || null)}
                multiline
                maxLength={500}
              />
            )}
          />
        </ScrollView>

        <View style={{ padding: t.spacing.xl, paddingTop: t.spacing.sm }}>
          <Button
            testID="tx-save"
            label={isEdit ? 'Salvar alterações' : 'Adicionar'}
            onPress={onSubmit}
            loading={formState.isSubmitting}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
