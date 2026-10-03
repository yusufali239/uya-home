'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DOTS_PER_MM, renderBadge, type BadgeData } from '@/lib/print/badgeCanvas';
import {
  connectPrinter,
  connectedPrinterName,
  disconnectPrinter,
  isWebBluetoothSupported,
  sendToPrinter,
} from '@/lib/print/bluetooth';
import { DEFAULT_PRINT_SETTINGS, buildPrintJob, type PrintSettings } from '@/lib/print/printerCommands';

/** Ширина бейджика: 76 мм с полями = максимальная ширина печати XP-365B */
const BADGE_WIDTH_MM = 76;
/** Ширина бумаги */
const PAPER_WIDTH_MM = 80;

const STORAGE_KEY = 'uya-print-settings';

function loadSettings(): PrintSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_PRINT_SETTINGS;
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
}

function saveSettings(settings: PrintSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // приватный режим — настройки просто не запомнятся
  }
}

type Status =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'printing'; progress: number }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/**
 * Печать бейджика на термопринтер Xprinter XP-365B (80 мм):
 *  1) по Bluetooth прямо из браузера (Web Bluetooth, команды TSPL/ESC-POS);
 *  2) через системную печать window.print().
 */
export function BadgePrinter({ data, backHref }: { data: BadgeData; backHref: string }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState('');
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [btSupported, setBtSupported] = useState(true);

  // Настройки и поддержка Bluetooth известны только в браузере
  useEffect(() => {
    setSettings(loadSettings());
    setBtSupported(isWebBluetoothSupported());
    setPrinterName(connectedPrinterName());
  }, []);

  // Рисуем бейджик в точках принтера: 76 мм × 8 точек/мм = 608 точек
  useEffect(() => {
    let cancelled = false;
    renderBadge(data, BADGE_WIDTH_MM * DOTS_PER_MM).then((c) => {
      if (cancelled) return;
      setCanvas(c);
      setPreview(c.toDataURL('image/png'));
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const updateSettings = (patch: Partial<PrintSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const printBluetooth = useCallback(
    async (chooseNew = false) => {
      if (!canvas) return;
      try {
        setStatus({ kind: 'connecting' });
        const { device } = await connectPrinter(chooseNew);
        setPrinterName(device.name ?? 'Принтер');

        setStatus({ kind: 'printing', progress: 0 });
        const job = buildPrintJob(canvas, settings);
        await sendToPrinter(job, (progress) => setStatus({ kind: 'printing', progress }));
        setStatus({ kind: 'done' });
      } catch (err) {
        const e = err as DOMException;
        // Пользователь закрыл окно выбора устройства — это не ошибка
        if (e?.name === 'NotFoundError' && /cancel/i.test(e.message)) {
          setStatus({ kind: 'idle' });
          return;
        }
        setPrinterName(connectedPrinterName());
        setStatus({ kind: 'error', message: e?.message || 'Не удалось напечатать' });
      }
    },
    [canvas, settings],
  );

  // Высота страницы для window.print() — по фактической высоте бейджика
  const heightMm = canvas ? Math.ceil(canvas.height / DOTS_PER_MM) + 4 : 120;
  const busy = status.kind === 'connecting' || status.kind === 'printing';

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white">
      <style>{`
        @page { size: ${PAPER_WIDTH_MM}mm ${heightMm}mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; background: #fff !important; }
          .print-area img {
            width: ${BADGE_WIDTH_MM}mm !important;
            max-width: none !important;
            margin: 2mm auto 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            image-rendering: pixelated;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b bg-white px-4 py-3">
        <Link href={backHref} className="text-lg text-brand-600">← Назад</Link>
        <div className="ml-auto text-sm text-gray-500">
          {printerName ? `🟢 ${printerName}` : 'Принтер не подключён'}
        </div>
      </div>

      {/* Превью = ровно то, что напечатается */}
      <div className="print-area flex justify-center bg-gray-100 p-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`Бейджик заказа ${data.orderNumber}`}
            className="w-full max-w-[380px] border border-gray-300 bg-white shadow-lg"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="py-24 text-gray-500">Готовлю бейджик…</div>
        )}
      </div>

      <div className="no-print space-y-3 p-4">
        <button
          className="btn-primary btn-xl"
          disabled={!canvas || busy || !btSupported}
          onClick={() => printBluetooth(false)}
        >
          {status.kind === 'connecting'
            ? 'Подключаюсь…'
            : status.kind === 'printing'
              ? `Печатаю… ${Math.round(status.progress * 100)}%`
              : '🖨 Печать по Bluetooth'}
        </button>

        {status.kind === 'printing' && (
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${status.progress * 100}%` }} />
          </div>
        )}
        {status.kind === 'done' && (
          <p className="rounded-xl bg-emerald-50 p-3 text-center text-lg font-semibold text-emerald-700">✅ Отправлено на принтер</p>
        )}
        {status.kind === 'error' && (
          <p className="rounded-xl bg-red-50 p-3 text-center font-medium text-red-700">{status.message}</p>
        )}
        {!btSupported && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Этот браузер не умеет Bluetooth-печать. На Android откройте страницу в <b>Chrome</b>, на iPhone — в браузере{' '}
            <b>Bluefy</b>. Или используйте системную печать ниже.
          </p>
        )}

        <button className="btn-secondary btn-xl" disabled={!canvas} onClick={() => window.print()}>
          Системная печать
        </button>

        {printerName && (
          <div className="flex justify-center gap-6 text-sm">
            <button className="text-brand-600 underline" disabled={busy} onClick={() => printBluetooth(true)}>
              Выбрать другой принтер
            </button>
            <button
              className="text-gray-500 underline"
              disabled={busy}
              onClick={() => {
                disconnectPrinter();
                setPrinterName(null);
              }}
            >
              Отключить
            </button>
          </div>
        )}

        <details className="rounded-2xl bg-gray-50 p-4">
          <summary className="cursor-pointer font-semibold">⚙️ Настройки принтера</summary>
          <div className="mt-4 space-y-4">
            <div>
              <span className="label">Режим принтера (язык команд)</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['tspl', 'Этикетки (TSPL)'],
                    ['escpos', 'Чеки (ESC/POS)'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateSettings({ protocol: value })}
                    className={`rounded-xl px-3 py-3 font-medium ring-1 ${
                      settings.protocol === value ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white ring-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Если вместо бейджика печатаются непонятные символы — переключите режим.
              </p>
            </div>

            {settings.protocol === 'tspl' && (
              <>
                <div>
                  <span className="label">Бумага</span>
                  <select
                    className="input"
                    value={settings.paper}
                    onChange={(e) => updateSettings({ paper: e.target.value as PrintSettings['paper'] })}
                  >
                    <option value="roll">Непрерывная лента 80 мм (длина по бейджику)</option>
                    <option value="label">Этикетки с зазором</option>
                  </select>
                </div>
                {settings.paper === 'label' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="labelHeight">Высота этикетки, мм</label>
                      <input
                        id="labelHeight"
                        type="number"
                        min={30}
                        max={300}
                        className="input"
                        value={settings.labelHeightMm}
                        onChange={(e) => updateSettings({ labelHeightMm: Number(e.target.value) || 100 })}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="gap">Зазор, мм</label>
                      <input
                        id="gap"
                        type="number"
                        min={0}
                        max={10}
                        className="input"
                        value={settings.gapMm}
                        onChange={(e) => updateSettings({ gapMm: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="density">Яркость печати: {settings.density}</label>
                  <input
                    id="density"
                    type="range"
                    min={1}
                    max={15}
                    className="w-full accent-brand-600"
                    value={settings.density}
                    onChange={(e) => updateSettings({ density: Number(e.target.value) })}
                  />
                </div>
              </>
            )}

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="h-6 w-6 accent-brand-600"
                checked={settings.flip}
                onChange={(e) => updateSettings({ flip: e.target.checked })}
              />
              Перевернуть на 180° (если выходит вверх ногами)
            </label>

            {canvas && (
              <p className="text-xs text-gray-500">
                Размер бейджика: {BADGE_WIDTH_MM} × {Math.ceil(canvas.height / DOTS_PER_MM)} мм ({canvas.width} × {canvas.height} точек, 203 dpi)
                {settings.protocol === 'tspl' &&
                  settings.paper === 'label' &&
                  canvas.height / DOTS_PER_MM > settings.labelHeightMm - 2 &&
                  ' — будет уменьшен под высоту этикетки'}
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
