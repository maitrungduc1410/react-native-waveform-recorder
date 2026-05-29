// @ts-check
//
// Expo config plugin for react-native-waveform-recorder.
//
// Wires up the native bits Expo's autolinking can't infer from the podspec /
// Android manifest-merger alone:
//
//   • iOS  — NSMicrophoneUsageDescription (required at build time) and, when
//            background recording is enabled, the `audio` UIBackgroundMode.
//   • Android — the foreground `<service>` declaration for
//            WaveformRecorderBackgroundService. The RECORD_AUDIO /
//            FOREGROUND_SERVICE* permissions are already merged in by the
//            library's own AndroidManifest.xml, so we only add the service
//            (and re-assert the permissions defensively).
//
// Written in plain JS so it ships without a build step. `@expo/config-plugins`
// is resolved from the consumer's Expo app at prebuild time.

const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

const SERVICE_NAME = 'com.waveformrecorder.WaveformRecorderBackgroundService';
const DEFAULT_MIC_PERMISSION =
  'Allow $(PRODUCT_NAME) to access your microphone to record voice messages.';

/**
 * @typedef {Object} WaveformRecorderPluginProps
 * @property {string | false} [microphonePermission]
 *   Text for iOS `NSMicrophoneUsageDescription`. Pass `false` to skip writing it
 *   (e.g. if you set it yourself elsewhere). Defaults to a generic message.
 * @property {boolean} [backgroundRecording]
 *   When `true`, adds the iOS `audio` UIBackgroundMode and the Android
 *   foreground-service declaration so `backgroundRecording` works. Default `false`.
 */

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {WaveformRecorderPluginProps} [props]
 */
function withIosMicrophone(config, props) {
  return withInfoPlist(config, (cfg) => {
    if (props.microphonePermission !== false) {
      cfg.modResults.NSMicrophoneUsageDescription =
        props.microphonePermission ||
        cfg.modResults.NSMicrophoneUsageDescription ||
        DEFAULT_MIC_PERMISSION;
    }

    if (props.backgroundRecording) {
      const modes = cfg.modResults.UIBackgroundModes || [];
      if (!modes.includes('audio')) {
        modes.push('audio');
      }
      cfg.modResults.UIBackgroundModes = modes;
    }

    return cfg;
  });
}

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {WaveformRecorderPluginProps} [props]
 */
function withAndroidBackgroundService(config, props) {
  if (!props.backgroundRecording) {
    return config;
  }

  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.RECORD_AUDIO',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  ]);

  return withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults
    );

    application.service = application.service || [];

    const already = application.service.find(
      (service) => service.$?.['android:name'] === SERVICE_NAME
    );
    if (!already) {
      application.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      });
    }

    return cfg;
  });
}

/**
 * @param {import('@expo/config-plugins').ExportedConfig} config
 * @param {WaveformRecorderPluginProps} [props]
 */
function withWaveformRecorder(config, props = {}) {
  config = withIosMicrophone(config, props);
  config = withAndroidBackgroundService(config, props);
  return config;
}

module.exports = withWaveformRecorder;
module.exports.default = withWaveformRecorder;
