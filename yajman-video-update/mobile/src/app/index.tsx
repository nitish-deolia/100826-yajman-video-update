import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { DOWNLOAD_BRIDGE_SCRIPT, decodeBase64, safeDownloadName, type NativeDownloadMessage } from '../features/downloadBridge';

const APP_URL = Constants.expoConfig?.extra?.appUrl ?? 'https://nitish-deolia.github.io/100826-yajman-video-update/';
const APP_ORIGIN = new URL(APP_URL).origin;

type ActiveDownload = { file: File; handle: FileHandle; mimeType: string; total: number; received: number };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const downloadsRef = useRef(new Map<string, ActiveDownload>());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadBusy, setDownloadBusy] = useState(false);

  const handleBack = useCallback(() => {
    if (!canGoBack) return false;
    webViewRef.current?.goBack();
    return true;
  }, [canGoBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => () => {
    for (const download of downloadsRef.current.values()) {
      try { download.handle.close(); } catch { /* The file handle may already be closed. */ }
    }
    downloadsRef.current.clear();
  }, []);

  async function handleDownloadMessage(rawMessage: string) {
    let message: NativeDownloadMessage;
    try {
      message = JSON.parse(rawMessage) as NativeDownloadMessage;
    } catch {
      return;
    }

    if (message.type === 'download-start') {
      const directory = new Directory(Paths.cache, 'yajman-exports');
      directory.create({ idempotent: true, intermediates: true });
      const file = new File(directory, safeDownloadName(message.name));
      file.create({ overwrite: true });
      const handle = file.open(FileMode.Truncate);
      downloadsRef.current.set(message.id, { file, handle, mimeType: message.mimeType, total: message.total, received: 0 });
      setDownloadBusy(true);
      setDownloadStatus('Preparing your download…');
      return;
    }

    const download = downloadsRef.current.get(message.id);
    if (!download) return;

    if (message.type === 'download-chunk') {
      download.handle.writeBytes(decodeBase64(message.data));
      download.received = message.index + 1;
      if (download.received === download.total || download.received % 12 === 0) {
        const percent = download.total ? Math.floor((download.received / download.total) * 100) : 100;
        setDownloadStatus(`Preparing your download… ${percent}%`);
      }
      return;
    }

    downloadsRef.current.delete(message.id);
    download.handle.close();
    if (message.type === 'download-error') {
      download.file.delete();
      setDownloadStatus(`Could not prepare the file: ${message.message}`);
      setDownloadBusy(false);
      return;
    }

    try {
      setDownloadStatus('Choose where to save or share the file.');
      await Sharing.shareAsync(download.file.uri, {
        mimeType: download.mimeType,
        dialogTitle: 'Save or share your Yajman video',
      });
      setDownloadStatus('Download ready. Your temporary copy will be cleared.');
    } catch {
      setDownloadStatus('Could not open the share sheet. Please try the download again.');
    } finally {
      download.file.delete();
      setDownloadBusy(false);
    }
  }

  function handleNavigation(url: string): boolean {
    if (url.startsWith('blob:') || url.startsWith('data:')) return false;
    try {
      const target = new URL(url);
      if (target.origin === APP_ORIGIN) return true;
      if (target.protocol === 'https:' || target.protocol === 'mailto:') {
        void Linking.openURL(url);
      }
    } catch {
      return false;
    }
    return false;
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image accessibilityLabel="Yajman" resizeMode="contain" source={require('../../assets/yajman-logo.png')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandTitle}>Yajman Video Maker</Text>
            <Text style={styles.brandSubtitle}>On-device video creation</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Reload Yajman Video Maker"
          accessibilityRole="button"
          disabled={loading || downloadBusy}
          onPress={() => { setLoadError(false); webViewRef.current?.reload(); }}
          style={({ pressed }) => [styles.reloadButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.reloadText}>Reload</Text>
        </Pressable>
      </View>

      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: APP_URL }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          injectedJavaScript={DOWNLOAD_BRIDGE_SCRIPT}
          onMessage={(event: WebViewMessageEvent) => { void handleDownloadMessage(event.nativeEvent.data); }}
          onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
          onShouldStartLoadWithRequest={(request) => handleNavigation(request.url)}
          onLoadStart={() => { setLoading(true); setLoadError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setLoadError(true); }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) setLoadError(true);
          }}
          startInLoadingState
          setSupportMultipleWindows={false}
          style={styles.webView}
          contentInsetAdjustmentBehavior="automatic"
        />

        {loadError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Can’t connect to Yajman</Text>
            <Text style={styles.errorBody}>Connect to the internet, then reload. Your selected videos and yajman details stay on this device.</Text>
            <Pressable style={styles.primaryButton} onPress={() => { setLoadError(false); webViewRef.current?.reload(); }}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {loading && !loadError && (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingMark}>Y</Text>
            <Text style={styles.loadingText}>Opening video maker…</Text>
          </View>
        )}
      </View>

      {!!downloadStatus && (
        <View accessibilityLiveRegion="polite" style={styles.downloadStatus}>
          <Text style={styles.downloadStatusText}>{downloadStatus}</Text>
          <Pressable accessibilityLabel="Dismiss download message" disabled={downloadBusy} onPress={() => setDownloadStatus('')}>
            <Text style={[styles.dismiss, downloadBusy && styles.dismissDisabled]}>×</Text>
          </Pressable>
        </View>
      )}
      <View style={{ height: Math.max(insets.bottom, 8) }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7f2' },
  header: { minHeight: 68, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: '#e2e9e2', borderBottomWidth: StyleSheet.hairlineWidth },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  brandLogo: { width: 72, height: 36 },
  brandTitle: { color: '#193c30', fontSize: 15, fontWeight: '800' },
  brandSubtitle: { color: '#6f7d73', fontSize: 11, marginTop: 1 },
  reloadButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10, backgroundColor: '#e9f1e9' },
  reloadText: { color: '#225a47', fontSize: 12, fontWeight: '700' },
  buttonPressed: { opacity: 0.7 },
  webContainer: { flex: 1, position: 'relative', backgroundColor: '#f5f7f2' },
  webView: { flex: 1, backgroundColor: '#f5f7f2' },
  loadingCard: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7f2' },
  loadingMark: { color: '#21624d', fontSize: 38, fontWeight: '900' },
  loadingText: { marginTop: 12, color: '#57695d', fontSize: 14 },
  errorCard: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f5f7f2' },
  errorTitle: { color: '#1c3f32', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorBody: { maxWidth: 310, marginTop: 10, color: '#5c6d61', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primaryButton: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, backgroundColor: '#21624d' },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  downloadStatus: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#e9f1e9', borderTopColor: '#d9e4da', borderTopWidth: StyleSheet.hairlineWidth },
  downloadStatusText: { flex: 1, color: '#315a47', fontSize: 12, lineHeight: 17 },
  dismiss: { color: '#315a47', fontSize: 22, paddingHorizontal: 4 },
  dismissDisabled: { opacity: 0.45 },
});
