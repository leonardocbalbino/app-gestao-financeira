import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from './AppText';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}

export function Segmented<T extends string>({ options, value, onChange, testID }: Props<T>) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.divider,
        borderRadius: t.radii.button,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radii.button - 4,
              backgroundColor: selected ? t.colors.surface : 'transparent',
            }}
          >
            <AppText variant="caption" weight="bold" color={selected ? 'ink' : 'inkMuted'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
