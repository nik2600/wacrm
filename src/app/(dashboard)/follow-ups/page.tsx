'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/types'
import { groupFollowups, LEAD_CATEGORY_COLORS } from '@/lib/leads'
import { ContactDetailView } from '@/components/contacts/contact-detail-view'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function FollowupsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadFollowups = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .not('next_followup', 'is', null)
      .order('next_followup', { ascending: true })

    if (error) toast.error('Failed to load follow-ups')
    else setContacts((data ?? []) as Contact[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // The state changes happen after the Supabase promise resolves, not
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFollowups()
  }, [loadFollowups])

  const groups = useMemo(() => groupFollowups(contacts), [contacts])

  function openContact(id: string) {
    setDetailId(id)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Follow-ups</h1>
        <p className="mt-1 text-sm text-slate-400">
          Scheduled lead activity grouped by urgency.
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="size-5 animate-spin text-primary" />
          Loading follow-ups...
        </div>
      ) : (
        <>
          <FollowupSection
            title="Overdue"
            description="Scheduled before the current time"
            contacts={groups.overdue}
            tone="red"
            onOpen={openContact}
          />
          <FollowupSection
            title="Due Today"
            description="Remaining follow-ups for today"
            contacts={groups.dueToday}
            tone="amber"
            onOpen={openContact}
          />
          <FollowupSection
            title="Upcoming"
            description="Scheduled after today"
            contacts={groups.upcoming}
            tone="slate"
            onOpen={openContact}
          />
        </>
      )}

      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailId}
        onUpdated={loadFollowups}
      />
    </div>
  )
}

function FollowupSection({
  title,
  description,
  contacts,
  tone,
  onOpen,
}: {
  title: string
  description: string
  contacts: Contact[]
  tone: 'red' | 'amber' | 'slate'
  onOpen: (id: string) => void
}) {
  const toneClass = {
    red: 'text-red-400',
    amber: 'text-amber-300',
    slate: 'text-slate-300',
  }[tone]

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className={`text-sm font-semibold ${toneClass}`}>{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
          {contacts.length}
        </span>
      </header>
      {contacts.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-slate-500">
          <CalendarCheck className="size-7" />
          <p className="mt-2 text-sm">No follow-ups in this section.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Lead</TableHead>
              <TableHead className="text-slate-400">Category</TableHead>
              <TableHead className="hidden text-slate-400 sm:table-cell">
                Stage
              </TableHead>
              <TableHead className="text-slate-400">Scheduled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow
                key={contact.id}
                onClick={() => onOpen(contact.id)}
                className="cursor-pointer border-slate-800 hover:bg-slate-900/70"
              >
                <TableCell>
                  <p className="font-medium text-white">
                    {contact.name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-slate-500">{contact.phone}</p>
                </TableCell>
                <TableCell>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      color: LEAD_CATEGORY_COLORS[contact.category],
                      backgroundColor: `${LEAD_CATEGORY_COLORS[contact.category]}20`,
                    }}
                  >
                    {contact.category}
                  </span>
                </TableCell>
                <TableCell className="hidden text-sm text-slate-300 sm:table-cell">
                  {contact.stage}
                </TableCell>
                <TableCell className={`text-xs ${toneClass}`}>
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {new Date(contact.next_followup!).toLocaleString()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
