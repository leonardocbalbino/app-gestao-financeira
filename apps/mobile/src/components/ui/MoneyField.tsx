import { centsFromDigits, formatBRL } from '@app/shared';
import { TextField } from './TextField';

interface Props {
  label: string;
  value: number;
  onChange: (cents: number) => void;
  error?: string;
  testID?: string;
}

/** Campo monetário: dígitos entram pela direita, exibido sempre como "R$ 0,00". */
export function MoneyField({ label, value, onChange, error, testID }: Props) {
  return (
    <TextField
      testID={testID}
      label={label}
      keyboardType="number-pad"
      value={formatBRL(value)}
      onChangeText={(v) => onChange(centsFromDigits(v))}
      error={error}
      style={{ fontVariant: ['tabular-nums'] }}
    />
  );
}
