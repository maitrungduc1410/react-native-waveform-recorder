import type { PropsWithChildren } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/**
 * Tiny wrapper used by every example screen so the home indicator + the
 * left/right device cutouts don't overlap the recorder UI.
 *
 * The native-stack navigator already adds the top inset via its header, so
 * by default we only consume the bottom + sides. Pass `edges` to opt back
 * in to additional edges (e.g. headerless screens).
 */
export function ScreenContainer({
  children,
  style,
  edges = ['bottom', 'left', 'right'],
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  edges?: ReadonlyArray<Edge>;
}>) {
  return (
    <SafeAreaView style={[defaults, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const defaults: ViewStyle = { flex: 1 };
