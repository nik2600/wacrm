import { describe, expect, it } from 'vitest'
import type { Contact } from '@/types'
import {
  defaultCategoryForStage,
  filterLeads,
  fromDateTimeLocal,
  groupFollowups,
  normalizeLeadStageCategory,
  summarizeLeads,
} from './leads'

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    phone: '+10000000000',
    name: 'Test Lead',
    category: 'Joker',
    stage: 'DNP',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('groupFollowups', () => {
  const now = new Date(2026, 5, 8, 12, 0, 0)

  it('groups earlier today as overdue and later today as due today', () => {
    const earlier = contact({ id: 'earlier', next_followup: new Date(2026, 5, 8, 9).toISOString() })
    const later = contact({ id: 'later', next_followup: new Date(2026, 5, 8, 17).toISOString() })
    const groups = groupFollowups([later, earlier], now)

    expect(groups.overdue.map((item) => item.id)).toEqual(['earlier'])
    expect(groups.dueToday.map((item) => item.id)).toEqual(['later'])
  })

  it('puts dates after local midnight in upcoming and ignores null dates', () => {
    const midnight = contact({
      id: 'midnight',
      next_followup: new Date(2026, 5, 9, 0, 0, 0).toISOString(),
    })
    const unscheduled = contact({ id: 'none', next_followup: null })
    const groups = groupFollowups([unscheduled, midnight], now)

    expect(groups.upcoming.map((item) => item.id)).toEqual(['midnight'])
    expect(groups.overdue).toHaveLength(0)
    expect(groups.dueToday).toHaveLength(0)
  })
})

describe('lead helpers', () => {
  it('defaults category step-wise from lead stage', () => {
    expect(defaultCategoryForStage('DNP')).toBe('Joker')
    expect(defaultCategoryForStage('Followup')).toBe('Queen')
    expect(defaultCategoryForStage('Meeting Scheduled')).toBe('King')
    expect(defaultCategoryForStage('Send Proposal')).toBe('Ace')
    expect(defaultCategoryForStage('Onboarded')).toBe('Ace')
    expect(defaultCategoryForStage('Rejected')).toBe('Joker')
  })

  it('normalizes stale category values from the current stage', () => {
    expect(
      normalizeLeadStageCategory(
        contact({ stage: 'Followup', category: 'Joker' }),
      ).category,
    ).toBe('Queen')
  })

  it('filters by search, stage, and category together', () => {
    const leads = [
      contact({ id: '1', name: 'Ada Lovelace', stage: 'Followup', category: 'Ace' }),
      contact({ id: '2', name: 'Grace Hopper', stage: 'DNP', category: 'Ace' }),
    ]

    expect(filterLeads(leads, 'ada', 'Followup', 'Ace').map((item) => item.id)).toEqual(['1'])
    expect(filterLeads(leads, '', 'DNP', 'all').map((item) => item.id)).toEqual(['2'])
  })

  it('summarizes stages, categories, and actionable follow-ups', () => {
    const now = new Date(2026, 5, 8, 12)
    const leads = [
      contact({
        stage: 'Followup',
        category: 'Ace',
        next_followup: new Date(2026, 5, 8, 10).toISOString(),
      }),
      contact({
        stage: 'Onboarded',
        category: 'King',
        next_followup: new Date(2026, 5, 9, 10).toISOString(),
      }),
    ]
    const summary = summarizeLeads(leads, now)

    expect(summary.totalLeads).toBe(2)
    expect(summary.dueFollowups).toBe(1)
    expect(summary.byStage.Followup).toBe(1)
    expect(summary.byStage.Onboarded).toBe(1)
    expect(summary.byCategory.Ace).toBe(1)
    expect(summary.byCategory.King).toBe(1)
  })

  it('converts datetime-local values to ISO timestamps', () => {
    expect(fromDateTimeLocal('')).toBeNull()
    expect(fromDateTimeLocal('2026-06-08T14:30')).toBe(
      new Date(2026, 5, 8, 14, 30).toISOString(),
    )
  })
})
