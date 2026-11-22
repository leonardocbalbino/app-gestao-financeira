import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { Button } from '@/components/ui';
import { env } from '@/lib/env';
import { signInWithGoogleIdToken } from './authService';

export const isGoogleConfigured = () =>
  !!(env.googleIosClientId || env.googleAndroidClientId || env.googleWebClientId);

interface Props {
  busy: boolean;
  onStart: () => void;
  onDone: (ok: boolean, error?: unknown) => void;
}

/** "Continuar com Google": obtém o id_token (OIDC) e a API valida assinatura e audiência. */
export function GoogleButton({ busy, onStart, onDone }: Props) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId || undefined,
    androidClientId: env.googleAndroidClientId || undefined,
    webClientId: env.googleWebClientId || undefined,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      onDone(false);
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) {
      onDone(false, new Error('O Google não retornou o token.'));
      return;
    }
    signInWithGoogleIdToken(idToken).then(
      () => onDone(true),
      (e) => onDone(false, e),
    );
  }, [response, onDone]);

  return (
    <Button
      label="Continuar com Google"
      variant="secondary"
      disabled={!request}
      loading={busy}
      onPress={() => {
        onStart();
        void promptAsync();
      }}
    />
  );
}
