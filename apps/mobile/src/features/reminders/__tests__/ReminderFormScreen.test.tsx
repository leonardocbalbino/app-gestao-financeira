import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createTestDb } from '@/test/testDb';
import { proEntitlements, renderWithProviders } from '@/test/renderWithProviders';
import { ReminderFormScreen } from '../ReminderFormScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (a: unknown) => mockPush(a), back: () => mockBack() },
}));
jest.mock('@/lib/env', () => ({ env: { apiUrl: 'http://api.test' } }));

const calls: { url: string; method: string; body: Record<string, unknown> | null }[] = [];
beforeEach(() => {
  calls.length = 0;
  mockPush.mockClear();
  mockBack.mockClear();
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method: init?.method ?? 'GET', body });
    return new Response(JSON.stringify({ id: 'r1', ...body }), { status: 201 });
  }) as unknown as typeof fetch;
});

describe('ReminderFormScreen', () => {
  it('Free: SMS/WhatsApp bloqueados levam ao paywall', async () => {
    const db = await createTestDb();
    await renderWithProviders(<ReminderFormScreen />, db);
    await fireEvent.press(await screen.findByTestId('channel-whatsapp'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { source: 'reminders.whatsapp' },
    });
  });

  it('cria cobrança avisando o devedor por WhatsApp (Pro) com consentimento', async () => {
    const db = await createTestDb();
    await renderWithProviders(<ReminderFormScreen />, db, { entitlements: proEntitlements() });
    await fireEvent.press(await screen.findByText('Vou receber'));
    await fireEvent.changeText(screen.getByTestId('reminder-title'), 'Empréstimo');
    await fireEvent.changeText(screen.getByTestId('reminder-amount'), '50000');
    await fireEvent.press(screen.getByTestId('channel-push')); // desmarca push
    await fireEvent.press(screen.getByTestId('channel-sms'));
    await fireEvent.changeText(screen.getByTestId('counterparty-phone'), '(21) 98888-7777');
    await fireEvent.press(screen.getByTestId('notify-counterparty'));

    // Sem consentimento: bloqueia
    await fireEvent.press(screen.getByTestId('reminder-save'));
    expect(
      await screen.findByText('Confirme que a pessoa autorizou receber lembretes.'),
    ).toBeTruthy();
    expect(calls).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('counterparty-consent'));
    await fireEvent.press(screen.getByTestId('reminder-save'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());

    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('http://api.test/v1/reminders');
    expect(post.body).toMatchObject({
      kind: 'charge',
      title: 'Empréstimo',
      amountCents: 50000,
      channels: ['sms'],
      counterpartyPhone: '+5521988887777',
      notifyCounterparty: true,
      counterpartyChannels: ['whatsapp'],
      offsetsMin: [1440],
    });
    expect(new Date(String(post.body!.dueAt)).getTime()).toBeGreaterThan(Date.now());
  });
});
