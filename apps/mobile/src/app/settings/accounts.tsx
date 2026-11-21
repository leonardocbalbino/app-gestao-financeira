import { useState } from 'react';
import { Alert, View } from 'react-native';
import { centsFromDigits, formatBRL, type AccountType } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  IconBadge,
  ListItem,
  MoneyText,
  Screen,
  TextField,
} from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAccounts, useCreateAccount, useDeleteAccount } from '@/data/hooks';

const TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'checking', label: 'Conta corrente', icon: 'wallet' },
  { value: 'savings', label: 'Poupança', icon: 'piggy-bank' },
  { value: 'credit_card', label: 'Cartão', icon: 'receipt' },
  { value: 'cash', label: 'Dinheiro', icon: 'wallet' },
  { value: 'investment', label: 'Investimento', icon: 'trending-up' },
];

export default function AccountsScreen() {
  const t = useTheme();
  const accounts = useAccounts();
  const create = useCreateAccount();
  const remove = useDeleteAccount();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [initial, setInitial] = useState(0);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!name.trim()) {
      setError('Informe o nome');
      return;
    }
    const def = TYPES.find((x) => x.value === type)!;
    await create.mutateAsync({
      name,
      type,
      initialBalanceCents: initial,
      color: t.colors.primary,
      icon: def.icon,
    });
    setAdding(false);
    setName('');
    setInitial(0);
    setError(undefined);
  };

  const confirmDelete = (id: string, accName: string) =>
    Alert.alert(`Remover "${accName}"?`, 'Contas com transações serão arquivadas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen testID="screen-accounts">
      <ScreenHeader title="Contas" />
      <Card padding={t.spacing.md}>
        {(accounts.data ?? []).map((a, i, arr) => (
          <ListItem
            key={a.id}
            title={a.name}
            subtitle={TYPES.find((x) => x.value === a.type)?.label}
            left={<IconBadge name={a.icon} tint={a.color} />}
            right={<MoneyText cents={a.balanceCents} variant="bodyStrong" />}
            divider={i < arr.length - 1}
            onLongPress={() => confirmDelete(a.id, a.name)}
            accessibilityLabel={`${a.name}, saldo ${formatBRL(a.balanceCents)}. Toque longo para remover`}
          />
        ))}
      </Card>

      {adding ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <TextField
              label="Nome"
              placeholder="Ex.: Nubank"
              value={name}
              onChangeText={setName}
              error={error}
              maxLength={40}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {TYPES.map((x) => (
                <Chip
                  key={x.value}
                  label={x.label}
                  selected={type === x.value}
                  onPress={() => setType(x.value)}
                />
              ))}
            </View>
            <TextField
              label="Saldo inicial"
              keyboardType="number-pad"
              value={formatBRL(initial)}
              onChangeText={(v) => setInitial(centsFromDigits(v))}
            />
            <Button label="Salvar conta" onPress={submit} loading={create.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <Button label="Adicionar conta" variant="secondary" onPress={() => setAdding(true)} />
      )}
      <AppText variant="caption" color="inkSubtle" align="center">
        Toque e segure uma conta para removê-la.
      </AppText>
    </Screen>
  );
}
