import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  addDays,
  CHANNEL_LABEL,
  formatBRL,
  formatRelativeDay,
  normalizeBrPhone,
  reminderInputSchema,
  toISODate,
  type ReminderChannel,
  type ReminderInput,
} from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  Chip,
  Icon,
  ProBadge,
  Screen,
  Segmented,
  TextField,
} from '@/components/ui';
import { MoneyField } from '@/components/ui/MoneyField';
import { ScreenHeader } from '@/components/ScreenHeader';
import { openPaywall, useFeature } from '@/entitlements';
import { registerPushToken } from '@/lib/pushTokens';
import { analytics } from '@/lib/analytics';
import { OFFSET_OPTIONS, TIME_OPTIONS, fromDueIso, quickDates, toDueIso } from './format';
import {
  upgradeFeatureFromError,
  useDeliveries,
  useProfile,
  useReminderAction,
  useReminders,
  useSaveReminder,
  useTestReminder,
  type ReminderDto,
} from './hooks';

const RECURRENCES = [
  { value: 'none' as const, label: 'Uma vez' },
  { value: 'weekly' as const, label: 'Semanal' },
  { value: 'monthly' as const, label: 'Mensal' },
  { value: 'yearly' as const, label: 'Anual' },
];

const CHANNEL_ICON: Record<ReminderChannel, string> = {
  push: 'bell',
  email: 'mail',
  sms: 'smartphone',
  whatsapp: 'message-circle',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Agendado',
  sending: 'Enviando',
  sent: 'Enviado',
  simulated: 'Simulado (sem provedor)',
  failed: 'Falhou',
  skipped: 'Não enviado',
};

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** Carrega o lembrete (edição) e só então monta o formulário com os valores iniciais. */
export function ReminderFormScreen({ id }: { id?: string }) {
  const list = useReminders();
  const existing = useMemo(() => list.data?.find((r) => r.id === id), [list.data, id]);
  if (id && !existing) {
    return (
      <Screen>
        <ScreenHeader title="Lembrete" />
        <AppText variant="body" color="inkMuted">
          {list.isError ? 'Não foi possível carregar o lembrete.' : 'Carregando…'}
        </AppText>
      </Screen>
    );
  }
  return <ReminderForm key={existing?.id ?? 'new'} id={id} existing={existing} />;
}

function ReminderForm({ id, existing }: { id?: string; existing?: ReminderDto }) {
  const t = useTheme();
  const profile = useProfile();
  const save = useSaveReminder();
  const act = useReminderAction();
  const test = useTestReminder();
  const deliveries = useDeliveries(id);
  const canSms = useFeature('reminders.sms');
  const canWhats = useFeature('reminders.whatsapp');
  const today = toISODate(new Date());
  const due = existing ? fromDueIso(existing.nextOccurrenceAt ?? existing.dueAt) : null;

  const [kind, setKind] = useState<'payment' | 'charge'>(existing?.kind ?? 'payment');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing?.amountCents ?? 0);
  const [date, setDate] = useState(due?.date ?? addDays(today, 3));
  const [time, setTime] = useState(due?.time ?? '09:00');
  const [recurrence, setRecurrence] = useState<ReminderInput['recurrence']>(
    existing?.recurrence ?? 'none',
  );
  const [offsets, setOffsets] = useState<number[]>(existing?.offsetsMin ?? [1440]);
  const [channels, setChannels] = useState<ReminderChannel[]>(existing?.channels ?? ['push']);
  const [cpName, setCpName] = useState(existing?.counterpartyName ?? '');
  const [cpPhone, setCpPhone] = useState(existing?.counterpartyPhone ?? '');
  const [cpEmail, setCpEmail] = useState(existing?.counterpartyEmail ?? '');
  const [notifyCp, setNotifyCp] = useState(existing?.notifyCounterparty ?? false);
  const [cpChannels, setCpChannels] = useState<('email' | 'sms' | 'whatsapp')[]>(
    existing?.counterpartyChannels.length ? existing.counterpartyChannels : ['whatsapp'],
  );
  const [consent, setConsent] = useState(existing?.notifyCounterparty ?? false);
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string>();

  const p = profile.data;
  const warnings: string[] = [];
  if (channels.includes('email') && !p?.email)
    warnings.push('Para receber por e-mail, entre com seu e-mail (Configurações → Conta).');
  if (
    (channels.includes('sms') && !p?.sms_opt_in) ||
    (channels.includes('whatsapp') && !p?.whatsapp_opt_in)
  ) {
    warnings.push(
      'Cadastre seu celular e autorize SMS/WhatsApp em Configurações → Canais de contato.',
    );
  }

  const paidChannel = (c: ReminderChannel) =>
    (c === 'sms' && !canSms) || (c === 'whatsapp' && !canWhats);

  const onSave = async () => {
    setError(undefined);
    const phone = cpPhone.trim() ? normalizeBrPhone(cpPhone) : null;
    if (cpPhone.trim() && !phone)
      return setError('Celular do devedor inválido. Ex.: (11) 99999-8888');
    if (notifyCp && !consent) return setError('Confirme que a pessoa autorizou receber lembretes.');
    const input = {
      kind,
      title: title.trim(),
      amountCents: amount > 0 ? amount : null,
      dueAt: toDueIso(date, time),
      recurrence,
      offsetsMin: offsets.length ? offsets : [0],
      channels,
      counterpartyName: kind === 'charge' && cpName.trim() ? cpName.trim() : null,
      counterpartyPhone: kind === 'charge' ? phone : null,
      counterpartyEmail: kind === 'charge' && cpEmail.trim() ? cpEmail.trim().toLowerCase() : null,
      notifyCounterparty: kind === 'charge' && notifyCp,
      counterpartyChannels: kind === 'charge' && notifyCp ? cpChannels : [],
      note: note.trim() || null,
    };
    const parsed = reminderInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
    if (new Date(parsed.data.dueAt).getTime() < Date.now() && recurrence === 'none') {
      return setError('Escolha uma data futura.');
    }
    try {
      if (channels.includes('push')) await registerPushToken(true).catch(() => false);
      await save.mutateAsync({ id, input: parsed.data });
      analytics.track('reminder_created', {
        kind,
        channels: channels.join(','),
        counterparty: input.notifyCounterparty,
      });
      router.back();
    } catch (e) {
      const feature = upgradeFeatureFromError(e);
      if (feature) return openPaywall(feature);
      setError((e as Error).message);
    }
  };

  const runAction = (action: 'done' | 'pause' | 'resume' | 'delete') => {
    if (!id) return;
    const go = () =>
      act
        .mutateAsync({ id, action })
        .then(() => action !== 'pause' && action !== 'resume' && router.back());
    if (action === 'delete') {
      Alert.alert('Excluir lembrete?', 'Os envios agendados serão cancelados.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void go() },
      ]);
    } else void go();
  };

  return (
    <Screen testID="screen-reminder-form" edges={['top', 'bottom']}>
      <ScreenHeader title={id ? 'Editar lembrete' : 'Novo lembrete'} />

      <Segmented
        testID="reminder-kind"
        options={[
          { value: 'payment', label: 'Vou pagar' },
          { value: 'charge', label: 'Vou receber' },
        ]}
        value={kind}
        onChange={setKind}
      />

      <TextField
        testID="reminder-title"
        label={kind === 'payment' ? 'O que pagar' : 'O que cobrar'}
        placeholder={kind === 'payment' ? 'Ex.: Conta de luz' : 'Ex.: Empréstimo para o João'}
        value={title}
        onChangeText={setTitle}
        maxLength={60}
      />
      <MoneyField
        label="Valor (opcional)"
        value={amount}
        onChange={setAmount}
        testID="reminder-amount"
      />

      <View style={{ gap: t.spacing.sm }}>
        <AppText variant="caption" color="inkMuted" weight="semibold">
          Vencimento: {formatRelativeDay(date)} às {time}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {quickDates(today).map((q) => (
            <Chip
              key={q.label}
              label={q.label}
              selected={date === q.value}
              onPress={() => setDate(q.value)}
            />
          ))}
          <Chip
            label="−1 dia"
            onPress={() => setDate(addDays(date, -1))}
            accessibilityLabel="Um dia antes"
          />
          <Chip
            label="+1 dia"
            onPress={() => setDate(addDays(date, 1))}
            accessibilityLabel="Um dia depois"
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {TIME_OPTIONS.map((h) => (
            <Chip key={h} label={h} selected={time === h} onPress={() => setTime(h)} />
          ))}
        </View>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <AppText variant="caption" color="inkMuted" weight="semibold">
          Repetir
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {RECURRENCES.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              selected={recurrence === r.value}
              onPress={() => setRecurrence(r.value)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <AppText variant="caption" color="inkMuted" weight="semibold">
          Quando avisar (até 4)
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {OFFSET_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={offsets.includes(o.value)}
              onPress={() =>
                setOffsets((cur) =>
                  cur.includes(o.value) || cur.length < 4 ? toggle(cur, o.value) : cur,
                )
              }
            />
          ))}
        </View>
      </View>

      <View style={{ gap: t.spacing.sm }}>
        <AppText variant="caption" color="inkMuted" weight="semibold">
          Como me avisar
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {(['push', 'email', 'sms', 'whatsapp'] as const).map((c) => {
            const locked = paidChannel(c);
            return (
              <Chip
                key={c}
                testID={`channel-${c}`}
                label={CHANNEL_LABEL[c]}
                tone={locked ? 'pro' : 'default'}
                selected={channels.includes(c)}
                icon={<Icon name={locked ? 'lock' : CHANNEL_ICON[c]} size={14} />}
                accessibilityLabel={locked ? `${CHANNEL_LABEL[c]}, recurso Pro` : CHANNEL_LABEL[c]}
                onPress={() =>
                  locked ? openPaywall(`reminders.${c}`) : setChannels((cur) => toggle(cur, c))
                }
              />
            );
          })}
        </View>
        {!canSms || !canWhats ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.xs, alignItems: 'center' }}>
            <ProBadge />
            <AppText variant="caption" color="inkMuted">
              SMS e WhatsApp fazem parte do Pro.
            </AppText>
          </View>
        ) : null}
        {warnings.map((w) => (
          <Pressable
            key={w}
            onPress={() => router.push(w.includes('celular') ? '/settings/contact' : '/login')}
          >
            <AppText variant="caption" color="danger">
              {w}
            </AppText>
          </Pressable>
        ))}
      </View>

      {kind === 'charge' ? (
        <Card>
          <View style={{ gap: t.spacing.md }}>
            <AppText variant="headline">Quem deve</AppText>
            <TextField
              label="Nome"
              value={cpName}
              onChangeText={setCpName}
              maxLength={60}
              placeholder="Ex.: João"
            />
            <TextField
              label="Celular (para SMS/WhatsApp)"
              value={cpPhone}
              onChangeText={setCpPhone}
              keyboardType="phone-pad"
              placeholder="(11) 99999-8888"
              testID="counterparty-phone"
            />
            <TextField
              label="E-mail"
              value={cpEmail}
              onChangeText={setCpEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="joao@exemplo.com"
            />
            <Chip
              testID="notify-counterparty"
              label="Enviar o lembrete também para essa pessoa"
              selected={notifyCp}
              onPress={() => setNotifyCp((v) => !v)}
              icon={<Icon name={notifyCp ? 'check' : 'users'} size={14} />}
            />
            {notifyCp ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {(['whatsapp', 'sms', 'email'] as const).map((c) => {
                    const locked = paidChannel(c);
                    return (
                      <Chip
                        key={c}
                        label={CHANNEL_LABEL[c]}
                        tone={locked ? 'pro' : 'default'}
                        selected={cpChannels.includes(c)}
                        icon={<Icon name={locked ? 'lock' : CHANNEL_ICON[c]} size={14} />}
                        onPress={() =>
                          locked
                            ? openPaywall(`reminders.${c}`)
                            : setCpChannels((cur) => toggle(cur, c))
                        }
                      />
                    );
                  })}
                </View>
                <Chip
                  testID="counterparty-consent"
                  label="A pessoa autorizou receber estes lembretes"
                  selected={consent}
                  onPress={() => setConsent((v) => !v)}
                  icon={<Icon name={consent ? 'check' : 'lock'} size={14} />}
                />
                <AppText variant="caption" color="inkMuted">
                  A mensagem leva seu nome e o título da cobrança. Envie apenas para quem concordou
                  (LGPD).
                </AppText>
              </>
            ) : null}
          </View>
        </Card>
      ) : null}

      <TextField
        label="Observação (só para você)"
        value={note}
        onChangeText={setNote}
        maxLength={280}
        multiline
      />

      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      <Button
        testID="reminder-save"
        label={id ? 'Salvar alterações' : 'Criar lembrete'}
        onPress={onSave}
        loading={save.isPending}
      />

      {id && existing ? (
        <>
          <Card>
            <View style={{ gap: t.spacing.sm }}>
              <AppText variant="headline">Ações</AppText>
              <Button
                label={existing.kind === 'payment' ? 'Marcar como pago' : 'Marcar como recebido'}
                variant="secondary"
                onPress={() => runAction('done')}
              />
              <Button
                label={existing.status === 'paused' ? 'Retomar avisos' : 'Pausar avisos'}
                variant="secondary"
                onPress={() => runAction(existing.status === 'paused' ? 'resume' : 'pause')}
              />
              <AppText variant="caption" color="inkMuted">
                Testar agora (envia só para você):
              </AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {existing.channels.map((c) => (
                  <Chip
                    key={c}
                    label={CHANNEL_LABEL[c]}
                    icon={<Icon name={CHANNEL_ICON[c]} size={14} />}
                    onPress={async () => {
                      const r = await test.mutateAsync({ id, channel: c }).catch((e: Error) => ({
                        outcome: 'failed',
                        status: 'failed',
                        last_error: e.message,
                      }));
                      Alert.alert(
                        CHANNEL_LABEL[c],
                        r.status === 'sent'
                          ? 'Enviado!'
                          : r.status === 'simulated'
                            ? 'Envio simulado: o provedor deste canal ainda não foi configurado no servidor.'
                            : `Não enviado: ${r.last_error ?? 'erro'}`,
                      );
                    }}
                  />
                ))}
              </View>
              <Button
                label="Excluir lembrete"
                variant="danger"
                onPress={() => runAction('delete')}
              />
            </View>
          </Card>
          <Card padding={t.spacing.md}>
            <AppText variant="headline">Envios</AppText>
            {(deliveries.data ?? []).length === 0 ? (
              <AppText variant="caption" color="inkMuted">
                Nenhum envio ainda.
              </AppText>
            ) : (
              deliveries.data!.map((d) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    gap: t.spacing.sm,
                    paddingVertical: t.spacing.xs,
                    alignItems: 'center',
                  }}
                >
                  <Icon name={CHANNEL_ICON[d.channel]} size={16} color="inkMuted" />
                  <AppText variant="caption" style={{ flex: 1 }}>
                    {CHANNEL_LABEL[d.channel]}
                    {d.recipient === 'counterparty' ? ' · devedor' : ''} ·{' '}
                    {new Date(d.sent_at ?? d.scheduled_for).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={
                      d.status === 'failed'
                        ? 'danger'
                        : d.status === 'sent'
                          ? 'primary'
                          : 'inkMuted'
                    }
                  >
                    {STATUS_LABEL[d.status] ?? d.status}
                  </AppText>
                </View>
              ))
            )}
          </Card>
          {existing.amountCents ? (
            <AppText variant="caption" color="inkSubtle" align="center">
              Valor: {formatBRL(existing.amountCents)}
            </AppText>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
