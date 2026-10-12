export const DOWNLOAD_BRIDGE_SCRIPT = `
(function () {
  if (window.__yajmanDownloadBridgeInstalled) return true;
  window.__yajmanDownloadBridgeInstalled = true;

  var chunkSize = 131072;
  var send = function (payload) {
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  };

  document.addEventListener('click', async function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[download]') : null;
    if (!link || !link.href || !link.href.startsWith('blob:')) return;
    event.preventDefault();

    var id = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    try {
      var response = await fetch(link.href);
      var blob = await response.blob();
      var total = Math.ceil(blob.size / chunkSize);
      send({ type: 'download-start', id: id, name: link.download || 'yajman-video.mp4', mimeType: blob.type || 'application/octet-stream', total: total });

      for (var index = 0; index < total; index += 1) {
        var bytes = new Uint8Array(await blob.slice(index * chunkSize, (index + 1) * chunkSize).arrayBuffer());
        var binary = '';
        for (var offset = 0; offset < bytes.length; offset += 32768) {
          binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + 32768, bytes.length)));
        }
        send({ type: 'download-chunk', id: id, index: index, data: btoa(binary) });
      }
      send({ type: 'download-finish', id: id });
    } catch (error) {
      send({ type: 'download-error', id: id, message: String(error && error.message || error) });
    }
  }, true);
})();
true;
`;

export type NativeDownloadMessage =
  | { type: 'download-start'; id: string; name: string; mimeType: string; total: number }
  | { type: 'download-chunk'; id: string; index: number; data: string }
  | { type: 'download-finish'; id: string }
  | { type: 'download-error'; id: string; message: string };

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Uint8Array(128);
for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
  BASE64_LOOKUP[BASE64_ALPHABET.charCodeAt(index)] = index;
}

export function decodeBase64(value: string): Uint8Array {
  const output = new Uint8Array(Math.floor((value.length * 3) / 4));
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64_LOOKUP[value.charCodeAt(index)] ?? 0;
    const b = BASE64_LOOKUP[value.charCodeAt(index + 1)] ?? 0;
    const c = value[index + 2] === '=' ? 0 : BASE64_LOOKUP[value.charCodeAt(index + 2)] ?? 0;
    const d = value[index + 3] === '=' ? 0 : BASE64_LOOKUP[value.charCodeAt(index + 3)] ?? 0;
    output[outputIndex++] = (a << 2) | (b >> 4);
    if (value[index + 2] !== '=') output[outputIndex++] = ((b & 15) << 4) | (c >> 2);
    if (value[index + 3] !== '=') output[outputIndex++] = ((c & 3) << 6) | d;
  }
  return output.subarray(0, outputIndex);
}

export function safeDownloadName(name: string): string {
  const cleanName = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 140);
  return cleanName || 'yajman-video.mp4';
}
