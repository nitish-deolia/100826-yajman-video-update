import {
  LOOKS,
  LOOK_KEYS,
  type BackgroundMode,
  type CaptionStyle,
  type TextAlign,
} from '../services/captionStyle';
import { ColorSwatches } from './ColorSwatches';

interface Props {
  style: CaptionStyle;
  disabled?: boolean;
  onChange: (style: CaptionStyle) => void;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const BACKGROUNDS: { value: BackgroundMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'bar', label: 'Bar' },
];

const ALIGNMENTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

export function StylePanel({ style, disabled, onChange }: Props) {
  const update = <K extends keyof CaptionStyle>(key: K, value: CaptionStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <fieldset className="panel" disabled={disabled}>
      <legend>Caption look</legend>

      <div className="looks" role="group" aria-label="Text style">
        {LOOK_KEYS.map((key) => {
          const look = LOOKS[key];
          return (
            <button
              key={key}
              type="button"
              className="look"
              aria-pressed={style.look === key}
              onClick={() => update('look', key)}
            >
              <span
                className="look-sample"
                style={{
                  fontFamily: look.family,
                  fontWeight: look.weight,
                  fontStyle: look.italic ? 'italic' : 'normal',
                }}
              >
                Aa
              </span>
              <span>{look.label}</span>
            </button>
          );
        })}
      </div>

      <Segmented label="Background" value={style.background} options={BACKGROUNDS} onChange={(v) => update('background', v)} />
      <Segmented label="Alignment" value={style.align} options={ALIGNMENTS} onChange={(v) => update('align', v)} />

      <div className="row">
        <label className="row-label" htmlFor="size">Text size</label>
        <input
          id="size"
          type="range"
          min={2}
          max={9}
          step={0.5}
          value={style.sizePercent}
          onChange={(e) => update('sizePercent', Number(e.target.value))}
        />
        <output htmlFor="size">{style.sizePercent}%</output>
      </div>

      <ColorSwatches
        label={style.look === 'neon' ? 'Glow colour' : 'Text colour'}
        value={style.textColor}
        onChange={(color) => update('textColor', color)}
      />

      {style.background !== 'none' && (
        <>
          <ColorSwatches
            label="Background colour"
            value={style.backgroundColor}
            onChange={(color) => update('backgroundColor', color)}
          />
          <div className="row">
            <label className="row-label" htmlFor="bg-opacity">Background opacity</label>
            <input
              id="bg-opacity"
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(style.backgroundOpacity * 100)}
              onChange={(e) => update('backgroundOpacity', Number(e.target.value) / 100)}
            />
            <output htmlFor="bg-opacity">{Math.round(style.backgroundOpacity * 100)}%</output>
          </div>
        </>
      )}
    </fieldset>
  );
}
