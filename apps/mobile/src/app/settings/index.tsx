import { useState } from 'react';
import { Alert, Linking, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { brand, formatShortDate, toISODate } from '@app/shared';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme/ThemeProvider';
import { AppText, Card, Icon, ListItem, ProBadge, Screen, Segmented } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { usePrefs } from '@/state/prefs';
import { useAuth } from '@/auth/AuthProvider';
import { deleteAccountOnServer, signOut } from '@/auth/authService';
import { billing } from '@/billing';
import { useEntitlements, useEntitlementsContext } from '@/entitlements';
import { useDb } from '@/data/DatabaseProvider';
import { resetLocalData } from '@/data/reset';
import { storage } from '@/lib/storage';
import { useAds } from '@/ads/AdsProvider';
import { useSyncStatus, requestSync } from '@/sync/SyncManager';
import { FeatureGate } from '@/entitlements';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

const SOURCE_LABEL = {
  subscription: 'Assinatura',
  manual_grant: 'Cortesia',
  default: 'Gratuito',
  fallback: 'Gratuito (offline)',
} as const;

export default function SettingsScreen() {
  const t = useTheme();
  const db = useDb();
  const qc = useQueryClient();
  const { preference, setPreference } = useThemePreference();
  const hide = usePrefs((s) => s.hideBalance);
  const toggleHide = usePrefs((s) => s.toggleHideBalance);
  const { user, online } = useAuth();
  const ent = useEntitlements();
  const { refresh } = useEntitlementsContext();
  const [busy, setBusy] = useState(false);
  const ads = useAds();
  const sync = useSyncStatus();
  const syncLabel = sync.syncing
    ? 'Sincronizando…'
    : sync.error
      ? 'Falha na última sincronização — tentaremos de novo'
      : sync.lastSyncAt
        ? `Última sincronização: ${new Date(sync.lastSyncAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : 'Ainda não sincronizado';
  const chevron = <Icon name="chevron-right" color="inkSubtle" />;
  const isFree = ent.planId === 'free';
  const registered = !!user && !user.isAnonymous;

  const restore = async () => {
    const res = await billing().restore();
    if (res.status === 'success') {
      await refresh();
      Alert.alert('Compras restauradas', 'Seu plano foi atualizado.');
    } else if (res.status === 'error') Alert.alert('Restaurar compras', res.message);
  };

  const wipeAndRestart = () => {
    resetLocalData(db);
    storage.clearAll();
    qc.clear();
    usePrefs.setState({ onboardingDone: false, hideBalance: false, theme: 'system' });
    router.replace('/onboarding');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Excluir conta?',
      'Apaga permanentemente sua conta, o backup na nuvem e os dados deste aparelho. ' +
        'Assinaturas ativas devem ser canceladas na loja (App Store / Google Play).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              if (user && online) await deleteAccountOnServer();
              await signOut();
              wipeAndRestart();
            } catch {
              Alert.alert('Não foi possível excluir', 'Verifique sua conexão e tente novamente.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen testID="screen-settings">
      <ScreenHeader title="Configurações" />

      <AppText variant="micro" color="inkMuted">
        PLANO
      </AppText>
      <Card tone={isFree ? 'surface' : 'pro'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <AppText variant="headline" style={{ flex: 1 }}>
            {ent.planName}
          </AppText>
          {!isFree ? <ProBadge /> : null}
        </View>
        <AppText variant="caption" color={isFree ? 'inkMuted' : 'proInk'}>
          {SOURCE_LABEL[ent.source]}
          {ent.expiresAt
            ? ` · válido até ${formatShortDate(toISODate(new Date(ent.expiresAt)))}`
            : ''}
        </AppText>
        <View style={{ marginTop: t.spacing.sm }}>
          {isFree ? (
            <ListItem
              title="Conhecer o Pro"
              left={<Icon name="crown" color="pro" />}
              right={chevron}
              onPress={() => router.push({ pathname: '/paywall', params: { source: 'settings' } })}
            />
          ) : (
            <ListItem
              title="Gerenciar assinatura"
              left={<Icon name="settings" color="proInk" />}
              right={chevron}
              onPress={() => void billing().manageSubscription()}
            />
          )}
          <ListItem
            title="Restaurar compras"
            left={<Icon name="repeat" color="primary" />}
            onPress={restore}
          />
        </View>
      </Card>

      <AppText variant="micro" color="inkMuted">
        BACKUP NA NUVEM
      </AppText>
      <FeatureGate feature="sync.cloud">
        <Card padding={t.spacing.md}>
          <ListItem
            title={user ? syncLabel : 'Entre para ativar o backup'}
            subtitle={
              sync.rejectedCount
                ? `${sync.rejectedCount} item(ns) acima do limite do plano não foram enviados`
                : registered
                  ? 'Seus dados ficam salvos e disponíveis em outros aparelhos'
                  : 'Crie uma conta para recuperar seus dados ao trocar de aparelho'
            }
            left={<Icon name="repeat" color="primary" />}
            right={
              user ? (
                <AppText variant="caption" color="primary" weight="bold">
                  Agora
                </AppText>
              ) : (
                chevron
              )
            }
            onPress={() => (user ? requestSync() : router.push('/login'))}
          />
        </Card>
      </FeatureGate>

      <AppText variant="micro" color="inkMuted">
        CONTA
      </AppText>
      <Card padding={t.spacing.md}>
        {registered ? (
          <>
            <ListItem
              title={user.email ?? 'Conta conectada'}
              subtitle={user.provider ? `Entrou com ${user.provider}` : undefined}
              left={<Icon name="check" color="primary" />}
              divider
            />
            <ListItem
              title="Sair"
              left={<Icon name="x" color="inkMuted" />}
              onPress={() =>
                Alert.alert('Sair da conta?', 'Seus dados continuam neste aparelho.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Sair', onPress: () => void signOut() },
                ])
              }
            />
          </>
        ) : (
          <ListItem
            title="Entrar ou criar conta"
            subtitle="Mantenha a assinatura e ative o backup"
            left={<Icon name="wallet" color="primary" />}
            right={chevron}
            onPress={() => router.push('/login')}
          />
        )}
      </Card>

      <AppText variant="micro" color="inkMuted">
        ORGANIZAÇÃO
      </AppText>
      <Card padding={t.spacing.md}>
        <ListItem
          title="Contas e carteiras"
          left={<Icon name="wallet" color="primary" />}
          right={chevron}
          divider
          onPress={() => router.push('/settings/accounts')}
        />
        <ListItem
          title="Categorias"
          left={<Icon name="sliders-horizontal" color="primary" />}
          right={chevron}
          divider
          onPress={() => router.push('/settings/categories')}
        />
        <ListItem
          title="Metas"
          left={<Icon name="target" color="primary" />}
          right={chevron}
          divider
          onPress={() => router.push('/goals')}
        />
        <ListItem
          title="Contas a pagar"
          left={<Icon name="calendar-clock" color="primary" />}
          right={chevron}
          onPress={() => router.push('/bills')}
        />
      </Card>

      <AppText variant="micro" color="inkMuted">
        APARÊNCIA E PRIVACIDADE
      </AppText>
      <Card>
        <View style={{ gap: t.spacing.md }}>
          <AppText variant="bodyStrong">Tema</AppText>
          <Segmented options={THEME_OPTIONS} value={preference} onChange={setPreference} />
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Ocultar valores</AppText>
              <AppText variant="caption" color="inkMuted">
                Esconde saldos na tela inicial e nas listas
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Ocultar valores"
              value={hide}
              onValueChange={toggleHide}
              trackColor={{ true: t.colors.primary, false: t.colors.chipBorder }}
            />
          </View>
        </View>
      </Card>

      <AppText variant="micro" color="inkMuted">
        SOBRE
      </AppText>
      <Card padding={t.spacing.md}>
        <ListItem
          title="Termos de uso"
          right={chevron}
          divider
          onPress={() => Linking.openURL(brand.termsUrl)}
        />
        <ListItem
          title="Privacidade"
          right={chevron}
          divider
          onPress={() => Linking.openURL(brand.privacyUrl)}
        />
        {ads.privacyOptionsRequired ? (
          <ListItem
            title="Privacidade de anúncios"
            right={chevron}
            divider
            onPress={() => void ads.showPrivacyOptions()}
          />
        ) : null}
        <ListItem
          title="Fale conosco"
          subtitle={brand.supportEmail}
          right={chevron}
          onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)}
        />
      </Card>

      <Card
        tone="danger"
        onPress={busy ? undefined : confirmDelete}
        accessibilityLabel="Excluir conta e dados"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Icon name="trash" color="danger" />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" color="danger">
              {busy ? 'Excluindo…' : 'Excluir conta e dados'}
            </AppText>
            <AppText variant="caption" color="danger">
              Remove tudo de forma permanente
            </AppText>
          </View>
        </View>
      </Card>

      <AppText variant="caption" color="inkSubtle" align="center">
        {brand.name} · versão 1.0.0
      </AppText>
    </Screen>
  );
}
