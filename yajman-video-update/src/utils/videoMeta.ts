export interface VideoMeta {
  width: number;
  height: number;
  duration: number;
}

export function readVideoMeta(file: Blob): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const meta = {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This video could not be read. Use an MP4 file.'));
    };
    video.src = url;
  });
}

export function readVideoMetaFromUrl(src: string): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const meta = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
      video.removeAttribute('src');
      video.load();
      resolve(meta);
    };
    video.onerror = () => reject(new Error('Could not read the video metadata.'));
    video.src = src;
  });
}
