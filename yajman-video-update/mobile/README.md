# Yajman Video Maker for Android

This Expo app is a small native Android shell for the existing Yajman web app. It loads the hosted app in a WebView so the current single-video and Excel workflows, including on-device video processing, stay available without maintaining a second UI implementation. The iPhone option remains the current PWA: open the web app in Safari, tap **Share**, then **Add to Home Screen**.

The Android app needs an internet connection to load the hosted application and its bundled assets. User spreadsheets, selected clips, and video processing stay in the WebView on the device. When a video or ZIP is ready, the native download bridge writes a temporary cache copy and opens Android's share sheet; the temporary copy is removed when sharing closes.

## Build a shareable Android APK

1. Install Node.js and sign in to an Expo account with `npx eas-cli@latest login`.
2. From this directory, initialize the EAS project once with `npx eas-cli@latest init` and accept the project link.
3. Build an installable APK with `npm run build:android:preview`.
4. Share the APK or the private EAS build link directly with testers. This profile creates an internal APK and does not submit the app to Google Play.

Each recipient may need to allow installation from the browser or file-sharing app used to receive the APK. New app versions require creating and sharing a new APK.

## Local development

Run `npm install`, then `npx expo start`. Use Expo Go only for UI iteration; a standalone APK is needed to validate native file sharing on Android.
