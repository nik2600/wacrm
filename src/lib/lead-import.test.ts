import { describe, expect, it } from 'vitest'
import { parseLeadCsv } from './lead-import'

describe('parseLeadCsv', () => {
  it('maps lead attribution and quality aliases', () => {
    const rows = parseLeadCsv(
      [
        'Phone,Full Name,Lead Quality,Sales Stage,Campaign Name,Platform,Ad Name,Source',
        '"+15551234567","Ada, Lovelace",Ace,Followup,Summer Sale,Meta,Video A,Facebook Form',
      ].join('\n'),
    )

    expect(rows).toEqual([
      expect.objectContaining({
        phone: '+15551234567',
        name: 'Ada, Lovelace',
        category: 'Ace',
        stage: 'Followup',
        campaign: 'Summer Sale',
        platform: 'Meta',
        ad_name: 'Video A',
        lead_source: 'Facebook Form',
      }),
    ])
  })

  it('handles escaped quotes and ignores rows without phone numbers', () => {
    const rows = parseLeadCsv(
      'phone,name,notes\n,"Missing Phone",skip\n123,"Jane ""JJ"" Doe","Called, interested"',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      phone: '123',
      name: 'Jane "JJ" Doe',
      notes: 'Called, interested',
    })
  })

  it('requires a recognized phone header', () => {
    expect(parseLeadCsv('name,email\nAda,ada@example.com')).toEqual([])
  })
})
