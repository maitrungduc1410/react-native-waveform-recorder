---
description: "安装 react-native-waveform-recorder，配置 iOS 和 Android 麦克风权限、后台录音以及 Expo 配置插件。"
---

# 安装 {#installation}

## 环境要求 {#requirements}

- 启用了**新架构**（Fabric）的 React Native。本库基于 React Native 0.85 构建，没有旧架构实现。
- iOS：最低版本与你使用的 React Native 版本一致（podspec 使用 `min_ios_version_supported`）。
- Android：API 24 及以上。`opus` 格式需要 API 29。

## 安装依赖包 {#install-the-package}

::: code-group

```sh [npm]
npm install react-native-waveform-recorder
```

```sh [yarn]
yarn add react-native-waveform-recorder
```

:::

然后安装 iOS 的 pod：

```sh
npx pod-install
```

使用 Expo？直接跳到 [Expo](#expo)。

## iOS 权限 {#ios-permission}

在 `Info.plist` 中添加麦克风使用说明。iOS 会在权限弹窗中显示这段文字，缺少它的录音应用会被拒绝。

```xml
<key>NSMicrophoneUsageDescription</key>
<string>用于录制语音消息。</string>
```

系统弹窗会在第一次调用 `start()` 时出现。如果用户拒绝，会触发 `onPermissionDenied`，不会录制任何内容。用户拒绝过一次后 iOS 不会再弹窗，需要引导用户去“设置”中开启，例如调用 `Linking.openSettings()`。

## Android 权限 {#android-permission}

本库的 manifest 已经声明了 `RECORD_AUDIO`，你不需要再添加。每次调用 `start()` 时，JavaScript 层都会检查运行时权限，必要时发起申请。如果被拒绝，会触发 `onPermissionDenied`，原生录音器不会启动。

如果想提前申请，例如在引导页中，可以调用 `ensureMicrophonePermission()`：

```ts
import { ensureMicrophonePermission } from 'react-native-waveform-recorder';

const granted = await ensureMicrophonePermission();
```

在 Android 上，获得 `RECORD_AUDIO` 权限时返回 `true`。在 iOS 上它会立即返回 `true`，系统弹窗仍然在第一次 `start()` 时出现。

## 后台录音 {#background-recording}

如果希望应用切到后台后继续录音，请设置 `backgroundRecording` 属性，并完成下面的原生配置。

**iOS：** 添加 `audio` 后台模式。

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

如果 `backgroundRecording` 为 `true` 但缺少这一项，`onError` 会触发一次，code 为 `'background-capability'`。

**Android：** 在 `android/app/src/main/AndroidManifest.xml` 的 `<application>` 中声明前台服务：

```xml
<service
    android:name="com.waveformrecorder.WaveformRecorderBackgroundService"
    android:foregroundServiceType="microphone"
    android:exported="false" />
```

`FOREGROUND_SERVICE` 和 `FOREGROUND_SERVICE_MICROPHONE` 权限已经从本库的 manifest 合并进来。录音期间，服务会显示一条通知，文字可以通过 `backgroundNotificationTitle` 和 `backgroundNotificationBody` 设置。如果没有声明服务，本库只会在 logcat 中输出一条警告，所以请确认通知确实出现了。

详情参阅[平台说明](/zh/guide/platform-notes#background-recording)。

## Expo {#expo}

本库可以在 Expo [开发构建](https://docs.expo.dev/develop/development-builds/introduction/)（EAS Build 或 `npx expo prebuild`）中使用。它不能在 Expo Go 中运行，因为 Expo Go 无法加载第三方原生代码。

1. 安装依赖包：

   ```sh
   npx expo install react-native-waveform-recorder
   ```

2. 在 `app.json` 或 `app.config.js` 中添加配置插件：

   ```json
   {
     "expo": {
       "plugins": [
         [
           "react-native-waveform-recorder",
           {
             "microphonePermission": "允许 $(PRODUCT_NAME) 录制语音消息。",
             "backgroundRecording": false
           }
         ]
       ]
     }
   }
   ```

   两个选项都是可选的，所以直接写 `"plugins": ["react-native-waveform-recorder"]` 也可以。

3. 重新生成原生工程并重新构建开发客户端：

   ```sh
   npx expo prebuild --clean
   ```

### 配置插件选项 {#config-plugin-options}

| 选项 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `microphonePermission` | `string \| false` | 保留已有的 `NSMicrophoneUsageDescription`，没有时使用 `'Allow $(PRODUCT_NAME) to access your microphone to record voice messages.'` | 设置 iOS 的 `NSMicrophoneUsageDescription`。传 `false` 则不修改 `Info.plist`。 |
| `backgroundRecording` | `boolean` | `false` | 为 `true` 时，添加 iOS 的 `audio` 后台模式、Android 前台服务，以及 `RECORD_AUDIO`、`FOREGROUND_SERVICE`、`FOREGROUND_SERVICE_MICROPHONE` 权限。视图上仍然需要设置 `backgroundRecording` 属性。 |

请选择自带启用新架构的 React Native 版本的 Expo SDK，较新的 SDK 默认都已启用。
