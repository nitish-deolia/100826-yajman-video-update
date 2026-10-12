# Yajman Video Maker

The web app creates a personalised opening clip with the supplied footer and logo, then appends the bundled fixed ending video. Video work runs locally in the browser with ffmpeg.wasm. Excel and Apple Numbers files are parsed locally and batch results are packaged as a ZIP with a CSV report.

## Run the web app

```bash
npm install
npm run dev
```

The app bundles only the runtime assets in `public/`. The sample workbook and reference output are not copied into the deployed app.

## Build a React widget

```bash
npm run build:widget
```

This produces an ES module and stylesheet under `dist/`. Import `YajmanVideoWidget` from the module and the generated CSS from your React site. Host `footer.PNG`, `logo.png`, `remaining_fixed_video.mp4`, and `full_audio.mp3` together, then pass their folder URL:

```tsx
import { YajmanVideoWidget } from './dist/yajman-video-widget.js';
import './dist/yajman-video-widget.css';

<YajmanVideoWidget assetBaseUrl="/yajman-assets" />
```

The FFmpeg WebAssembly core is currently loaded from unpkg when a user starts rendering. Self-host that core before production deployment and configure its URL in `src/services/videoProcessor.ts`.

## Processing flow

- Single mode accepts Yajman details and one starter video. Full name is required; number and other details are optional. Footer timing can span the complete finished video.
- Starter and finished video previews open in a modal only when requested. Users can remove or replace the starter clip, and generated outputs are cleared after download starts or when the details change.
- Excel mode accepts `.xlsx` and Apple Numbers `.numbers` files with up to 500 data rows. Available columns map to Date, Full Name, Number, Gotra, and Pitra Name. Unmapped fields are blank. Each row is rendered in sequence; failed rows do not stop the remaining batch.
- Single mode validates the required name, MP4 type/size/duration, and footer time range before rendering. Number values are optional and accepted without format validation.
- The footer and transparent PNG logo are composited over the complete concatenated video. Original clip audio is removed and `full_audio.mp3` is looped or trimmed to exactly cover the finished video.
- Batch progress, retry, stop, ZIP download, and a CSV status report are available in the results panel.

## Install as a PWA

Build and host the web app over HTTPS. It includes a web manifest, home-screen icons, and a service worker that caches the app shell, bundles, fonts, and same-origin media. The FFmpeg WebAssembly core is fetched from unpkg when rendering starts, so video rendering needs an internet connection.

The mobile experience is an installable PWA for iOS and Android browsers. A separate React Native app is not included.

## GitHub Pages preview

Run `npm run build:pages` to create a project-site build under `dist/`. Publish the contents of `dist/` from the `gh-pages` branch root. The Pages build sets the repository subpath for app assets, media, manifest, and service worker.

