import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useExampleTheme } from '../theme';

/**
 * Generic "section card" used across primitives + section C. Picks up the
 * surface / text colors from the example app's light/dark theme.
 */
export function DemoCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const theme = useExampleTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 14,
          marginHorizontal: 16,
          marginVertical: 8,
          borderWidth: 1,
          borderColor: theme.border,
        },
        title: { color: theme.text, fontSize: 16, fontWeight: '700' },
        description: { color: theme.textDim, fontSize: 12, marginTop: 4 },
        body: { marginTop: 12 },
      }),
    [theme]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}
