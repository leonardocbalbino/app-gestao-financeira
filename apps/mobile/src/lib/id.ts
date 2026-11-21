import * as Crypto from 'expo-crypto';

/** UUID v4 gerado no cliente (permite criar offline e sincronizar depois sem conflito de id). */
export function newId(): string {
  return Crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}
