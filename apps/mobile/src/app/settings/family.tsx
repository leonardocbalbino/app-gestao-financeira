import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brand, getLimit } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  IconBadge,
  ListItem,
  Screen,
  TextField,
} from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FeatureGate, openPaywall, useEntitlements } from '@/entitlements';
import { useAuth } from '@/auth/AuthProvider';
import { api, ApiRequestError } from '@/lib/api';
import { requestSync } from '@/sync/SyncManager';

interface Household {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  members: { user_id: string; role: 'owner' | 'member'; name: string }[];
}

const KEY = ['household'];

/** Família: contas, transações e orçamentos compartilhados entre membros (via sync na nuvem). */
export default function FamilyScreen() {
  const t = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const maxMembers = getLimit(useEntitlements(), 'members.max');
  const [name, setName] = useState('Família');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();

  const q = useQuery({
    queryKey: KEY,
    queryFn: () => api<Household | null>('GET', '/households/me'),
    enabled: !!user,
  });
  const done = (h: Household | null | unknown) => {
    qc.setQueryData(KEY, h ?? null);
    void qc.invalidateQueries({ queryKey: ['db'] });
    requestSync();
  };
  const onError = (e: unknown) => {
    if (e instanceof ApiRequestError && e.code === 'limit_reached:members.max') {
      setError('Esta família atingiu o limite de pessoas do plano do dono.');
    } else if (e instanceof ApiRequestError && e.status === 404) {
      setError('Código não encontrado.');
    } else setError((e as Error).message);
  };
  const create = useMutation({
    mutationFn: () => api<Household>('POST', '/households', { body: { name } }),
    onSuccess: done,
    onError,
  });
  const join = useMutation({
    mutationFn: () =>
      api<Household>('POST', '/households/join', { body: { code: code.trim().toUpperCase() } }),
    onSuccess: done,
    onError,
  });
  const leave = useMutation({
    mutationFn: () => api('DELETE', '/households/me'),
    onSuccess: () => done(null),
    onError,
  });

  const h = q.data;
  const isOwner = h?.owner_id === user?.id;

  return (
    <Screen testID="screen-family">
      <ScreenHeader title="Família" />
      <FeatureGate feature="sync.cloud">
        {h ? (
          <>
            <Card>
              <AppText variant="headline">{h.name}</AppText>
              <AppText variant="caption" color="inkMuted">
                Contas, transações, orçamentos e metas são compartilhados entre todos.
              </AppText>
              <View style={{ marginTop: t.spacing.md }}>
                {h.members.map((m, i) => (
                  <ListItem
                    key={m.user_id}
                    title={m.user_id === user?.id ? `${m.name} (você)` : m.name}
                    subtitle={m.role === 'owner' ? 'Dono' : 'Membro'}
                    left={<IconBadge name="users" />}
                    divider={i < h.members.length - 1}
                  />
                ))}
              </View>
            </Card>
            {isOwner ? (
              <Card>
                <AppText variant="caption" color="inkMuted">
                  Código de convite
                </AppText>
                <AppText variant="title" tabular selectable>
                  {h.invite_code}
                </AppText>
                <AppText variant="caption" color="inkMuted">
                  {maxMembers === null
                    ? 'Sem limite de pessoas.'
                    : `Até ${maxMembers} pessoa(s) no seu plano.`}
                </AppText>
                {maxMembers !== null && h.members.length >= maxMembers ? (
                  <Button
                    label="Convidar mais pessoas · Pro"
                    variant="pro"
                    size="md"
                    onPress={() => openPaywall('members.max')}
                    style={{ marginTop: t.spacing.md }}
                  />
                ) : (
                  <Button
                    label="Compartilhar convite"
                    variant="secondary"
                    size="md"
                    style={{ marginTop: t.spacing.md }}
                    onPress={() =>
                      void Share.share({
                        message: `Entre na nossa família no ${brand.name}: abra Configurações → Família e use o código ${h.invite_code}`,
                      })
                    }
                  />
                )}
              </Card>
            ) : null}
            <Button
              label={isOwner ? 'Encerrar família' : 'Sair da família'}
              variant="danger"
              loading={leave.isPending}
              onPress={() =>
                Alert.alert(
                  isOwner ? 'Encerrar a família?' : 'Sair da família?',
                  'Cada pessoa continua com os próprios dados; os dados dos outros deixam de ser compartilhados.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: isOwner ? 'Encerrar' : 'Sair',
                      style: 'destructive',
                      onPress: () => leave.mutate(),
                    },
                  ],
                )
              }
            />
          </>
        ) : (
          <>
            <Card>
              <EmptyState
                icon="users"
                title="Organize as finanças em família"
                message="Crie uma família e convide quem mora com você, ou entre com um código."
              />
              <View style={{ gap: t.spacing.md }}>
                <TextField
                  label="Nome da família"
                  value={name}
                  onChangeText={setName}
                  maxLength={40}
                />
                <Button
                  label="Criar família"
                  onPress={() => create.mutate()}
                  loading={create.isPending}
                />
              </View>
            </Card>
            <Card>
              <View style={{ gap: t.spacing.md }}>
                <TextField
                  testID="family-code"
                  label="Tenho um código de convite"
                  autoCapitalize="characters"
                  value={code}
                  onChangeText={setCode}
                  maxLength={16}
                />
                <Button
                  label="Entrar na família"
                  variant="secondary"
                  disabled={code.trim().length < 4}
                  onPress={() => join.mutate()}
                  loading={join.isPending}
                />
              </View>
            </Card>
          </>
        )}
        {error ? (
          <AppText variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </FeatureGate>
    </Screen>
  );
}
