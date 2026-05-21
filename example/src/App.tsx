import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScreenContainer } from './components/ScreenContainer';
import { RECIPE_HEADER_THEMES, useExampleTheme } from './theme';
import PrimitivesScreen from './screens/PrimitivesScreen';
import WhatsAppScreen from './screens/WhatsAppScreen';
import MessengerScreen from './screens/MessengerScreen';
import InstagramScreen from './screens/InstagramScreen';
import SlackScreen from './screens/SlackScreen';
import TikTokScreen from './screens/TikTokScreen';
import ZaloScreen from './screens/ZaloScreen';
import GestureScreen from './screens/GestureScreen';
import SilenceScreen from './screens/SilenceScreen';
import SamplesExportScreen from './screens/SamplesExportScreen';
import StressTestScreen from './screens/StressTestScreen';
import PcmStreamScreen from './screens/PcmStreamScreen';
import PreviewScreen from './screens/PreviewScreen';

type RouteEntry = {
  name: keyof RootStackParamList;
  label: string;
  blurb: string;
  /** Optional accent strip color (used as left-border on the card). */
  accent?: string;
};

const ROUTES: RouteEntry[] = [
  {
    name: 'Primitives',
    label: 'Primitives',
    blurb: '11 demo cards exercising every prop, command, and event.',
    accent: '#3478f6',
  },
  {
    name: 'WhatsApp',
    label: 'WhatsApp recipe',
    blurb:
      'Chat composer with pause-to-preview + red-mic continue-recording UX.',
    accent: '#00a884',
  },
  {
    name: 'Messenger',
    label: 'Messenger recipe',
    blurb: 'Compact composer pill + bottom-sheet preview with scrub hint.',
    accent: '#0084ff',
  },
  {
    name: 'Instagram',
    label: 'Instagram recipe',
    blurb: 'Solid blue pill, dotted future bars, edit / new chips.',
    accent: '#0095f6',
  },
  {
    name: 'Slack',
    label: 'Slack recipe',
    blurb:
      'In-line composer pill, immediate send (no preview), keyboard stays open.',
    accent: '#007a5a',
  },
  {
    name: 'TikTok',
    label: 'TikTok recipe',
    blurb: 'Minimal trash / scrolling waveform / send. No preview state.',
    accent: '#fe2c55',
  },
  {
    name: 'Zalo',
    label: 'Zalo recipe',
    blurb: 'Light-mode pill with explicit Delete / Preview / Send action row.',
    accent: '#0068ff',
  },
  {
    name: 'Preview',
    label: 'Preview API',
    blurb:
      'Drive enterPreview / exitPreview / togglePreviewPlayback / seekPreview directly, with live position + onSeek log.',
  },
  {
    name: 'Gesture',
    label: 'Slide gestures',
    blurb:
      'Native slide-to-cancel + slide-to-lock with live onSlideProgress visualization.',
  },
  {
    name: 'Silence',
    label: 'Silence detection',
    blurb:
      'Auto-stop after a configurable window of silence. Tweak threshold + timeout live.',
  },
  {
    name: 'SamplesExport',
    label: '64-sample export',
    blurb:
      'WhatsApp-compatible 64-bucket array rendered three ways for chat-bubble parity.',
  },
  {
    name: 'StressTest',
    label: 'Long-recording stress test',
    blurb:
      '30-minute run with tick / peak / duration counters to spot leaks or dropped frames.',
  },
  {
    name: 'PcmStream',
    label: 'Raw PCM stream',
    blurb:
      'Opt-in /pcm-stream subpath: WAV chunks decoded to Int16/Float32 in JS for VAD/STT pipelines.',
  },
];

export type RootStackParamList = {
  Home: undefined;
  Primitives: undefined;
  WhatsApp: undefined;
  Messenger: undefined;
  Instagram: undefined;
  Slack: undefined;
  TikTok: undefined;
  Zalo: undefined;
  Preview: undefined;
  Gesture: undefined;
  Silence: undefined;
  SamplesExport: undefined;
  StressTest: undefined;
  PcmStream: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const theme = useExampleTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: theme.bg },
        body: { padding: 24, paddingBottom: 60 },
        title: { color: theme.text, fontSize: 22, fontWeight: '800' },
        subtitle: {
          color: theme.textDim,
          fontSize: 13,
          marginTop: 4,
          marginBottom: 24,
        },
        routeCard: {
          padding: 16,
          borderRadius: 14,
          marginVertical: 6,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
          flexDirection: 'row',
        },
        accentBar: {
          width: 4,
          borderRadius: 2,
          marginRight: 12,
          alignSelf: 'stretch',
        },
        cardBody: { flex: 1 },
        routeLabel: { color: theme.text, fontSize: 16, fontWeight: '700' },
        routeBlurb: { color: theme.textDim, fontSize: 12, marginTop: 4 },
      }),
    [theme]
  );

  return (
    <ScreenContainer style={styles.root}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>react-native-waveform-recorder</Text>
        <Text style={styles.subtitle}>
          Live waveform voice recorder · Fabric · zero JS in the hot path.
        </Text>
        {ROUTES.map((route) => (
          <Pressable
            key={route.name}
            style={({ pressed }) => [
              styles.routeCard,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => navigation.navigate(route.name)}
          >
            <View
              style={[
                styles.accentBar,
                { backgroundColor: route.accent ?? theme.accent },
              ]}
            />
            <View style={styles.cardBody}>
              <Text style={styles.routeLabel}>{route.label}</Text>
              <Text style={styles.routeBlurb}>{route.blurb}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

/**
 * Build a per-screen header style override. Recipe screens hard-code their
 * own brand palette regardless of OS scheme, so the navigation header for
 * those screens must follow suit — otherwise a light Zalo body shows up
 * under a dark nav bar (or vice versa) and looks broken.
 */
function recipeHeader(key: keyof typeof RECIPE_HEADER_THEMES) {
  const t = RECIPE_HEADER_THEMES[key];
  return {
    headerStyle: { backgroundColor: t.bg },
    headerTitleStyle: { color: t.text },
    headerTintColor: t.text,
    contentStyle: { backgroundColor: t.bg },
  } as const;
}

export default function App() {
  const theme = useExampleTheme();
  const navTheme: Theme = useMemo(() => {
    const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.bg,
        card: theme.headerBg,
        text: theme.headerText,
        border: theme.border,
        primary: theme.accent,
      },
    };
  }, [theme]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme.barStyle} />
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: theme.headerBg },
            headerTitleStyle: { color: theme.headerText },
            headerTintColor: theme.headerText,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Recipes' }}
          />
          <Stack.Screen
            name="Primitives"
            component={PrimitivesScreen}
            options={{ title: 'Primitives' }}
          />
          <Stack.Screen
            name="WhatsApp"
            component={WhatsAppScreen}
            options={recipeHeader('whatsapp')}
          />
          <Stack.Screen
            name="Messenger"
            component={MessengerScreen}
            options={recipeHeader('messenger')}
          />
          <Stack.Screen
            name="Instagram"
            component={InstagramScreen}
            options={recipeHeader('instagram')}
          />
          <Stack.Screen
            name="Slack"
            component={SlackScreen}
            options={recipeHeader('slack')}
          />
          <Stack.Screen
            name="TikTok"
            component={TikTokScreen}
            options={recipeHeader('tiktok')}
          />
          <Stack.Screen
            name="Zalo"
            component={ZaloScreen}
            options={recipeHeader('zalo')}
          />
          <Stack.Screen
            name="Preview"
            component={PreviewScreen}
            options={{ title: 'Preview API' }}
          />
          <Stack.Screen
            name="Gesture"
            component={GestureScreen}
            options={{ title: 'Slide gestures' }}
          />
          <Stack.Screen
            name="Silence"
            component={SilenceScreen}
            options={{ title: 'Silence detection' }}
          />
          <Stack.Screen
            name="SamplesExport"
            component={SamplesExportScreen}
            options={{ title: '64-sample export' }}
          />
          <Stack.Screen
            name="StressTest"
            component={StressTestScreen}
            options={{ title: 'Stress test' }}
          />
          <Stack.Screen
            name="PcmStream"
            component={PcmStreamScreen}
            options={{ title: 'PCM stream' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
