import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { Timeframe } from '../utils/timeframe';

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const BASE_FILE = 'starter_input';
const ENDING_FILE = 'fixed_ending';
const AUDIO_FILE = 'full_audio.mp3';
const OVERLAY_FILE = 'yajman_overlay.png';
const OUTPUT_FILE = 'output.mp4';

function buildOverlayArgs({ start, end }: Timeframe, width: number, height: number): string[] {
  const enable = `between(t,${start.toFixed(2)},${end.toFixed(2)})`;
  return [
    '-i', BASE_FILE,
    '-i', OVERLAY_FILE,
    '-i', ENDING_FILE,
    '-stream_loop', '-1', '-i', AUDIO_FILE,
    '-filter_complex',
    '[0:v]fps=30,format=yuv420p[intro];' +
      `[2:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[ending];` +
      `[intro][ending]concat=n=2:v=1:a=0[joined];[joined][1:v]overlay=0:0:enable='${enable}',format=yuv420p[out]`,
    '-map', '[out]',
    '-map', '3:a:0',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    '-y', OUTPUT_FILE,
  ];
}

export class VideoProcessor {
  private readonly ffmpeg = new FFmpeg();
  private loading: Promise<void> | null = null;
  private hasBaseVideo = false;
  private hasEndingVideo = false;
  private hasAudioTrack = false;
  private busy = false;
  private progressHandler?: (ratio: number) => void;

  constructor() {
    this.ffmpeg.on('progress', ({ progress }) => {
      this.progressHandler?.(Math.min(Math.max(progress, 0), 1));
    });
  }

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = this.loadCore().catch((error) => {
        this.loading = null;
        throw error;
      });
    }
    return this.loading;
  }

  async setBaseVideo(video: Blob): Promise<void> {
    await this.load();
    if (this.hasBaseVideo) await this.safeDelete(BASE_FILE);
    await this.ffmpeg.writeFile(BASE_FILE, await fetchFile(video));
    this.hasBaseVideo = true;
  }

  async clearBaseVideo(): Promise<void> {
    if (!this.hasBaseVideo) return;
    await this.safeDelete(BASE_FILE);
    this.hasBaseVideo = false;
  }

  async setEndingVideo(video: Blob): Promise<void> {
    await this.load();
    if (this.hasEndingVideo) await this.safeDelete(ENDING_FILE);
    await this.ffmpeg.writeFile(ENDING_FILE, await fetchFile(video));
    this.hasEndingVideo = true;
  }

  async setAudioTrack(audio: Blob): Promise<void> {
    await this.load();
    if (this.hasAudioTrack) await this.safeDelete(AUDIO_FILE);
    await this.ffmpeg.writeFile(AUDIO_FILE, await fetchFile(audio));
    this.hasAudioTrack = true;
  }

  async render(
    overlayPng: Uint8Array,
    timeframe: Timeframe,
    width: number,
    height: number,
    onProgress?: (ratio: number) => void,
  ): Promise<Uint8Array> {
    if (!this.hasBaseVideo || !this.hasEndingVideo || !this.hasAudioTrack) {
      throw new Error('The starter video, fixed ending, and soundtrack must be loaded.');
    }
    if (this.busy) throw new Error('A render is already in progress.');

    this.busy = true;
    this.progressHandler = onProgress;
    try {
      await this.ffmpeg.writeFile(OVERLAY_FILE, overlayPng);
      const exitCode = await this.ffmpeg.exec(buildOverlayArgs(timeframe, width, height));
      if (exitCode !== 0) throw new Error(`FFmpeg failed with exit code ${exitCode}.`);

      const data = await this.ffmpeg.readFile(OUTPUT_FILE);
      if (typeof data === 'string') throw new Error('Unexpected FFmpeg output.');
      return new Uint8Array(data);
    } finally {
      this.progressHandler = undefined;
      await this.safeDelete(OVERLAY_FILE);
      await this.safeDelete(OUTPUT_FILE);
      this.busy = false;
    }
  }

  terminate(): void {
    this.ffmpeg.terminate();
    this.loading = null;
    this.hasBaseVideo = false;
    this.hasEndingVideo = false;
    this.hasAudioTrack = false;
  }

  private async loadCore(): Promise<void> {
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  private async safeDelete(path: string): Promise<void> {
    try {
      await this.ffmpeg.deleteFile(path);
    } catch {
      // File may not exist; nothing to clean up.
    }
  }
}
