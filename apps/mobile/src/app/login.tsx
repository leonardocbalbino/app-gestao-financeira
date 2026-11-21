import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Card, Icon, Screen, TextField } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  sendEmailCode,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
  type EmailFlow,
} from '@/auth/authService';
import { useAuth } from '@/auth/AuthProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function friendly(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
  if (/token|otp|expired|invalid/i.test(msg)) return 'Código inválido ou expirado.';
  if (/network|fetch/i.test(msg)) return 'Sem conexão. Verifique sua internet.';
  return msg || 'Não foi possível entrar. Tente novamente.';
}

export default function LoginScreen() {
  const t = useTheme();
  const { online } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [flow, setFlow] = useState<EmailFlow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(undefined);
    try {
      const r = await fn();
      if (r !== 'cancelled') return true;
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(null);
    }
    return false;
  };

  const done = () => {
    Alert.alert('Pronto!', 'Sua conta está conectada.');
    router.back();
  };

  return (
    <Screen testID="screen-login">
      <ScreenHeader title="Entrar ou criar conta" />
      <AppText variant="body" color="inkMuted">
        Seus dados continuam no aparelho. Com uma conta você mantém a assinatura em vários aparelhos
        e pode ativar o backup na nuvem.
      </AppText>

      {!online ? (
        <Card tone="danger">
          <AppText variant="caption" color="danger">
            Login indisponível nesta versão (servidor não configurado).
          </AppText>
        </Card>
      ) : null}

      <View style={{ gap: t.spacing.md }}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              t.scheme === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={t.radii.button}
            style={{ height: 52 }}
            onPress={async () => (await run('apple', signInWithApple)) && done()}
          />
        ) : null}
        <Button
          label="Continuar com Google"
          variant="secondary"
          disabled={!online}
          loading={busy === 'google'}
          onPress={async () => (await run('google', signInWithGoogle)) && done()}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
        <AppText variant="caption" color="inkMuted">
          ou com e-mail
        </AppText>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.border }} />
      </View>

      <Card>
        <View style={{ gap: t.spacing.md }}>
          {!flow ? (
            <>
              <TextField
                testID="login-email"
                label="E-mail"
                placeholder="voce@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              <Button
                label="Enviar código"
                disabled={!online || !EMAIL_RE.test(email.trim())}
                loading={busy === 'send'}
                onPress={() =>
                  run('send', async () => setFlow(await sendEmailCode(email.trim().toLowerCase())))
                }
              />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm, alignItems: 'center' }}>
                <Icon name="check" color="primary" />
                <AppText variant="caption" color="inkMuted" style={{ flex: 1 }}>
                  Enviamos um código para {email}. Ele expira em alguns minutos.
                </AppText>
              </View>
              <TextField
                testID="login-code"
                label="Código"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
                value={code}
                onChangeText={setCode}
              />
              <Button
                label="Confirmar"
                disabled={code.trim().length < 6}
                loading={busy === 'verify'}
                onPress={async () =>
                  (await run('verify', () =>
                    verifyEmailCode(email.trim().toLowerCase(), code.trim(), flow),
                  )) && done()
                }
              />
              <Button label="Usar outro e-mail" variant="ghost" onPress={() => setFlow(null)} />
            </>
          )}
        </View>
      </Card>

      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert" align="center">
          {error}
        </AppText>
      ) : null}
    </Screen>
  );
}
