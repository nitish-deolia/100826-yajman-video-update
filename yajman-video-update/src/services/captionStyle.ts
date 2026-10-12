export type LookKey = 'classic' | 'strong' | 'typewriter' | 'serif' | 'script' | 'neon';
export type BackgroundMode = 'none' | 'highlight' | 'bar';
export type TextAlign = 'left' | 'center' | 'right';

export interface Look {
  label: string;
  family: string;
  weight: number;
  italic: boolean;
  uppercase: boolean;
  glow: boolean;
  sizeScale: number;
}

const DEVANAGARI = '"Noto Sans Devanagari"';

export const LOOKS: Record<LookKey, Look> = {
  classic: {
    label: 'Classic',
    family: `"Noto Sans", ${DEVANAGARI}, sans-serif`,
    weight: 700,
    italic: false,
    uppercase: false,
    glow: false,
    sizeScale: 1,
  },
  strong: {
    label: 'Strong',
    family: `"Poppins", ${DEVANAGARI}, sans-serif`,
    weight: 700,
    italic: false,
    uppercase: true,
    glow: false,
    sizeScale: 1,
  },
  typewriter: {
    label: 'Typewriter',
    family: `"Courier Prime", ${DEVANAGARI}, monospace`,
    weight: 700,
    italic: false,
    uppercase: false,
    glow: false,
    sizeScale: 1,
  },
  serif: {
    label: 'Serif',
    family: `"Noto Serif", ${DEVANAGARI}, serif`,
    weight: 700,
    italic: true,
    uppercase: false,
    glow: false,
    sizeScale: 1,
  },
  script: {
    label: 'Script',
    family: `"Caveat", ${DEVANAGARI}, cursive`,
    weight: 700,
    italic: false,
    uppercase: false,
    glow: false,
    sizeScale: 1.3,
  },
  neon: {
    label: 'Neon',
    family: `"Poppins", ${DEVANAGARI}, sans-serif`,
    weight: 700,
    italic: false,
    uppercase: false,
    glow: true,
    sizeScale: 1,
  },
};

export const LOOK_KEYS = Object.keys(LOOKS) as LookKey[];

export const SWATCHES = [
  '#ffffff',
  '#000000',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#0a84ff',
  '#bf5af2',
  '#ff2d92',
] as const;

export interface CaptionStyle {
  look: LookKey;
  sizePercent: number;
  align: TextAlign;
  textColor: string;
  background: BackgroundMode;
  backgroundColor: string;
  backgroundOpacity: number;
  maxLines: number;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  look: 'classic',
  sizePercent: 5,
  align: 'center',
  textColor: '#ffffff',
  background: 'highlight',
  backgroundColor: '#000000',
  backgroundOpacity: 0.6,
  maxLines: 4,
};
