import { useRef } from 'react';
import { Pressable, TextInput, type TextInputInstance } from 'react-native';
import { centsFromDigits, formatBRL } from '@app/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/components/ui';

interface Props {
  value: number;
  onChange: (cents: number) => void;
  tone: 'expense' | 'income' | 'transfer';
  error?: string;
  autoFocus?: boolean;
}

/**
 * Valor grande estilo "caixa registradora": dígitos entram pela direita (sem vírgula manual).
 * O TextInput fica invisível e recebe o teclado numérico.
 */
export function AmountInput({ value, onChange, tone, error, autoFocus }: Props) {
  const t = useTheme();
  const ref = useRef<TextInputInstance>(null);
  const color = tone === 'expense' ? 'danger' : tone === 'income' ? 'primary' : 'ink';
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessibilityRole="none"
      style={{ alignItems: 'center', paddingVertical: t.spacing.lg }}
    >
      <AppText variant="caption" color="inkMuted">
        Valor
      </AppText>
      <AppText
        variant="display"
        tabular
        color={value ? color : 'inkSubtle'}
        style={{ fontSize: 40, lineHeight: 48 }}
        importantForAccessibility="no"
      >
        {formatBRL(value)}
      </AppText>
      <TextInput
        ref={ref}
        testID="amount-input"
        accessibilityLabel={`Valor, ${formatBRL(value)}`}
        accessibilityHint="Digite o valor em centavos; os dígitos entram pela direita"
        autoFocus={autoFocus}
        keyboardType="number-pad"
        value={value ? String(value) : ''}
        onChangeText={(text) => onChange(centsFromDigits(text))}
        caretHidden
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </Pressable>
  );
}
