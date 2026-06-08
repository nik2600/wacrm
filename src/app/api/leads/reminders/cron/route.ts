import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { sendEmail } from '@/lib/email/smtp'
import type { Contact } from '@/types'

export async function GET(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET
  const supplied = request.headers.get('x-cron-secret') ?? ''
  if (!expected) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 })
  }
  const expectedBuffer = Buffer.from(expected)
  const suppliedBuffer = Buffer.from(supplied)
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setUTCHours(23, 59, 59, 999)
  const dateKey = now.toISOString().slice(0, 10)

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('user_id, full_name, email')
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  let nudgesSent = 0
  let digestsSent = 0
  const errors: string[] = []

  for (const profile of profiles ?? []) {
    const { data: contacts, error } = await admin
      .from('contacts')
      .select('*')
      .eq('user_id', profile.user_id)
      .not('next_followup', 'is', null)
      .lte('next_followup', endOfToday.toISOString())
      .order('next_followup', { ascending: true })
    if (error) {
      errors.push(`${profile.email}: ${error.message}`)
      continue
    }

    const due = (contacts ?? []) as Contact[]
    if (!due.length) continue

    for (const lead of due) {
      const periodKey = lead.next_followup!
      if (
        await wasSent(
          admin,
          profile.user_id,
          lead.id,
          'followup_nudge',
          periodKey,
        )
      ) {
        continue
      }
      try {
        await sendEmail({
          to: profile.email,
          subject: `Follow-up due: ${lead.name || lead.phone}`,
          html: nudgeHtml(profile.full_name, lead),
        })
        await logSent(
          admin,
          profile.user_id,
          lead.id,
          'followup_nudge',
          periodKey,
        )
        nudgesSent++
      } catch (sendError) {
        errors.push(
          `${profile.email}: ${sendError instanceof Error ? sendError.message : 'send failed'}`,
        )
      }
    }

    if (
      !(await wasSent(
        admin,
        profile.user_id,
        null,
        'daily_digest',
        dateKey,
      ))
    ) {
      try {
        await sendEmail({
          to: profile.email,
          subject: `Daily lead follow-up digest: ${due.length} due`,
          html: digestHtml(profile.full_name, due),
        })
        await logSent(
          admin,
          profile.user_id,
          null,
          'daily_digest',
          dateKey,
        )
        digestsSent++
      } catch (sendError) {
        errors.push(
          `${profile.email}: ${sendError instanceof Error ? sendError.message : 'send failed'}`,
        )
      }
    }
  }

  return NextResponse.json({ nudgesSent, digestsSent, errors })
}

async function wasSent(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  contactId: string | null,
  kind: 'followup_nudge' | 'daily_digest',
  periodKey: string,
) {
  let query = admin
    .from('lead_email_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('email_kind', kind)
    .eq('period_key', periodKey)
  query = contactId
    ? query.eq('contact_id', contactId)
    : query.is('contact_id', null)
  const { count } = await query
  return (count ?? 0) > 0
}

async function logSent(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  contactId: string | null,
  kind: 'followup_nudge' | 'daily_digest',
  periodKey: string,
) {
  await admin.from('lead_email_log').insert({
    user_id: userId,
    contact_id: contactId,
    email_kind: kind,
    period_key: periodKey,
  })
}

function nudgeHtml(name: string, lead: Contact) {
  return `
    <h2>Lead follow-up due</h2>
    <p>Hello ${escapeHtml(name)},</p>
    <p><strong>${escapeHtml(lead.name || 'Unnamed lead')}</strong> is due for follow-up.</p>
    <ul>
      <li>Phone: ${escapeHtml(lead.phone)}</li>
      <li>Stage: ${escapeHtml(lead.stage)}</li>
      <li>Campaign: ${escapeHtml(lead.campaign || 'Not set')}</li>
      <li>Scheduled: ${escapeHtml(new Date(lead.next_followup!).toLocaleString('en-US', { timeZone: 'UTC' }))} UTC</li>
    </ul>
    <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')}/follow-ups">Open follow-ups</a></p>
  `
}

function digestHtml(name: string, leads: Contact[]) {
  const rows = leads
    .map(
      (lead) => `
        <tr>
          <td>${escapeHtml(lead.name || lead.phone)}</td>
          <td>${escapeHtml(lead.stage)}</td>
          <td>${escapeHtml(lead.campaign || '-')}</td>
          <td>${escapeHtml(new Date(lead.next_followup!).toLocaleString('en-US', { timeZone: 'UTC' }))}</td>
        </tr>`,
    )
    .join('')
  return `
    <h2>Daily lead follow-up digest</h2>
    <p>Hello ${escapeHtml(name)}, you have ${leads.length} overdue or due-today follow-up${leads.length === 1 ? '' : 's'}.</p>
    <table cellpadding="8" cellspacing="0" border="1">
      <thead><tr><th>Lead</th><th>Stage</th><th>Campaign</th><th>Due (UTC)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')}/follow-ups">Open follow-ups</a></p>
  `
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character]!,
  )
}
