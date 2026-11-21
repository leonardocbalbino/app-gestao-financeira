import { useState } from 'react';
import { Alert, View } from 'react-native';
import { chartSeries } from '@app/shared/theme';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  Icon,
  IconBadge,
  ListItem,
  Screen,
  Segmented,
  TextField,
} from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FeatureGate } from '@/entitlements';
import { useCategories, useCreateCategory, useDeleteCategory } from '@/data/hooks';

const ICON_CHOICES = [
  'utensils',
  'house',
  'car',
  'party-popper',
  'heart-pulse',
  'graduation-cap',
  'shopping-bag',
  'repeat',
  'piggy-bank',
  'target',
  'wallet',
  'receipt',
];

export default function CategoriesScreen() {
  const t = useTheme();
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const categories = useCategories(kind);
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('utensils');
  const colors = chartSeries(t.colors);
  const [color, setColor] = useState(colors[0]!);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!name.trim()) {
      setError('Informe o nome');
      return;
    }
    await create.mutateAsync({ name, kind, icon, color });
    setAdding(false);
    setName('');
    setError(undefined);
  };

  const confirmDelete = (id: string, catName: string) =>
    Alert.alert(`Excluir "${catName}"?`, 'As transações dessa categoria irão para "Outros".', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <Screen testID="screen-categories">
      <ScreenHeader title="Categorias" />
      <Segmented
        options={[
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <Card padding={t.spacing.md}>
        {(categories.data ?? []).map((c, i, arr) => (
          <ListItem
            key={c.id}
            title={c.name}
            subtitle={c.isDefault ? 'Padrão' : 'Personalizada'}
            left={<IconBadge name={c.icon} tint={c.color} />}
            divider={i < arr.length - 1}
            onLongPress={c.isDefault ? undefined : () => confirmDelete(c.id, c.name)}
          />
        ))}
      </Card>

      {adding ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <TextField
              label="Nome"
              placeholder="Ex.: Pet"
              value={name}
              onChangeText={setName}
              error={error}
              maxLength={30}
            />
            <AppText variant="caption" color="inkMuted" weight="semibold">
              Ícone
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {ICON_CHOICES.map((i) => (
                <Chip
                  key={i}
                  label=""
                  selected={icon === i}
                  onPress={() => setIcon(i)}
                  icon={<Icon name={i} size={18} />}
                  accessibilityLabel={`Ícone ${i}`}
                />
              ))}
            </View>
            <AppText variant="caption" color="inkMuted" weight="semibold">
              Cor
            </AppText>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {colors.map((c) => (
                <Chip
                  key={c}
                  label=""
                  selected={color === c}
                  onPress={() => setColor(c)}
                  icon={
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: c }} />
                  }
                  accessibilityLabel={`Cor ${c}`}
                />
              ))}
            </View>
            <Button label="Salvar categoria" onPress={submit} loading={create.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : (
        <FeatureGate feature="categories.custom">
          <Button label="Nova categoria" variant="secondary" onPress={() => setAdding(true)} />
        </FeatureGate>
      )}
      <AppText variant="caption" color="inkSubtle" align="center">
        Toque e segure uma categoria personalizada para excluí-la.
      </AppText>
    </Screen>
  );
}
