import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface EmptyProps {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

export function EmptyState({ icon, title, message, actionLabel, onAction, testID }: EmptyProps) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', paddingVertical: t.spacing.xxxl, gap: t.spacing.md }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: t.radii.card,
          backgroundColor: t.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={28} color="primary" />
      </View>
      <AppText variant="headline" align="center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" color="inkMuted" align="center" style={{ maxWidth: 280 }}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} size="md" />
      ) : null}
    </View>
  );
}

interface ErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Algo deu errado. Tente novamente.', onRetry }: ErrorProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', paddingVertical: t.spacing.xxxl, gap: t.spacing.md }}
    >
      <AppText variant="headline" align="center">
        Ops!
      </AppText>
      <AppText variant="body" color="inkMuted" align="center">
        {message}
      </AppText>
      {onRetry ? (
        <Button
          label="Tentar novamente"
          variant="secondary"
          onPress={onRetry}
          fullWidth={false}
          size="md"
        />
      ) : null}
    </View>
  );
}
