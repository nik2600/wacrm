import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import {
  fetchPrivateSheetCsv,
  fetchPublishedSheetCsv,
} from '@/lib/google-sheets'
import { parseLeadCsv } from '@/lib/lead-import'
import { importLeadRows, type LeadImportResult } from '@/lib/lead-import-service'

type SourceResult = LeadImportResult & {
  source: 'published_csv' | 'private_sheet'
}

export async function GET(request: Request) {
  const expected = process.env.GOOGLE_SHEETS_IMPORT_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'Google Sheets sync is not configured' }, { status: 503 })
  }
  if (!isAuthorized(request, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = process.env.GOOGLE_SHEETS_IMPORT_USER_ID
  if (!userId) {
    return NextResponse.json(
      { error: 'GOOGLE_SHEETS_IMPORT_USER_ID is required' },
      { status: 503 },
    )
  }

  try {
    const admin = supabaseAdmin()
    const results: SourceResult[] = []

    const publishedUrl = process.env.GOOGLE_SHEETS_AUTO_PUBLISHED_URL?.trim()
    if (publishedUrl) {
      const csv = await fetchPublishedSheetCsv(publishedUrl)
      const rows = parseLeadCsv(csv)
      results.push({
        source: 'published_csv',
        ...(await importLeadRows(admin, userId, rows)),
      })
    }

    const privateSpreadsheetId =
      process.env.GOOGLE_SHEETS_AUTO_PRIVATE_SPREADSHEET_ID?.trim()
    if (privateSpreadsheetId) {
      const range =
        process.env.GOOGLE_SHEETS_AUTO_PRIVATE_RANGE?.trim() || 'Sheet1'
      const csv = await fetchPrivateSheetCsv(privateSpreadsheetId, range)
      const rows = parseLeadCsv(csv)
      results.push({
        source: 'private_sheet',
        ...(await importLeadRows(admin, userId, rows)),
      })
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'No Google Sheets automatic import sources are configured' },
        { status: 503 },
      )
    }

    return NextResponse.json({
      sources: results.map((result) => ({
        ...result,
        errors: result.errors.slice(0, 5),
      })),
      created: sum(results, 'created'),
      updated: sum(results, 'updated'),
      failed: sum(results, 'failed'),
      total: sum(results, 'total'),
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Sheets sync failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

function isAuthorized(request: Request, expected: string) {
  const supplied =
    request.headers.get('x-cron-secret') ??
    new URL(request.url).searchParams.get('secret') ??
    ''
  const suppliedBuf = Buffer.from(supplied)
  const expectedBuf = Buffer.from(expected)
  return (
    suppliedBuf.length === expectedBuf.length &&
    timingSafeEqual(suppliedBuf, expectedBuf)
  )
}

function sum(results: SourceResult[], field: keyof LeadImportResult) {
  return results.reduce((total, result) => {
    const value = result[field]
    return total + (typeof value === 'number' ? value : 0)
  }, 0)
}
