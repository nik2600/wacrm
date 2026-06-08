import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadImportRow } from '@/lib/lead-import'

export type ImportErrorDetail = {
  row: number
  phone: string
  message: string
}

export type LeadImportResult = {
  created: number
  updated: number
  failed: number
  total: number
  errors: ImportErrorDetail[]
}

const leadMigrationMessage =
  'Missing lead columns in Supabase. Run migration 014_contact_lead_fields.sql, then refresh the PostgREST schema cache.'

const attributionMigrationMessage =
  'Missing lead attribution columns in Supabase. Run migration 015_lead_attribution_and_email_log.sql, then refresh the PostgREST schema cache.'

export async function importLeadRows(
  supabase: SupabaseClient,
  userId: string,
  rows: LeadImportRow[],
): Promise<LeadImportResult> {
  const phones = [...new Set(rows.map((row) => row.phone))]
  const { data: existing, error: existingError } = await supabase
    .from('contacts')
    .select('id, phone')
    .eq('user_id', userId)
    .in('phone', phones)
  if (existingError) throw existingError
  const byPhone = new Map((existing ?? []).map((row) => [row.phone, row.id]))

  let created = 0
  let updated = 0
  let failed = 0
  const errors: ImportErrorDetail[] = []

  for (const [index, row] of rows.entries()) {
    const contactId = byPhone.get(row.phone)
    if (contactId) {
      const payload = Object.fromEntries(
        Object.entries({
          name: row.name,
          email: row.email,
          company: row.company,
          category: row.category,
          stage: row.stage,
          next_followup: row.next_followup,
          notes: row.notes,
          campaign: row.campaign,
          platform: row.platform,
          ad_name: row.ad_name,
          lead_source: row.lead_source,
        }).filter(([, value]) => value !== undefined),
      )
      const { error } = await supabase
        .from('contacts')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', contactId)

      if (error) {
        failed++
        errors.push(rowError(index, row.phone, error.message))
      } else updated++
    } else {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          phone: row.phone,
          name: row.name || null,
          email: row.email || null,
          company: row.company || null,
          category: row.category || 'Joker',
          stage: row.stage || 'DNP',
          next_followup: row.next_followup || null,
          notes: row.notes || null,
          campaign: row.campaign || null,
          platform: row.platform || null,
          ad_name: row.ad_name || null,
          lead_source: row.lead_source || null,
        })
        .select('id')
        .single()

      if (error) {
        failed++
        errors.push(rowError(index, row.phone, error.message))
      } else {
        created++
        byPhone.set(row.phone, data.id)
      }
    }
  }

  return { created, updated, failed, total: rows.length, errors }
}

function rowError(index: number, phone: string, message: string): ImportErrorDetail {
  return {
    row: index + 2,
    phone,
    message: formatImportError(message),
  }
}

function formatImportError(message: string) {
  if (
    message.includes("'category' column") ||
    message.includes("'stage' column") ||
    message.includes("'next_followup' column") ||
    message.includes("'notes' column")
  ) {
    return `${message}. ${leadMigrationMessage}`
  }
  if (
    message.includes("'campaign' column") ||
    message.includes("'platform' column") ||
    message.includes("'ad_name' column") ||
    message.includes("'lead_source' column")
  ) {
    return `${message}. ${attributionMigrationMessage}`
  }
  return message
}
