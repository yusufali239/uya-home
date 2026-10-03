/** Типы сущностей базы данных (зеркало SQL-миграций) */

export type OrderSource = 'lalafo' | 'whatsapp' | 'instagram' | 'mesto' | 'call';
export type OrderStatus = 'new' | 'confirmed' | 'ready_to_ship' | 'shipped' | 'waiting_production';
export type BatchStatus = 'planned' | 'in_progress' | 'completed';
export type UserRole = 'director' | 'manager' | 'master';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  color: string | null;
  dimensions: string | null;
  price: number;
  cost_price: number;
  min_quantity: number;
  sketchcut_file_url: string | null;
  instruction_url: string | null;
  brand_photo_url: string | null;
  created_at: string;
}

export interface InventoryFinished {
  id: string;
  product_id: string;
  quantity: number;
  location: string | null;
  updated_at: string;
}

/** Товар вместе с остатком на складе */
export interface ProductWithStock extends Product {
  inventory_finished: Pick<InventoryFinished, 'quantity' | 'location'> | null;
}

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  client_name: string;
  client_phone: string;
  client_address: string;
  product_id: string;
  quantity: number;
  status: OrderStatus;
  created_at: string;
  shipped_at: string | null;
}

export interface CutBatch {
  id: string;
  batch_number: number;
  status: BatchStatus;
  ldsp_sheet_count: number;
  sketchcut_file_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface CutBatchItem {
  id: string;
  batch_id: string;
  product_id: string;
  quantity_to_produce: number;
  quantity_produced: number | null;
  notes: string | null;
}

export interface ScrapRemnant {
  id: string;
  size: string;
  color: string | null;
  quantity: number;
  batch_id: string | null;
  created_at: string;
}

/** Результат server action для useFormState */
export interface ActionState {
  error?: string;
  ok?: boolean;
  message?: string;
}
