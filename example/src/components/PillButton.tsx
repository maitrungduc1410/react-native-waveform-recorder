import { Pressable, StyleSheet, Text } from 'react-native';
import { useExampleTheme } from '../theme';

export type PillButtonVariant = 'neutral' | 'primary' | 'danger';

/** Reusable rounded-rectangle button used by the demo controls. */
export function PillButton({
  label,
  onPress,
  variant = 'neutral',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: PillButtonVariant;
  disabled?: boolean;
}) {
  const theme = useExampleTheme();
  const bg =
    variant === 'primary'
      ? theme.accent
      : variant === 'danger'
        ? theme.danger
        : theme.surfaceAlt;
  const fg =
    variant === 'neutral'
      ? theme.text
      : variant === 'primary'
        ? theme.accentText
        : '#ffffff';
  const border = variant === 'neutral' ? theme.border : 'transparent';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
