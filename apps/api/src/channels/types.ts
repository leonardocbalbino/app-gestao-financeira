export interface SendResult {
  /** 'simulated' = provedor não configurado; a mensagem foi apenas registrada. */
  status: 'sent' | 'simulated';
  provider: string;
  messageId?: string;
  /** Push: tokens recusados (DeviceNotRegistered) numa entrega parcial. */
  invalidTokens?: string[];
}

export class ProviderError extends Error {
  constructor(
    message: string,
    /** Erro definitivo (não adianta tentar de novo: número inválido, token removido...). */
    readonly permanent = false,
    /** Tokens de push que devem ser invalidados. */
    readonly invalidTokens: string[] = [],
  ) {
    super(message);
  }
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface PushMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface ChannelProviders {
  email(m: EmailMessage): Promise<SendResult>;
  push(m: PushMessage): Promise<SendResult>;
  sms(to: string, body: string): Promise<SendResult>;
  whatsapp(to: string, body: string, variables?: Record<string, string>): Promise<SendResult>;
  /** Quais canais têm provedor real configurado (para o admin e para logs). */
  status(): Record<'email' | 'push' | 'sms' | 'whatsapp', 'configured' | 'simulated'>;
}
