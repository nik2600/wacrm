import type { LeadCategory, LeadStage } from '@/types'
import { LEAD_CATEGORIES, LEAD_STAGES } from './leads'

export interface LeadImportRow {
  phone: string
  name?: string
  email?: string
  company?: string
  category?: LeadCategory
  stage?: LeadStage
  next_followup?: string
  notes?: string
  campaign?: string
  platform?: string
  ad_name?: string
  lead_source?: string
}

const aliases: Record<keyof LeadImportRow, string[]> = {
  phone: ['phone', 'phone number', 'mobile', 'mobile number'],
  name: ['name', 'full name', 'lead name'],
  email: ['email', 'email address'],
  company: ['company', 'business'],
  category: ['category', 'lead quality', 'quality'],
  stage: ['stage', 'sales stage'],
  next_followup: ['next followup', 'next_followup', 'followup', 'follow-up'],
  notes: ['notes', 'lead notes'],
  campaign: ['campaign', 'campaign name'],
  platform: ['platform', 'channel'],
  ad_name: ['ad', 'ad name', 'ad_name'],
  lead_source: ['source', 'lead source', 'lead_source'],
}

export function parseLeadCsv(text: string): LeadImportRow[] {
  const records = parseCsvRecords(text)
  if (records.length < 2) return []

  const headers = records[0].map(normalizeHeader)
  const indexes = Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      headers.findIndex((header) => names.includes(header)),
    ]),
  ) as Record<keyof LeadImportRow, number>

  if (indexes.phone < 0) return []

  return records.slice(1).flatMap((values) => {
    const value = (field: keyof LeadImportRow) => {
      const index = indexes[field]
      return index >= 0 ? values[index]?.trim() || undefined : undefined
    }
    const phone = value('phone')
    if (!phone) return []

    const categoryValue = value('category')
    const stageValue = value('stage')
    const category = LEAD_CATEGORIES.find(
      (item) => item.toLowerCase() === categoryValue?.toLowerCase(),
    )
    const stage = LEAD_STAGES.find(
      (item) => item.toLowerCase() === stageValue?.toLowerCase(),
    )
    const followupValue = value('next_followup')
    const followupDate = followupValue ? new Date(followupValue) : null

    return [{
      phone,
      name: value('name'),
      email: value('email'),
      company: value('company'),
      category,
      stage,
      next_followup:
        followupDate && !Number.isNaN(followupDate.getTime())
          ? followupDate.toISOString()
          : undefined,
      notes: value('notes'),
      campaign: value('campaign'),
      platform: value('platform'),
      ad_name: value('ad_name'),
      lead_source: value('lead_source'),
    }]
  })
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}
