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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('google_sheet_import_sources')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ source: data })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | (Partial<GoogleSheetSourceInput> & { is_active?: boolean; name?: string })
    | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  try {
    let payload: Record<string, unknown>
    if (body.source_type) {
      payload = normalizeSourceInput(body as GoogleSheetSourceInput)
    } else {
      payload = {}
      if (body.name !== undefined) payload.name = body.name.trim()
      if (body.is_active !== undefined) payload.is_active = body.is_active
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }
    const { data, error } = await supabase
      .from('google_sheet_import_sources')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ source: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid source'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('google_sheet_import_sources')
    .delete() 
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
