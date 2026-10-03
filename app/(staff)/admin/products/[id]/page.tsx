import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Старые ссылки на товар ведут в карточку его модели */
export default async function ProductRedirect({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('products').select('model_id').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  redirect(`/admin/models/${data.model_id}`);
}
