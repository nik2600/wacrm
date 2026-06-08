import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchPrivateSheetCsv,
  fetchPublishedSheetCsv,
} from '@/lib/google-sheets'
import { parseLeadCsv } from '@/lib/lead-import'
import { importLeadRows, type LeadImportResult } from '@/lib/lead-import-service'

export type GoogleSheetImportSource = {
  id: string
  user_id: string
  name: string
  source_type: 'published_csv' | 'private_sheet'
  published_url: string | null
  spreadsheet_id: string | null
  sheet_range: string | null
  is_active: boolean
  last_synced_at: string | null
  last_result: LeadImportResult | null
  created_at: string
  updated_at: string
}

export type GoogleSheetSourceInput =
  | {
      source_type: 'published_csv'
      published_url: string
      name?: string
      is_active?: boolean
    }
  | {
      source_type: 'private_sheet'
      spreadsheet_id: string
      sheet_range?: string
      name?: string
      is_active?: boolean
    }

export type GoogleSheetSourceSyncResult = LeadImportResult & {
  source: GoogleSheetImportSource
  ok: boolean
}

export function normalizeSourceInput(
  body: GoogleSheetSourceInput,
): Record<string, unknown> {
  if (body.source_type === 'published_csv') {
    const publishedUrl = body.published_url.trim()
    if (!publishedUrl) throw new Error('Published URL is required')
    return {
      name: body.name?.trim() || 'Published Google Sheet',
      source_type: 'published_csv',
      published_url: publishedUrl,
      spreadsheet_id: null,
      sheet_range: null,
      is_active: body.is_active ?? true,
    }
  }

  const spreadsheetId = body.spreadsheet_id.trim()
  if (!spreadsheetId) throw new Error('Spreadsheet ID is required')
  return {
    name: body.name?.trim() || 'Private Google Sheet',
    source_type: 'private_sheet',
    published_url: null,
    spreadsheet_id: spreadsheetId,
    sheet_range: body.sheet_range?.trim() || 'Sheet1',
    is_active: body.is_active ?? true,
  }
}

export function summarizeSourceResults(results: LeadImportResult[]) {
  return {
    created: sum(results, 'created'),
    updated: sum(results, 'updated'),
    failed: sum(results, 'failed'),
    total: sum(results, 'total'),
  }
}

export async function syncGoogleSheetSource(
  supabase: SupabaseClient,
  source: GoogleSheetImportSource,
): Promise<LeadImportResult> {
  const csv =
    source.source_type === 'published_csv'
      ? await fetchPublishedSheetCsv(source.published_url ?? '')
      : await fetchPrivateSheetCsv(
          source.spreadsheet_id ?? '',
          source.sheet_range || 'Sheet1',
        )
  const rows = parseLeadCsv(csv)
  const result = await importLeadRows(supabase, source.user_id, rows)
  await supabase
    .from('google_sheet_import_sources')
    .update({
      last_synced_at: new Date().toISOString(),
      last_result: result,
    })
    .eq('id', source.id)
  return result
}

export async function syncGoogleSheetSourceAttempt(
  supabase: SupabaseClient,
  source: GoogleSheetImportSource,
): Promise<GoogleSheetSourceSyncResult> {
  try {
    return {
      source,
      ok: true,
      ...(await syncGoogleSheetSource(supabase, source)),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    const result: LeadImportResult = {
      created: 0,
      updated: 0,
      failed: 1,
      total: 0,
      errors: [{ row: 0, phone: '', message }],
    }
    await supabase
      .from('google_sheet_import_sources')
      .update({
        last_synced_at: new Date().toISOString(),
        last_result: result,
      })
      .eq('id', source.id)
    return {
      source,
      ok: false,
      ...result,
    }
  }
}

function sum(results: LeadImportResult[], field: keyof LeadImportResult) {
  return results.reduce((total, result) => {
    const value = result[field]
    return total + (typeof value === 'number' ? value : 0)
  }, 0)
}
