import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  syncGoogleSheetSource,
  type GoogleSheetImportSource,
} from '@/lib/google-sheet-import-sources'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: source, error } = await supabase
    .from('google_sheet_import_sources')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const result = await syncGoogleSheetSource(
      supabase,
      source as GoogleSheetImportSource,
    )
    return NextResponse.json({
      ...result,
      errors: result.errors.slice(0, 5),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
