import { C64Color, PaletteCycleConfig } from '../types';

// The canonical Commodore 64 16-color palette (Pepto / Colodore calibrated)
export const C64_PALETTE_BASE: C64Color[] = [
  { index: 0, name: 'Black', hex: '#000000', rgb: [0, 0, 0], vgaDac: [0, 0, 0] },
  { index: 1, name: 'White', hex: '#FFFFFF', rgb: [255, 255, 255], vgaDac: [63, 63, 63] },
  { index: 2, name: 'Red', hex: '#880000', rgb: [136, 0, 0], vgaDac: [34, 0, 0] },
  { index: 3, name: 'Cyan', hex: '#AAFFEE', rgb: [170, 255, 238], vgaDac: [42, 63, 59] },
  { index: 4, name: 'Purple', hex: '#CC44CC', rgb: [204, 68, 204], vgaDac: [51, 17, 51] },
  { index: 5, name: 'Green', hex: '#00CC55', rgb: [0, 204, 85], vgaDac: [0, 51, 21] },
  { index: 6, name: 'Blue', hex: '#0000AA', rgb: [0, 0, 170], vgaDac: [0, 0, 42] },
  { index: 7, name: 'Yellow', hex: '#EEEE77', rgb: [238, 238, 119], vgaDac: [59, 59, 29] },
  { index: 8, name: 'Orange', hex: '#DD8855', rgb: [221, 136, 85], vgaDac: [55, 34, 21] },
  { index: 9, name: 'Brown', hex: '#664400', rgb: [102, 68, 0], vgaDac: [25, 17, 0] },
  { index: 10, name: 'Light Red', hex: '#FF7777', rgb: [255, 119, 119], vgaDac: [63, 29, 29] },
  { index: 11, name: 'Dark Grey', hex: '#333333', rgb: [51, 51, 51], vgaDac: [12, 12, 12] },
  { index: 12, name: 'Grey', hex: '#777777', rgb: [119, 119, 119], vgaDac: [29, 29, 29] },
  { index: 13, name: 'Light Green', hex: '#AAFF66', rgb: [170, 255, 102], vgaDac: [42, 63, 25] },
  { index: 14, name: 'Light Blue', hex: '#0088FF', rgb: [0, 136, 255], vgaDac: [0, 34, 63] },
  { index: 15, name: 'Light Grey', hex: '#BBBBBB', rgb: [187, 187, 187], vgaDac: [46, 46, 46] }
];

export function rgbToVgaDac(r: number, g: number, b: number): [number, number, number] {
  return [
    Math.min(63, Math.max(0, Math.floor(r / 4))),
    Math.min(63, Math.max(0, Math.floor(g / 4))),
    Math.min(63, Math.max(0, Math.floor(b / 4)))
  ];
}

export function vgaDacToRgb(r6: number, g6: number, b6: number): [number, number, number] {
  return [
    Math.min(255, Math.round(r6 * 4.0476)),
    Math.min(255, Math.round(g6 * 4.0476)),
    Math.min(255, Math.round(b6 * 4.0476))
  ];
}

export function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Generate the full 256 VGA DAC palette:
// 0..15: C64 base colors
// 16..31: Dedicated palette cycle registers
// 32..255: Smooth shading ramps / copper bars / retro gradient extensions
export function generateFullVgaPalette(cycleConfig?: PaletteCycleConfig, frameCount = 0): Uint8Array {
  // 256 entries * 3 bytes (R, G, B in 0-63 scale)
  const dac = new Uint8Array(256 * 3);

  // 1. Populate base 16 C64 colors
  for (let i = 0; i < 16; i++) {
    const c = C64_PALETTE_BASE[i];
    dac[i * 3 + 0] = c.vgaDac[0];
    dac[i * 3 + 1] = c.vgaDac[1];
    dac[i * 3 + 2] = c.vgaDac[2];
  }

  // 2. Default gradient fills for indices 16..255
  for (let i = 16; i < 256; i++) {
    const t = (i - 16) / 240;
    // Retro cyber demoscene copper spectrum
    const r = Math.sin(t * Math.PI * 4) * 0.5 + 0.5;
    const g = Math.sin(t * Math.PI * 4 + 2) * 0.5 + 0.5;
    const b = Math.sin(t * Math.PI * 4 + 4) * 0.5 + 0.5;
    const [vr, vg, vb] = rgbToVgaDac(r * 255, g * 255, b * 255);
    dac[i * 3 + 0] = vr;
    dac[i * 3 + 1] = vg;
    dac[i * 3 + 2] = vb;
  }

  // 3. Apply active palette cycle if configured
  if (cycleConfig && cycleConfig.enabled) {
    const shift = Math.floor(frameCount / Math.max(1, cycleConfig.speed));
    const colors = getCycleColorTable(cycleConfig);
    const len = colors.length;

    for (let i = 0; i < cycleConfig.count; i++) {
      let srcIdx: number;
      if (cycleConfig.direction === 'forward') {
        srcIdx = (i + shift) % len;
      } else if (cycleConfig.direction === 'reverse') {
        srcIdx = (i - shift) % len;
        if (srcIdx < 0) srcIdx += len;
      } else {
        // pingpong
        const period = (len - 1) * 2;
        const p = (i + shift) % period;
        srcIdx = p < len ? p : period - p;
      }

      const hex = colors[srcIdx % len];
      const [r, g, b] = hexToRgb(hex);
      const [vr, vg, vb] = rgbToVgaDac(r, g, b);

      const targetDacIndex = cycleConfig.startIndex + i;
      if (targetDacIndex < 256) {
        dac[targetDacIndex * 3 + 0] = vr;
        dac[targetDacIndex * 3 + 1] = vg;
        dac[targetDacIndex * 3 + 2] = vb;
      }
    }
  }

  return dac;
}

// Built-in iconic C64 / Demoscene Palette Cycle Presets
export const PALETTE_CYCLE_PRESETS: Record<PaletteCycleConfig['type'], string[]> = {
  raster_bars: [
    '#000000', '#220000', '#550000', '#880000', '#BB1111', '#EE3333', '#FF7777', '#FFAAAA',
    '#FFFFFF', '#FFAAAA', '#FF7777', '#EE3333', '#BB1111', '#880000', '#550000', '#220000'
  ],
  copper_rainbow: [
    '#FF0055', '#FF5500', '#FFAA00', '#EEFF00', '#55FF00', '#00FFAA', '#00EEFF', '#0055FF',
    '#7700FF', '#DD00FF', '#FF00AA', '#FF0055', '#DD0022', '#AA0000', '#660000', '#220000'
  ],
  plasma_wave: [
    '#000022', '#000066', '#0022AA', '#0066FF', '#00CCFF', '#44FFFF', '#88FFEE', '#CCFFFF',
    '#FFFFFF', '#CCFFFF', '#88FFEE', '#44FFFF', '#00CCFF', '#0066FF', '#0022AA', '#000066'
  ],
  water_shimmer: [
    '#001133', '#002266', '#004499', '#0077CC', '#22AAFF', '#66DDFF', '#AAFFFF', '#EEFFFF',
    '#AAFFFF', '#66DDFF', '#22AAFF', '#0077CC', '#004499', '#002266', '#001133', '#000818'
  ],
  custom: [
    '#000000', '#880000', '#AAFFEE', '#CC44CC', '#00CC55', '#0000AA', '#EEEE77', '#DD8855',
    '#664400', '#FF7777', '#333333', '#777777', '#AAFF66', '#0088FF', '#BBBBBB', '#FFFFFF'
  ]
};

export function getCycleColorTable(config: PaletteCycleConfig): string[] {
  if (config.type === 'custom' && config.customColors && config.customColors.length > 0) {
    return config.customColors;
  }
  return PALETTE_CYCLE_PRESETS[config.type] || PALETTE_CYCLE_PRESETS.raster_bars;
}
