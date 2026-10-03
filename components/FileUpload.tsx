'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  /** Имя скрытого поля формы, куда попадёт публичный URL */
  name: string;
  label: string;
  bucket: 'products' | 'batches';
  folder: string;
  accept?: string;
  defaultUrl?: string | null;
  required?: boolean;
}

/**
 * Загрузка файла прямо из браузера в Supabase Storage.
 * Файл не идёт через сервер Next.js — нет лимита Vercel 4.5 МБ на тело запроса.
 * В форму уходит только готовый публичный URL.
 */
export function FileUpload({ name, label, bucket, folder, accept, defaultUrl, required }: Props) {
  const [url, setUrl] = useState(defaultUrl ?? '');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setError('');

    const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined });

    if (uploadError) {
      setStatus('error');
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    setUrl(data.publicUrl);
    setStatus('idle');
  }

  const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(url);

  return (
    <div>
      <span className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {/* required на скрытом поле не работает — проверяем в server action */}
      <input type="hidden" name={name} value={url} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer text-sm">
          {status === 'uploading' ? 'Yuklanmoqda…' : url ? 'Faylni almashtirish' : 'Fayl tanlash'}
          <input type="file" accept={accept} className="hidden" onChange={handleChange} disabled={status === 'uploading'} />
        </label>
        {url && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover ring-1 ring-black/10" />
        )}
        {url && !isImage && (
          <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 underline">
            Faylni ochish ✓
          </a>
        )}
        {url && (
          <button type="button" className="text-sm text-gray-500 hover:text-red-600" onClick={() => setUrl('')}>
            Olib tashlash
          </button>
        )}
      </div>
      {status === 'error' && <p className="mt-1 text-sm text-red-600">Yuklashda xato: {error}</p>}
    </div>
  );
}
