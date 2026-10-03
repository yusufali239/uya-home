import { DOTS_PER_MM } from './badgeCanvas';

/**
 * Перевод растра в команды термопринтера.
 *
 * XP-365B умеет два режима (переключаются на самом принтере):
 *  - этикеточный — язык TSPL;
 *  - чековый     — язык ESC/POS.
 * Если принтер печатает «кракозябры» вместо картинки — выбран не тот язык.
 */

export type PrinterProtocol = 'tspl' | 'escpos';
export type PaperType = 'roll' | 'label';

export interface PrintSettings {
  protocol: PrinterProtocol;
  /** roll — непрерывная лента, label — этикетки с зазором (только TSPL) */
  paper: PaperType;
  /** Высота этикетки, мм (для paper = label) */
  labelHeightMm: number;
  /** Зазор между этикетками, мм */
  gapMm: number;
  /** Плотность печати TSPL 0..15 */
  density: number;
  /** Повернуть на 180° (если бейджик выходит вверх ногами) */
  flip: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  protocol: 'tspl',
  paper: 'roll',
  labelHeightMm: 100,
  gapMm: 2,
  density: 10,
  flip: false,
};

/** Монохромный растр: 1 бит на точку, строки по bytesPerRow, бит 1 = чёрная точка */
export interface Raster {
  width: number;
  height: number;
  bytesPerRow: number;
  data: Uint8Array;
}

/**
 * Canvas → 1-битный растр (порог 50%).
 * Если задана maxHeight (этикетка), картинка пропорционально уменьшается, чтобы влезть.
 */
export function canvasToRaster(source: HTMLCanvasElement, maxHeight?: number): Raster {
  let canvas = source;

  if (maxHeight && source.height > maxHeight) {
    const scale = maxHeight / source.height;
    canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = maxHeight;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, canvas.width, canvas.height);
    const w = Math.round(source.width * scale);
    c.drawImage(source, Math.round((source.width - w) / 2), 0, w, maxHeight);
  }

  const { width, height } = canvas;
  const bytesPerRow = Math.ceil(width / 8);
  const px = canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const luminance = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (luminance < 128 && px[i + 3] > 0) {
        data[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { width, height, bytesPerRow, data };
}

/** Поворот растра на 180° */
function rotate180(r: Raster): Raster {
  const out = new Uint8Array(r.data.length);
  for (let y = 0; y < r.height; y++) {
    for (let x = 0; x < r.width; x++) {
      if (r.data[y * r.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) {
        const nx = r.width - 1 - x;
        const ny = r.height - 1 - y;
        out[ny * r.bytesPerRow + (nx >> 3)] |= 0x80 >> (nx & 7);
      }
    }
  }
  return { ...r, data: out };
}

function concat(parts: (Uint8Array | number[])[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const ascii = (s: string) => new TextEncoder().encode(s);

/**
 * TSPL (этикеточный режим XP-365B).
 * Внимание: в BITMAP у TSPL бит 0 = печать, 1 = пусто — поэтому инвертируем.
 */
export function encodeTspl(raster: Raster, settings: PrintSettings): Uint8Array {
  const r = settings.flip ? rotate180(raster) : raster;
  const widthMm = Math.round(r.width / DOTS_PER_MM);
  const isLabel = settings.paper === 'label';
  const heightMm = isLabel ? settings.labelHeightMm : Math.ceil(r.height / DOTS_PER_MM) + 2;

  const bitmap = new Uint8Array(r.data.length);
  for (let i = 0; i < r.data.length; i++) bitmap[i] = ~r.data[i] & 0xff;

  return concat([
    ascii(
      [
        `SIZE ${widthMm} mm,${heightMm} mm`,
        isLabel ? `GAP ${settings.gapMm} mm,0 mm` : 'GAP 0 mm,0 mm',
        'DIRECTION 1,0',
        'REFERENCE 0,0',
        `DENSITY ${settings.density}`,
        'SPEED 4',
        'CLS',
        `BITMAP 0,0,${r.bytesPerRow},${r.height},0,`,
      ].join('\r\n'),
    ),
    bitmap,
    ascii('\r\nPRINT 1,1\r\n'),
  ]);
}

/**
 * ESC/POS (чековый режим): растр командой GS v 0 полосами по 128 строк
 * (большие блоки некоторые прошивки не переваривают).
 */
export function encodeEscPos(raster: Raster, settings: PrintSettings): Uint8Array {
  const r = settings.flip ? rotate180(raster) : raster;
  const parts: (Uint8Array | number[])[] = [
    [0x1b, 0x40], // ESC @ — сброс
    [0x1b, 0x61, 0x01], // ESC a 1 — по центру
  ];

  const band = 128;
  for (let y = 0; y < r.height; y += band) {
    const rows = Math.min(band, r.height - y);
    parts.push([
      0x1d, 0x76, 0x30, 0x00, // GS v 0, обычный масштаб
      r.bytesPerRow & 0xff, (r.bytesPerRow >> 8) & 0xff,
      rows & 0xff, (rows >> 8) & 0xff,
    ]);
    parts.push(r.data.subarray(y * r.bytesPerRow, (y + rows) * r.bytesPerRow));
  }

  parts.push([0x1b, 0x64, 0x04]); // ESC d 4 — промотать ленту для отрыва
  return concat(parts);
}

/** Готовые байты для отправки на принтер */
export function buildPrintJob(canvas: HTMLCanvasElement, settings: PrintSettings): Uint8Array {
  const maxHeight =
    settings.protocol === 'tspl' && settings.paper === 'label'
      ? (settings.labelHeightMm - 2) * DOTS_PER_MM // небольшой запас от края этикетки
      : undefined;
  const raster = canvasToRaster(canvas, maxHeight);
  return settings.protocol === 'tspl' ? encodeTspl(raster, settings) : encodeEscPos(raster, settings);
}
