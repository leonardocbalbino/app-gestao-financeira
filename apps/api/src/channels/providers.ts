import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config.ts';
import { ProviderError, type ChannelProviders, type SendResult } from './types.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Fetch = typeof fetch;

function log(channel: string, to: string, body: string) {
  // Em modo simulado registramos só o essencial (destino mascarado).
  const masked = to.replace(/.(?=.{4})/g, '•');
  console.info(`[simulado:${channel}] → ${masked}: ${body.slice(0, 120)}`);
}

/** Provedores reais quando configurados; caso contrário, simulação registrada. */
export function createProviders(cfg: Config, fetchImpl: Fetch = fetch): ChannelProviders {
  const mailer: Transporter | null = cfg.SMTP_URL ? nodemailer.createTransport(cfg.SMTP_URL) : null;
  const twilioReady = !!(cfg.TWILIO_ACCOUNT_SID && cfg.TWILIO_AUTH_TOKEN);

  async function twilio(
    to: string,
    from: string,
    extra: Record<string, string>,
  ): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.TWILIO_ACCOUNT_SID}/Messages.json`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.TWILIO_ACCOUNT_SID}:${cfg.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: from, ...extra }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      code?: number;
    };
    if (!res.ok) {
      // 21211/21614/63016...: número inválido/sem WhatsApp → definitivo
      const permanent = res.status === 400 && [21211, 21614, 21408, 63016].includes(json.code ?? 0);
      throw new ProviderError(`twilio ${res.status}: ${json.message ?? 'erro'}`, permanent);
    }
    return { status: 'sent', provider: 'twilio', messageId: json.sid };
  }

  return {
    async email(m) {
      if (!mailer) {
        log('email', m.to, m.subject);
        return { status: 'simulated', provider: 'simulator' };
      }
      try {
        const info = await mailer.sendMail({
          from: cfg.MAIL_FROM,
          to: m.to,
          subject: m.subject,
          text: m.text,
          html: m.html,
        });
        return { status: 'sent', provider: 'smtp', messageId: info.messageId };
      } catch (e) {
        throw new ProviderError(`smtp: ${(e as Error).message}`);
      }
    },

    async push(m) {
      if (!m.tokens.length) throw new ProviderError('sem dispositivos registrados', true);
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(cfg.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${cfg.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(
          m.tokens.map((to) => ({
            to,
            title: m.title,
            body: m.body,
            data: m.data,
            sound: 'default',
            priority: 'high',
          })),
        ),
      });
      if (!res.ok) throw new ProviderError(`expo ${res.status}`);
      const json = (await res.json()) as {
        data?: { status: 'ok' | 'error'; id?: string; details?: { error?: string } }[];
      };
      const tickets = json.data ?? [];
      const invalid = tickets
        .map((t, i) =>
          t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? m.tokens[i]! : null,
        )
        .filter((t): t is string => !!t);
      const ok = tickets.find((t) => t.status === 'ok');
      if (!ok)
        throw new ProviderError(
          'push recusado para todos os dispositivos',
          invalid.length === m.tokens.length,
          invalid,
        );
      if (invalid.length) {
        // entrega parcial: sinaliza tokens inválidos sem falhar o envio
        return { status: 'sent', provider: 'expo', messageId: ok.id, invalidTokens: invalid };
      }
      return { status: 'sent', provider: 'expo', messageId: ok.id };
    },

    async sms(to, body) {
      if (!twilioReady || !cfg.TWILIO_SMS_FROM) {
        log('sms', to, body);
        return { status: 'simulated', provider: 'simulator' };
      }
      return twilio(to, cfg.TWILIO_SMS_FROM, { Body: body });
    },

    async whatsapp(to, body, variables) {
      if (!twilioReady || !cfg.TWILIO_WHATSAPP_FROM) {
        log('whatsapp', to, body);
        return { status: 'simulated', provider: 'simulator' };
      }
      // Fora da janela de 24 h o WhatsApp exige template aprovado (Content SID).
      const extra: Record<string, string> = cfg.TWILIO_WHATSAPP_CONTENT_SID
        ? {
            ContentSid: cfg.TWILIO_WHATSAPP_CONTENT_SID,
            ContentVariables: JSON.stringify(variables ?? { 1: body }),
          }
        : { Body: body };
      return twilio(`whatsapp:${to}`, `whatsapp:${cfg.TWILIO_WHATSAPP_FROM}`, extra);
    },

    status() {
      return {
        email: mailer ? 'configured' : 'simulated',
        push: 'configured',
        sms: twilioReady && cfg.TWILIO_SMS_FROM ? 'configured' : 'simulated',
        whatsapp: twilioReady && cfg.TWILIO_WHATSAPP_FROM ? 'configured' : 'simulated',
      };
    },
  };
}
