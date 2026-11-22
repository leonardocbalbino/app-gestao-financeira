import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { normalizeBrPhone } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Card, ErrorState, ProBadge, Screen, TextField } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFeature } from '@/entitlements';
import { useProfile, useUpdateProfile } from '@/features/reminders/hooks';

/** Para onde mandar lembretes: e-mail, celular (SMS/WhatsApp) com consentimento explícito. */
export default function ContactChannelsScreen() {
  const t = useTheme();
  const profile = useProfile();
  const update = useUpdateProfile();
  const canSms = useFeature('reminders.sms');
  const canWhats = useFeature('reminders.whatsapp');
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const p = profile.data;
  // Rascunho do campo; até o usuário digitar, mostra o celular salvo.
  const phone = phoneDraft ?? p?.phone ?? '';

  const savePhone = async () => {
    setError(undefined);
    setSaved(false);
    const normalized = phone.trim() ? normalizeBrPhone(phone) : null;
    if (phone.trim() && !normalized) return setError('Celular inválido. Ex.: (11) 99999-8888');
    try {
      await update.mutateAsync({ phone: normalized });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggle = (key: 'emailOptIn' | 'smsOptIn' | 'whatsappOptIn', value: boolean) =>
    update.mutateAsync({ [key]: value }).catch((e: Error) => setError(e.message));

  if (profile.isError)
    return (
      <ErrorState
        message="Não foi possível carregar seu perfil."
        onRetry={() => void profile.refetch()}
      />
    );

  const row = (
    label: string,
    hint: string,
    value: boolean,
    onChange: (v: boolean) => void,
    disabled = false,
    pro = false,
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: t.spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', gap: t.spacing.xs, alignItems: 'center' }}>
          <AppText variant="bodyStrong">{label}</AppText>
          {pro ? <ProBadge /> : null}
        </View>
        <AppText variant="caption" color="inkMuted">
          {hint}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled || update.isPending}
        onValueChange={onChange}
        trackColor={{ true: t.colors.primary, false: t.colors.chipBorder }}
      />
    </View>
  );

  return (
    <Screen testID="screen-contact">
      <ScreenHeader title="Canais de contato" />
      <AppText variant="body" color="inkMuted">
        Usamos estes contatos apenas para enviar os lembretes que você criar. Você pode desligar a
        qualquer momento.
      </AppText>

      <Card>
        <View style={{ gap: t.spacing.md }}>
          <AppText variant="headline">E-mail</AppText>
          {p?.email ? (
            row('Receber por e-mail', p.email, p.email_opt_in, (v) => void toggle('emailOptIn', v))
          ) : (
            <>
              <AppText variant="caption" color="inkMuted">
                Você ainda não tem e-mail na conta.
              </AppText>
              <Button
                label="Entrar com e-mail"
                variant="secondary"
                size="md"
                onPress={() => router.push('/login')}
              />
            </>
          )}
        </View>
      </Card>

      <Card>
        <View style={{ gap: t.spacing.md }}>
          <AppText variant="headline">Celular</AppText>
          <TextField
            testID="contact-phone"
            label="Número com DDD"
            keyboardType="phone-pad"
            placeholder="(11) 99999-8888"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setSaved(false);
            }}
            error={error}
          />
          <Button
            label={saved ? 'Salvo ✓' : 'Salvar celular'}
            variant="secondary"
            size="md"
            onPress={savePhone}
            loading={update.isPending}
          />
          {row(
            'Receber por SMS',
            p?.phone ? 'Mensagens de texto no seu celular' : 'Cadastre o celular primeiro',
            !!p?.sms_opt_in,
            (v) => void toggle('smsOptIn', v),
            !p?.phone || !canSms,
            !canSms,
          )}
          {row(
            'Receber por WhatsApp',
            p?.phone ? 'Mensagens no WhatsApp deste número' : 'Cadastre o celular primeiro',
            !!p?.whatsapp_opt_in,
            (v) => void toggle('whatsappOptIn', v),
            !p?.phone || !canWhats,
            !canWhats,
          )}
        </View>
      </Card>
    </Screen>
  );
}
