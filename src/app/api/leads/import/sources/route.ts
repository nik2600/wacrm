import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  normalizeSourceInput,
  type GoogleSheetSourceInput,
} from '@/lib/google-sheet-import-sources'

async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('google_sheet_import_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sources: data ?? [] })
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | GoogleSheetSourceInput
    | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  try {
    const payload = normalizeSourceInput(body)
    const { data, error } = await supabase
      .from('google_sheet_import_sources')
      .insert({ ...payload, user_id: user.id })
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ source: data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid source'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
