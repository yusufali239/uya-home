import QRCode from 'qrcode';

/**
 * Рендер бейджика клиента в растр для термопринтера.
 *
 * Термопринтер печатает точками 203 dpi = 8 точек на мм, только чёрное/белое.
 * Поэтому бейджик рисуется на Canvas сразу в «точках принтера»:
 * одна и та же картинка уходит и по Bluetooth, и в window.print() —
 * результат одинаковый при любом способе печати.
 */

/** 203 dpi ≈ 8 точек на миллиметр */
export const DOTS_PER_MM = 8;

/** Логотип: если положить файл public/logo.png — он заменит текстовый логотип */
const LOGO_URL = '/logo.png';

export interface BadgeData {
  orderNumber: string;
  productName: string;
  sku: string;
  color: string | null;
  dimensions: string | null;
  quantity: number;
  photoUrl: string | null;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  createdAt: string;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

/** Загрузка картинки с CORS (иначе canvas «испачкается» и не отдаст пиксели) */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Перенос текста по словам в пределах ширины (длинные слова режутся) */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // Слово длиннее строки — режем посимвольно
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Фото → чёрно-белое с диффузией ошибки Флойда–Стейнберга.
 * Простой порог превращает фото в чёрное пятно, дизеринг сохраняет полутона.
 */
function ditherImage(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const l = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    // Чуть осветляем и добавляем контраст: термобумага печатает темнее экрана
    gray[i] = Math.min(255, Math.max(0, (l - 128) * 1.15 + 128 + 18));
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const value = gray[i] < 128 ? 0 : 255;
      const err = gray[i] - value;
      gray[i] = value;
      if (x + 1 < width) gray[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) gray[i + width - 1] += (err * 3) / 16;
        gray[i + width] += (err * 5) / 16;
        if (x + 1 < width) gray[i + width + 1] += err / 16;
      }
    }
  }

  for (let i = 0; i < gray.length; i++) {
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = gray[i];
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** QR-код квадратами без сглаживания (чёткие края — QR читается с термобумаги) */
function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const cell = Math.floor(size / count);
  const offset = Math.floor((size - cell * count) / 2);
  ctx.fillStyle = '#000';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.modules.get(r, c)) ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
    }
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Bishkek',
  }).format(new Date(iso));
}

/**
 * Рисует бейджик. width — ширина в точках принтера
 * (XP-365B: максимум 76 мм = 608 точек). Высота — по содержимому.
 */
export async function renderBadge(data: BadgeData, width: number): Promise<HTMLCanvasElement> {
  const pad = 2 * DOTS_PER_MM; // поля 2 мм слева/справа
  const inner = width - pad * 2;
  const gap = 2 * DOTS_PER_MM;

  const [photo, logo] = await Promise.all([
    data.photoUrl ? loadImage(data.photoUrl) : Promise.resolve(null),
    loadImage(LOGO_URL),
  ]);

  // Рисуем на заведомо высоком холсте, потом обрезаем по фактической высоте
  const draft = document.createElement('canvas');
  draft.width = width;
  draft.height = 4000;
  const ctx = draft.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, draft.width, draft.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  let y = pad;

  // ── 1. Логотип + номер заказа ───────────────────────────────
  const headerH = 7 * DOTS_PER_MM;
  ctx.font = `800 ${Math.round(headerH * 0.62)}px ${FONT}`;
  const numberText = `№${data.orderNumber}`;
  const numberW = ctx.measureText(numberText).width + 3 * DOTS_PER_MM;

  if (logo) {
    const maxW = inner - numberW - gap;
    const scale = Math.min(headerH / logo.height, maxW / logo.width);
    const lw = Math.round(logo.width * scale);
    const lh = Math.round(logo.height * scale);
    ctx.drawImage(ditherImage(logo, lw, lh), pad, y + Math.round((headerH - lh) / 2));
  } else {
    ctx.font = `900 ${Math.round(headerH * 0.8)}px ${FONT}`;
    ctx.fillText('UYA HOME', pad, y + Math.round(headerH * 0.1));
  }

  // Номер заказа — белым по чёрному
  ctx.fillRect(width - pad - numberW, y, numberW, headerH);
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${Math.round(headerH * 0.62)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(numberText, width - pad - numberW / 2, y + Math.round(headerH * 0.2));
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000';

  y += headerH + DOTS_PER_MM;
  ctx.fillRect(pad, y, inner, 3);
  y += 3 + gap;

  // ── 2. Фото товара ──────────────────────────────────────────
  if (photo) {
    const maxH = 34 * DOTS_PER_MM;
    const scale = Math.min(inner / photo.width, maxH / photo.height);
    const pw = Math.round(photo.width * scale);
    const ph = Math.round(photo.height * scale);
    ctx.drawImage(ditherImage(photo, pw, ph), pad + Math.round((inner - pw) / 2), y);
    y += ph + gap;
  }

  // ── 3. Название и код ───────────────────────────────────────
  ctx.font = `800 ${6 * DOTS_PER_MM}px ${FONT}`;
  for (const line of wrapText(ctx, data.productName, inner)) {
    ctx.fillText(line, pad, y);
    y += Math.round(6 * DOTS_PER_MM * 1.15);
  }

  ctx.font = `700 ${Math.round(3.6 * DOTS_PER_MM)}px ${FONT}`;
  ctx.fillText(`Kod: ${data.sku}    Soni: ${data.quantity} dona`, pad, y);
  y += Math.round(3.6 * DOTS_PER_MM * 1.3);

  const details = [data.color, data.dimensions].filter(Boolean).join(' · ');
  if (details) {
    ctx.font = `500 ${Math.round(3.2 * DOTS_PER_MM)}px ${FONT}`;
    for (const line of wrapText(ctx, details, inner)) {
      ctx.fillText(line, pad, y);
      y += Math.round(3.2 * DOTS_PER_MM * 1.25);
    }
  }
  y += DOTS_PER_MM;

  // ── 4. Получатель ───────────────────────────────────────────
  // Пунктир-разделитель
  for (let x = pad; x < width - pad; x += 16) ctx.fillRect(x, y, 9, 2);
  y += 2 + DOTS_PER_MM * 1.5;

  ctx.font = `700 ${Math.round(2.8 * DOTS_PER_MM)}px ${FONT}`;
  ctx.fillText('QABUL QILUVCHI', pad, y);
  y += Math.round(2.8 * DOTS_PER_MM * 1.4);

  ctx.font = `800 ${Math.round(5.5 * DOTS_PER_MM)}px ${FONT}`;
  for (const line of wrapText(ctx, data.clientName, inner)) {
    ctx.fillText(line, pad, y);
    y += Math.round(5.5 * DOTS_PER_MM * 1.15);
  }

  ctx.font = `800 ${Math.round(5 * DOTS_PER_MM)}px ${FONT}`;
  ctx.fillText(`Tel. ${data.clientPhone}`, pad, y);
  y += Math.round(5 * DOTS_PER_MM * 1.25);

  ctx.font = `500 ${Math.round(4 * DOTS_PER_MM)}px ${FONT}`;
  for (const line of wrapText(ctx, data.clientAddress, inner)) {
    ctx.fillText(line, pad, y);
    y += Math.round(4 * DOTS_PER_MM * 1.25);
  }
  y += DOTS_PER_MM;

  // ── 5. QR + номер ───────────────────────────────────────────
  ctx.fillRect(pad, y, inner, 3);
  y += 3 + gap;

  const qrSize = 26 * DOTS_PER_MM;
  drawQr(ctx, data.orderNumber, pad, y, qrSize);

  const textX = pad + qrSize + gap * 1.5;
  ctx.font = `500 ${Math.round(3 * DOTS_PER_MM)}px ${FONT}`;
  ctx.fillText('Buyurtma', textX, y + DOTS_PER_MM * 3);
  ctx.font = `900 ${8 * DOTS_PER_MM}px ${FONT}`;
  ctx.fillText(data.orderNumber, textX, y + DOTS_PER_MM * 7, width - pad - textX);
  ctx.font = `500 ${Math.round(3 * DOTS_PER_MM)}px ${FONT}`;
  ctx.fillText(formatDate(data.createdAt), textX, y + DOTS_PER_MM * 17);

  y += qrSize + pad;

  // Обрезаем по высоте (кратно 8 — удобно для принтера)
  const height = Math.ceil(y / 8) * 8;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const out = canvas.getContext('2d')!;
  out.drawImage(draft, 0, 0);
  return canvas;
}
