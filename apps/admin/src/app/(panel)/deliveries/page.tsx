import { requireAdmin } from '@/lib/auth';
import { roleAtLeast } from '@/lib/roles';
import { apiFetch } from '@/lib/api';
import { friendlyError, type ActionResult } from '@/lib/action';
import { PageHeader } from '@/components/page-header';
import { ActionForm } from '@/components/action-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata = { title: 'Lembretes e envios' };

type Channel = 'push' | 'email' | 'sms' | 'whatsapp';
interface Data {
  deliveries: {
    id: string;
    channel: Channel;
    recipient: 'self' | 'counterparty';
    status: string;
    scheduled_for: string;
    sent_at: string | null;
    attempts: number;
    last_error: string | null;
    provider: string | null;
    user_email: string | null;
    title: string;
    kind: 'payment' | 'charge';
  }[];
  last7d: { channel: Channel; status: string; n: number }[];
  channels: Record<Channel, 'configured' | 'simulated'>;
}

const CHANNEL: Record<Channel, string> = {
  push: 'Push',
  email: 'E-mail',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};
const STATUS: Record<string, string> = {
  pending: 'Agendado',
  sending: 'Enviando',
  sent: 'Enviado',
  simulated: 'Simulado',
  failed: 'Falhou',
  skipped: 'Não enviado',
};

async function testChannel(fd: FormData): Promise<ActionResult> {
  'use server';
  await requireAdmin('editor');
  try {
    const r = await apiFetch<{ status: string; provider: string }>('POST', '/admin/channels/test', {
      channel: String(fd.get('channel')),
      to: String(fd.get('to') ?? '').trim(),
    });
    return {
      ok: true,
      message:
        r.status === 'simulated'
          ? 'Simulado: provedor não configurado'
          : `Enviado via ${r.provider}`,
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireAdmin('viewer');
  const { status = '' } = await searchParams;
  const data = await apiFetch<Data>(
    'GET',
    `/admin/deliveries${status ? `?status=${encodeURIComponent(status)}` : ''}`,
  );
  const total = (ch: Channel, st: string) =>
    data.last7d.find((x) => x.channel === ch && x.status === st)?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Lembretes e envios"
        description="Push, e-mail, SMS e WhatsApp enviados pelo worker. Canais sem credenciais funcionam em modo simulado (registram, mas não entregam)."
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(CHANNEL) as Channel[]).map((ch) => (
          <Card key={ch} className="rounded-[20px]">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-sm font-medium">{CHANNEL[ch]}</CardTitle>
              <Badge variant={data.channels[ch] === 'configured' ? 'default' : 'outline'}>
                {data.channels[ch] === 'configured' ? 'Ativo' : 'Simulado'}
              </Badge>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="tabular text-2xl font-extrabold">
                {total(ch, 'sent') + total(ch, 'simulated')}
              </p>
              <p className="text-muted-foreground">
                enviados em 7 dias · {total(ch, 'failed')} falhas · {total(ch, 'skipped')} não
                enviados
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {roleAtLeast(session.role, 'editor') ? (
        <Card className="mt-6 rounded-[20px]">
          <CardHeader>
            <CardTitle>Testar canal</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={testChannel} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="channel">Canal</Label>
                <select
                  id="channel"
                  name="channel"
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              <div className="min-w-64 flex-1 space-y-1.5">
                <Label htmlFor="to">Destino</Label>
                <Input id="to" name="to" placeholder="e-mail ou +5511999998888" required />
              </div>
              <Button type="submit">Enviar teste</Button>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}

      <form className="mt-6 mb-3 flex gap-2">
        <label htmlFor="status" className="sr-only">
          Filtrar por status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      <div className="rounded-[20px] border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Lembrete</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.deliveries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nenhum envio.
                </TableCell>
              </TableRow>
            ) : (
              data.deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="tabular whitespace-nowrap">
                    {new Date(d.sent_at ?? d.scheduled_for).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </TableCell>
                  <TableCell>{d.user_email ?? 'anônimo'}</TableCell>
                  <TableCell>
                    {d.kind === 'payment' ? 'Pagar' : 'Receber'} · {d.title}
                  </TableCell>
                  <TableCell>
                    {CHANNEL[d.channel]}
                    {d.recipient === 'counterparty' ? ' · devedor' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        d.status === 'failed'
                          ? 'destructive'
                          : d.status === 'sent'
                            ? 'default'
                            : 'outline'
                      }
                    >
                      {STATUS[d.status] ?? d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {d.last_error ?? d.provider ?? ''}
                    {d.attempts > 1 ? ` · ${d.attempts} tentativas` : ''}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
