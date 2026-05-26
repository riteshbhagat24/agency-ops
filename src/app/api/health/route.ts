import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('departments').select('id', { head: true, count: 'exact' });
    return NextResponse.json({ ok: true, db: error ? 'unreachable' : 'reachable' });
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'unreachable' }, { status: 500 });
  }
}
