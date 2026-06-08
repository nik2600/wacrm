import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  fetchPrivateSheetCsv,
  fetchPublishedSheetCsv,
} from '@/lib/google-sheets'
import { parseLeadCsv, type LeadImportRow } from '@/lib/lead-import'
import { importLeadRows } from '@/lib/lead-import-service'

type ImportBody =
  | { mode: 'rows'; rows: LeadImportRow[] }
  | { mode: 'published_csv'; url: string }
  | { mode: 'private_sheet'; spreadsheetId: string; range: string }

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as ImportBody | null
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  try {
    let rows: LeadImportRow[]
    if (body.mode === 'rows') {
      rows = body.rows
    } else if (body.mode === 'published_csv') {
      rows = parseLeadCsv(await fetchPublishedSheetCsv(body.url))
    } else {
      rows = parseLeadCsv(
        await fetchPrivateSheetCsv(body.spreadsheetId, body.range || 'Sheet1'),
      )
    }

    if (!rows.length) {
      return NextResponse.json(
        { error: 'No valid rows found. A phone column is required.' },
        { status: 400 },
      )
    }
    if (rows.length > 5000) {
      return NextResponse.json(
        { error: 'Imports are limited to 5,000 rows per request.' },
        { status: 400 },
      )
    }

    const result = await importLeadRows(supabase, user.id, rows)

    return NextResponse.json({
      ...result,
      errors: result.errors.slice(0, 5),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
