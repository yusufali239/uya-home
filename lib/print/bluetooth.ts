/**
 * Печать на Bluetooth-термопринтер через Web Bluetooth API.
 *
 * Работает: Chrome / Edge на Android, Windows, macOS, ChromeOS (только по HTTPS).
 * Не работает: Safari на iPhone (на iOS можно использовать браузер Bluefy).
 * Web Bluetooth видит только BLE (Bluetooth 4.0+). XP-365B с Bluetooth — BLE-совместимый.
 */

/**
 * BLE-сервисы «последовательного порта», которые используют китайские
 * термопринтеры (Xprinter, GOOJPRT, Munbyn и др.). Браузер даёт доступ
 * только к сервисам, перечисленным заранее.
 */
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Xprinter / большинство POS-принтеров
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip ISSC
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

interface Connection {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

// Подключение живёт, пока открыта вкладка: второй бейджик печатается без выбора принтера
let connection: Connection | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ищем характеристику, в которую можно писать данные */
async function findWritableCharacteristic(server: BluetoothRemoteGATTServer) {
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    // Предпочитаем запись с подтверждением — у принтера маленький буфер
    const withResponse = characteristics.find((c) => c.properties.write);
    const withoutResponse = characteristics.find((c) => c.properties.writeWithoutResponse);
    if (withResponse || withoutResponse) return (withResponse ?? withoutResponse)!;
  }
  throw new Error('У принтера не найден канал для печати. Проверьте, что выбран именно принтер.');
}

async function connect(device: BluetoothDevice): Promise<Connection> {
  const server = await device.gatt!.connect();
  const characteristic = await findWritableCharacteristic(server);
  connection = { device, characteristic };
  device.addEventListener('gattserverdisconnected', () => {
    if (connection?.device === device) connection = null;
  });
  return connection;
}

/** Имя подключённого принтера (если есть) */
export function connectedPrinterName(): string | null {
  return connection?.device.gatt?.connected ? connection.device.name ?? 'Принтер' : null;
}

/**
 * Подключиться к принтеру. Выбор устройства — системное окно браузера,
 * поэтому вызывать только по нажатию кнопки.
 */
export async function connectPrinter(forceChoose = false): Promise<Connection> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Этот браузер не поддерживает Bluetooth. Откройте страницу в Chrome на Android.');
  }

  if (!forceChoose && connection) {
    if (connection.device.gatt?.connected) return connection;
    try {
      return await connect(connection.device); // переподключение без выбора
    } catch {
      connection = null;
    }
  }

  const device = await navigator.bluetooth.requestDevice({
    // Не все принтеры объявляют сервисы в рекламе — показываем все устройства
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  return connect(device);
}

export function disconnectPrinter() {
  connection?.device.gatt?.disconnect();
  connection = null;
}

/** Отправка данных кусками (BLE передаёт максимум ~20–512 байт за раз) */
export async function sendToPrinter(data: Uint8Array, onProgress?: (fraction: number) => void): Promise<void> {
  const { characteristic } = await connectPrinter();
  const withResponse = characteristic.properties.write;
  let chunkSize = 180;

  for (let offset = 0; offset < data.length; ) {
    const chunk = data.slice(offset, offset + chunkSize);
    try {
      if (withResponse) {
        await characteristic.writeValueWithResponse(chunk);
      } else {
        await characteristic.writeValueWithoutResponse(chunk);
        await sleep(12); // без подтверждения — даём принтеру прожевать буфер
      }
    } catch (err) {
      // Маленький MTU: повторяем этот же кусок минимальными пакетами по 20 байт
      if (chunkSize > 20) {
        chunkSize = 20;
        continue;
      }
      throw err;
    }
    offset += chunk.length;
    onProgress?.(Math.min(1, offset / data.length));
  }
}
