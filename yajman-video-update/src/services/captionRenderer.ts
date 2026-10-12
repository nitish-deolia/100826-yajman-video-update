import { LOOKS, type CaptionStyle } from './captionStyle';

export interface CaptionImage {
  png: Uint8Array;
  width: number;
  height: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fitWithEllipsis(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string {
  let text = line;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text.trimEnd()}…`;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitWithEllipsis(ctx, kept[maxLines - 1], maxWidth);
  return kept;
}

export async function renderCaption(
  text: string,
  videoWidth: number,
  style: CaptionStyle,
): Promise<CaptionImage> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Caption text is empty.');

  const look = LOOKS[style.look];
  const content = look.uppercase ? trimmed.toUpperCase() : trimmed;
  const fontSize = Math.max(8, Math.round((videoWidth * style.sizePercent * look.sizeScale) / 100));
  const font = `${look.italic ? 'italic ' : ''}${look.weight} ${fontSize}px ${look.family}`;
  await document.fonts.load(font, content);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.font = font;

  const isBar = style.background === 'bar';
  const isHighlight = style.background === 'highlight';
  const lineHeight = Math.round(fontSize * 1.3);
  const padX = isBar ? Math.round(fontSize * 0.8) : isHighlight ? Math.round(fontSize * 0.45) : 0;
  const padY = isBar ? Math.round(fontSize * 0.4) : 0;
  // Room for shadow or glow so they are not clipped by the image edge.
  const bleed = isBar || isHighlight ? 0 : Math.round(fontSize * 0.6);

  const maxTextWidth = (isBar ? videoWidth : Math.round(videoWidth * 0.86)) - 2 * (padX + bleed);
  const lines = wrapLines(ctx, content, maxTextWidth, style.maxLines);
  const lineWidths = lines.map((line) => ctx.measureText(line).width);
  const blockWidth = Math.ceil(Math.max(...lineWidths));

  const width = isBar ? videoWidth : blockWidth + 2 * (padX + bleed);
  const height = lines.length * lineHeight + 2 * (bleed + padY);

  // Resizing a canvas resets its context, so drawing state is set afterwards.
  canvas.width = width;
  canvas.height = height;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = style.align;

  const textX =
    style.align === 'left' ? bleed + padX : style.align === 'right' ? width - bleed - padX : width / 2;
  const textY = (i: number) => bleed + padY + i * lineHeight + lineHeight / 2;

  const fill = hexToRgba(style.backgroundColor, style.backgroundOpacity);
  if (isBar) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
  } else if (isHighlight) {
    ctx.fillStyle = fill;
    lines.forEach((_, i) => {
      const boxWidth = lineWidths[i] + 2 * padX;
      const boxX =
        style.align === 'left' ? bleed : style.align === 'right' ? width - bleed - boxWidth : (width - boxWidth) / 2;
      ctx.beginPath();
      ctx.roundRect(boxX, bleed + i * lineHeight, boxWidth, lineHeight, lineHeight * 0.32);
      ctx.fill();
    });
  }

  if (look.glow) {
    ctx.shadowColor = style.textColor;
    ctx.shadowBlur = fontSize * 0.5;
    ctx.fillStyle = '#ffffff';
    for (let pass = 0; pass < 2; pass++) {
      lines.forEach((line, i) => ctx.fillText(line, textX, textY(i)));
    }
  } else {
    if (!isBar && !isHighlight) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = fontSize * 0.2;
      ctx.shadowOffsetY = fontSize * 0.04;
    }
    ctx.fillStyle = style.textColor;
    lines.forEach((line, i) => ctx.fillText(line, textX, textY(i)));
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not create the caption image.'))),
      'image/png',
    );
  });
  return { png: new Uint8Array(await blob.arrayBuffer()), width, height };
}
