export interface YajmanDetails {
  date: string;
  fullName: string;
  number: string;
  gotra: string;
  pitraName: string;
}

export interface YajmanVideoEntry {
  details: YajmanDetails;
  fileName: string;
}

export interface OverlayImage {
  png: Uint8Array;
  width: number;
  height: number;
}

interface ArtworkAssets {
  footer: HTMLImageElement;
  logo: HTMLImageElement;
  bounds: ReturnType<typeof visibleBounds>;
}

const artworkCache = new Map<string, Promise<ArtworkAssets>>();

function assetUrl(base: string, fileName: string): string {
  return `${base.replace(/\/+$/, '')}/${fileName}`;
}

function loadArtwork(assetBaseUrl: string): Promise<ArtworkAssets> {
  const footerUrl = assetUrl(assetBaseUrl, 'footer.PNG');
  const logoUrl = assetUrl(assetBaseUrl, 'logo.png');
  const key = `${footerUrl}|${logoUrl}`;
  const cached = artworkCache.get(key);
  if (cached) return cached;

  const pending = Promise.all([loadImage(footerUrl), loadImage(logoUrl)]).then(([footer, logo]) => {
    const scan = document.createElement('canvas');
    scan.width = footer.naturalWidth;
    scan.height = footer.naturalHeight;
    const context = scan.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is not available in this browser.');
    context.drawImage(footer, 0, 0);
    return { footer, logo, bounds: visibleBounds(context, scan.width, scan.height) };
  }).catch((error: unknown) => {
    artworkCache.delete(key);
    throw error;
  });
  artworkCache.set(key, pending);
  return pending;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load required asset: ${src}`));
    image.src = src;
  });
}

function visibleBounds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = ctx.getImageData(0, 0, width, height);
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right <= left || bottom <= top) throw new Error('Footer image has no visible content.');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function graphemes(value: string): string[] {
  return typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(({ segment }) => segment)
    : Array.from(value);
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  let truncated = false;

  for (const word of value.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const character of graphemes(word)) {
      const next = `${line}${character}`;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = character;
      } else {
        line = next;
      }
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  else if (line) truncated = true;
  if (lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  if (truncated && lines.length) {
    let last = lines[maxLines - 1].trimEnd();
    const parts = graphemes(last);
    while (parts.length && ctx.measureText(`${parts.join('')}…`).width > maxWidth) parts.pop();
    lines[maxLines - 1] = `${parts.join('').trimEnd()}…`;
  }
  return lines;
}

export async function renderYajmanOverlay(details: YajmanDetails, videoWidth: number, videoHeight: number, assetBaseUrl = ''): Promise<OverlayImage> {
  const { footer, logo, bounds } = await loadArtwork(assetBaseUrl);
  await Promise.all([
    document.fonts.load('700 48px "Noto Sans Devanagari"'),
    document.fonts.load('600 24px "Noto Sans"'),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  const footerInset = Math.round(Math.min(videoWidth, videoHeight) * 0.02);
  const footerX = footerInset;
  const footerWidth = videoWidth - footerInset * 2;
  const footerHeight = Math.round((footerWidth * bounds.height) / bounds.width);
  const footerY = videoHeight - footerHeight - footerInset;
  ctx.drawImage(footer, bounds.left, bounds.top, bounds.width, bounds.height, footerX, footerY, footerWidth, footerHeight);

  // Coordinates are relative to the original artwork. Custom ruled rows give long names
  // room to wrap while keeping the existing labels and the central devotional divider.
  const x = (fraction: number) => footerX + ((fraction - bounds.left) / bounds.width) * footerWidth;
  const y = (fraction: number) => footerY + ((fraction - bounds.top) / bounds.height) * footerHeight;
  const drawField = (value: string, lineStart: number, lineEnd: number, printedRuleY: number, lineYs: number[], ruleYs: number[]) => {
    if (!value.trim()) return;
    const left = x(lineStart);
    const right = x(lineEnd);
    const inset = (right - left) * 0.012;
    const textWidth = right - left - inset * 2;
    const linePositions = lineYs.map(y);
    const rulePositions = ruleYs.map(y);
    const fontSize = Math.max(8, Math.round(footerWidth * 0.022));
    const lines = (() => {
      ctx.font = `700 ${fontSize}px "Noto Sans Devanagari", "Noto Sans", sans-serif`;
      return wrapText(ctx, value, textWidth, linePositions.length);
    })();
    // Clear only the supplied underline. A full row fill can cover the blessing
    // beneath the ancestors field on portrait videos.
    ctx.fillStyle = '#fff5e4';
    ctx.fillRect(left, y(printedRuleY) - 1.5, right - left, 3);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#42140c';
    lines.forEach((line, index) => {
      ctx.fillText(line, left + inset, linePositions[index], textWidth);
      ctx.beginPath();
      ctx.strokeStyle = '#b51f1b';
      ctx.lineWidth = Math.max(1, footerWidth * 0.0018);
      ctx.moveTo(left, rulePositions[index]);
      ctx.lineTo(right, rulePositions[index]);
      ctx.stroke();
    });
  };
  drawField(details.fullName, 1320, 2735, 1320, [1300, 1355], [1330, 1385]);
  drawField(details.gotra, 1130, 2285, 1440, [1415, 1468], [1445, 1498]);
  drawField(details.pitraName, 1370, 2735, 1700, [1655, 1710], [1685, 1740]);

  const logoWidth = Math.round(videoWidth * 0.19);
  const logoHeight = Math.round((logo.naturalHeight / logo.naturalWidth) * logoWidth);
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = logoWidth;
  logoCanvas.height = logoHeight;
  const logoContext = logoCanvas.getContext('2d');
  if (!logoContext) throw new Error('Canvas is not available in this browser.');
  logoContext.drawImage(logo, 0, 0, logoWidth, logoHeight);
  ctx.drawImage(logoCanvas, Math.round(videoWidth * 0.035), Math.round(videoHeight * 0.035));

  // Date and number are retained visibly without changing the supplied footer artwork.
  const metadata = [details.date, details.number].filter(Boolean).join('  ·  ');
  if (metadata) {
    const fontSize = Math.max(14, Math.round(videoWidth * 0.018));
    ctx.font = `600 ${fontSize}px "Noto Sans", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = fontSize * 0.35;
    ctx.fillText(metadata, videoWidth * 0.97, videoHeight * 0.035, videoWidth * 0.65);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Could not create the footer image.'))), 'image/png');
  });
  return { png: new Uint8Array(await blob.arrayBuffer()), width: videoWidth, height: videoHeight };
}
