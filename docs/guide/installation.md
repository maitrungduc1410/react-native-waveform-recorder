---
description: "Install react-native-waveform-recorder, add the microphone permission on iOS and Android, set up background recording and configure the Expo config plugin."
---

# Installation {#installation}

## Requirements {#requirements}

- React Native with the **New Architecture** (Fabric). The library is built against React Native 0.85 and has no Old Architecture implementation.
- iOS: the minimum iOS version of your React Native release (the podspec uses `min_ios_version_supported`).
- Android: API 24 or later. The `opus` format needs API 29.

## Install the package {#install-the-package}

::: code-group

```sh [npm]
npm install react-native-waveform-recorder
```

```sh [yarn]
yarn add react-native-waveform-recorder
```

:::

Then install the iOS pods:

```sh
npx pod-install
```

Using Expo? Skip to [Expo](#expo).

## iOS permission {#ios-permission}

Add a microphone usage description to `Info.plist`. iOS shows it in the permission prompt and rejects apps that record without it.

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Record voice messages.</string>
```

The system prompt appears on the first `start()`. If the user refuses, `onPermissionDenied` fires and nothing is recorded. After a refusal iOS does not prompt again; send the user to the Settings app, for example with `Linking.openSettings()`.

## Android permission {#android-permission}

The library's manifest already declares `RECORD_AUDIO`, so you do not need to add it. On every `start()`, the JavaScript wrapper checks the runtime permission and requests it if needed. If it is refused, `onPermissionDenied` fires and the native recorder is not started.

To ask earlier, for example on an onboarding screen, call `ensureMicrophonePermission()`:

```ts
import { ensureMicrophonePermission } from 'react-native-waveform-recorder';

const granted = await ensureMicrophonePermission();
```

On Android it resolves `true` when `RECORD_AUDIO` is granted. On iOS it resolves `true` right away and the system prompt still appears on the first `start()`.

## Background recording {#background-recording}

To keep recording while the app is in the background, set the `backgroundRecording` prop and do the native setup below.

**iOS:** add the `audio` background mode.

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

If `backgroundRecording` is `true` and this entry is missing, `onError` fires once with code `'background-capability'`.

**Android:** declare the foreground service in `android/app/src/main/AndroidManifest.xml`, inside `<application>`:

```xml
<service
    android:name="com.waveformrecorder.WaveformRecorderBackgroundService"
    android:foregroundServiceType="microphone"
    android:exported="false" />
```

The `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions are already merged from the library's manifest. While recording, the service shows a notification whose text you can set with `backgroundNotificationTitle` and `backgroundNotificationBody`. If the service is not declared, the library only logs a warning to logcat, so check that the notification appears.

See [Platform notes](/guide/platform-notes#background-recording) for details.

## Expo {#expo}

The library works in an Expo [development build](https://docs.expo.dev/develop/development-builds/introduction/) (EAS Build or `npx expo prebuild`). It does not work in Expo Go, which cannot load third-party native code.

1. Install the package:

   ```sh
   npx expo install react-native-waveform-recorder
   ```

2. Add the config plugin to `app.json` or `app.config.js`:

   ```json
   {
     "expo": {
       "plugins": [
         [
           "react-native-waveform-recorder",
           {
             "microphonePermission": "Allow $(PRODUCT_NAME) to record voice messages.",
             "backgroundRecording": false
           }
         ]
       ]
     }
   }
   ```

   Both options are optional, so `"plugins": ["react-native-waveform-recorder"]` works too.

3. Regenerate the native projects and rebuild your development client:

   ```sh
   npx expo prebuild --clean
   ```

### Config plugin options {#config-plugin-options}

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `microphonePermission` | `string \| false` | Keeps an existing `NSMicrophoneUsageDescription`, otherwise `'Allow $(PRODUCT_NAME) to access your microphone to record voice messages.'` | Sets the iOS `NSMicrophoneUsageDescription`. Pass `false` to leave `Info.plist` untouched. |
| `backgroundRecording` | `boolean` | `false` | When `true`, adds the iOS `audio` background mode, the Android foreground service and the `RECORD_AUDIO`, `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions. You still set the `backgroundRecording` prop on the view. |

Pick an Expo SDK that ships a React Native version with the New Architecture enabled, which is the default on recent SDKs.
