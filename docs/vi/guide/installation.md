---
description: "Cài đặt react-native-waveform-recorder, thêm quyền micro trên iOS và Android, thiết lập ghi âm khi chạy nền và cấu hình config plugin của Expo."
---

# Cài đặt {#installation}

## Yêu cầu {#requirements}

- React Native bật **New Architecture** (Fabric). Thư viện được build với React Native 0.85 và không có bản cho Old Architecture.
- iOS: phiên bản iOS tối thiểu của bản React Native bạn dùng (podspec dùng `min_ios_version_supported`).
- Android: từ API 24. Định dạng `opus` cần API 29.

## Cài gói {#install-the-package}

::: code-group

```sh [npm]
npm install react-native-waveform-recorder
```

```sh [yarn]
yarn add react-native-waveform-recorder
```

:::

Sau đó cài pod cho iOS:

```sh
npx pod-install
```

Dùng Expo? Chuyển xuống phần [Expo](#expo).

## Quyền trên iOS {#ios-permission}

Thêm mô tả quyền dùng micro vào `Info.plist`. iOS hiển thị câu này trong hộp thoại xin quyền, và app ghi âm mà thiếu nó sẽ bị từ chối.

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Ghi tin nhắn thoại.</string>
```

Hộp thoại hệ thống xuất hiện ở lần `start()` đầu tiên. Nếu người dùng từ chối, `onPermissionDenied` được gọi và không có gì được ghi. Sau khi đã bị từ chối, iOS không hỏi lại nữa; hãy đưa người dùng sang app Cài đặt, ví dụ bằng `Linking.openSettings()`.

## Quyền trên Android {#android-permission}

Manifest của thư viện đã khai báo sẵn `RECORD_AUDIO`, bạn không cần thêm. Mỗi lần `start()`, lớp JavaScript sẽ kiểm tra quyền lúc chạy và xin quyền nếu cần. Nếu bị từ chối, `onPermissionDenied` được gọi và bộ ghi native không được khởi động.

Muốn xin quyền sớm hơn, chẳng hạn ở màn hình onboarding, hãy gọi `ensureMicrophonePermission()`:

```ts
import { ensureMicrophonePermission } from 'react-native-waveform-recorder';

const granted = await ensureMicrophonePermission();
```

Trên Android, hàm trả về `true` khi `RECORD_AUDIO` được cấp. Trên iOS, hàm trả về `true` ngay và hộp thoại hệ thống vẫn hiện ở lần `start()` đầu tiên.

## Ghi âm khi chạy nền {#background-recording}

Để tiếp tục ghi khi app chuyển xuống nền, hãy bật prop `backgroundRecording` và làm phần thiết lập native dưới đây.

**iOS:** thêm background mode `audio`.

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

Nếu `backgroundRecording` là `true` mà thiếu mục này, `onError` được gọi một lần với code `'background-capability'`.

**Android:** khai báo foreground service trong `android/app/src/main/AndroidManifest.xml`, bên trong `<application>`:

```xml
<service
    android:name="com.waveformrecorder.WaveformRecorderBackgroundService"
    android:foregroundServiceType="microphone"
    android:exported="false" />
```

Hai quyền `FOREGROUND_SERVICE` và `FOREGROUND_SERVICE_MICROPHONE` đã được gộp sẵn từ manifest của thư viện. Trong lúc ghi, service hiển thị một thông báo mà bạn đặt nội dung bằng `backgroundNotificationTitle` và `backgroundNotificationBody`. Nếu chưa khai báo service, thư viện chỉ ghi một cảnh báo vào logcat, vì vậy hãy kiểm tra xem thông báo có xuất hiện không.

Xem thêm ở [Lưu ý theo nền tảng](/vi/guide/platform-notes#background-recording).

## Expo {#expo}

Thư viện chạy được trong [development build](https://docs.expo.dev/develop/development-builds/introduction/) của Expo (EAS Build hoặc `npx expo prebuild`). Thư viện không chạy trong Expo Go, vì Expo Go không nạp được code native của bên thứ ba.

1. Cài gói:

   ```sh
   npx expo install react-native-waveform-recorder
   ```

2. Thêm config plugin vào `app.json` hoặc `app.config.js`:

   ```json
   {
     "expo": {
       "plugins": [
         [
           "react-native-waveform-recorder",
           {
             "microphonePermission": "Cho phép $(PRODUCT_NAME) ghi tin nhắn thoại.",
             "backgroundRecording": false
           }
         ]
       ]
     }
   }
   ```

   Cả hai tùy chọn đều không bắt buộc, nên viết `"plugins": ["react-native-waveform-recorder"]` cũng được.

3. Tạo lại project native và build lại development client:

   ```sh
   npx expo prebuild --clean
   ```

### Tùy chọn của config plugin {#config-plugin-options}

| Tùy chọn | Kiểu | Mặc định | Tác dụng |
| --- | --- | --- | --- |
| `microphonePermission` | `string \| false` | Giữ `NSMicrophoneUsageDescription` đang có, nếu chưa có thì dùng `'Allow $(PRODUCT_NAME) to access your microphone to record voice messages.'` | Đặt `NSMicrophoneUsageDescription` cho iOS. Truyền `false` để không đụng đến `Info.plist`. |
| `backgroundRecording` | `boolean` | `false` | Khi là `true`, thêm background mode `audio` cho iOS, foreground service cho Android và các quyền `RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`. Bạn vẫn phải đặt prop `backgroundRecording` trên view. |

Hãy chọn Expo SDK đi kèm bản React Native có bật New Architecture; các SDK gần đây đều bật mặc định.
