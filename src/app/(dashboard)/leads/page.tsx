'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpDown,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Upload,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { Contact, LeadCategory, LeadStage } from '@/types'
import {
  filterLeads,
  LEAD_CATEGORIES,
  LEAD_CATEGORY_COLORS,
  LEAD_STAGES,
  LEAD_STAGE_COLORS,
  normalizeLeadStageCategory,
} from '@/lib/leads'
import { LeadBoard } from '@/components/leads/lead-board'
import { ContactDetailView } from '@/components/contacts/contact-detail-view'
import { ImportModal } from '@/components/contacts/import-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<
    LeadCategory | 'all'
  >('all')
  const [campaignFilter, setCampaignFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [sortKey, setSortKey] = useState<
    'name' | 'category' | 'stage' | 'campaign' | 'platform' | 'next_followup'
  >('name')
  const [sortAscending, setSortAscending] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) toast.error('Failed to load leads')
    else {
      setLeads(
        ((data ?? []) as Contact[]).map((lead) =>
          normalizeLeadStageCategory(lead),
        ),
      )
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // The state changes happen after the Supabase promise resolves, not
    // synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLeads()
  }, [loadLeads])

  const campaigns = useMemo(
    () =>
      [...new Set(leads.map((lead) => lead.campaign).filter(Boolean))].sort() as string[],
    [leads],
  )
  const platforms = useMemo(
    () =>
      [...new Set(leads.map((lead) => lead.platform).filter(Boolean))].sort() as string[],
    [leads],
  )
  const filteredLeads = useMemo(() => {
    const filtered = filterLeads(leads, search, stageFilter, categoryFilter)
      .filter((lead) => campaignFilter === 'all' || lead.campaign === campaignFilter)
      .filter((lead) => platformFilter === 'all' || lead.platform === platformFilter)

    return filtered.sort((a, b) => {
      const left = String(a[sortKey] ?? '').toLowerCase()
      const right = String(b[sortKey] ?? '').toLowerCase()
      return left.localeCompare(right) * (sortAscending ? 1 : -1)
    })
  }, [
    leads,
    search,
    stageFilter,
    categoryFilter,
    campaignFilter,
    platformFilter,
    sortKey,
    sortAscending,
  ])

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAscending((value) => !value)
    else {
      setSortKey(key)
      setSortAscending(true)
    }
  }

  function openLead(id: string) {
    setDetailId(id)
    setDetailOpen(true)
  }

  const moveLead = useCallback(
    async (leadId: string, stage: LeadStage, category: LeadCategory) => {
      const previous = leads
      setLeads((current) =>
        current.map((lead) =>
          lead.id === leadId ? { ...lead, stage, category } : lead,
        ),
      )

      const { error } = await supabase
        .from('contacts')
        .update({ stage, category, updated_at: new Date().toISOString() })
        .eq('id', leadId)

      if (error) {
        setLeads(previous)
        toast.error('Failed to move lead')
      }
    },
    [leads, supabase],
  )

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage all contacts through the lead lifecycle.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setImportOpen(true)}
          className="border-slate-700 text-slate-300"
        >
          <Upload className="size-4" />
          Import Leads
        </Button>
      </header>

      <Tabs defaultValue="board">
        <TabsList className="bg-slate-900">
          <TabsTrigger value="board">
            <LayoutGrid className="size-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list">
            <List className="size-4" />
            List
          </TabsTrigger>
        </TabsList>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, or phone..."
              className="border-slate-700 bg-slate-900 pl-8 text-white placeholder:text-slate-500"
            />
          </div>
          <Select
            value={stageFilter}
            onValueChange={(value) =>
              setStageFilter(value as LeadStage | 'all')
            }
          >
            <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-white sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              <SelectItem value="all">All stages</SelectItem>
              {LEAD_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={campaignFilter}
            onValueChange={(value) => setCampaignFilter(value ?? 'all')}
          >
            <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-white sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign} value={campaign}>
                  {campaign}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={platformFilter}
            onValueChange={(value) => setPlatformFilter(value ?? 'all')}
          >
            <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-white sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              <SelectItem value="all">All platforms</SelectItem>
              {platforms.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={categoryFilter}
            onValueChange={(value) =>
              setCategoryFilter(value as LeadCategory | 'all')
            }
          >
            <SelectTrigger className="w-full border-slate-700 bg-slate-900 text-white sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-slate-900">
              <SelectItem value="all">All categories</SelectItem>
              {LEAD_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="board">
          {loading ? (
            <LoadingState />
          ) : (
            <LeadBoard
              leads={filteredLeads}
              onLeadMoved={moveLead}
              onLeadOpen={openLead}
            />
          )}
        </TabsContent>

        <TabsContent value="list">
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <SortableHead label="Name" onClick={() => toggleSort('name')} />
                  <SortableHead label="Quality" onClick={() => toggleSort('category')} />
                  <SortableHead label="Stage" onClick={() => toggleSort('stage')} />
                  <SortableHead
                    label="Campaign"
                    onClick={() => toggleSort('campaign')}
                    className="hidden md:table-cell"
                  />
                  <SortableHead
                    label="Platform"
                    onClick={() => toggleSort('platform')}
                    className="hidden lg:table-cell"
                  />
                  <TableHead className="hidden text-slate-400 xl:table-cell">Ad</TableHead>
                  <TableHead className="hidden text-slate-400 xl:table-cell">Email</TableHead>
                  <TableHead className="text-slate-400">Phone</TableHead>
                  <SortableHead
                    label="Next Follow-up"
                    onClick={() => toggleSort('next_followup')}
                    className="hidden lg:table-cell"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={9}>
                      <LoadingState />
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={9} className="py-12 text-center">
                      <Users className="mx-auto size-8 text-slate-600" />
                      <p className="mt-2 text-sm text-slate-500">
                        No leads match these filters.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      onClick={() => openLead(lead.id)}
                      className="cursor-pointer border-slate-800 hover:bg-slate-900/50"
                    >
                      <TableCell className="font-medium text-white">
                        {lead.name || 'Unnamed'}
                      </TableCell>
                      <TableCell>
                        <LeadPill
                          label={lead.category}
                          color={LEAD_CATEGORY_COLORS[lead.category]}
                        />
                      </TableCell>
                      <TableCell>
                        <LeadPill
                          label={lead.stage}
                          color={LEAD_STAGE_COLORS[lead.stage]}
                        />
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-400 md:table-cell">
                        {lead.campaign || '-'}
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-400 lg:table-cell">
                        {lead.platform || '-'}
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-400 xl:table-cell">
                        {lead.ad_name || '-'}
                      </TableCell>
                      <TableCell className="hidden text-sm text-slate-400 xl:table-cell">
                        {lead.email || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-300">
                        {lead.phone}
                      </TableCell>
                      <TableCell className="hidden text-xs text-slate-400 lg:table-cell">
                        {lead.next_followup
                          ? new Date(lead.next_followup).toLocaleString()
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailId}
        onUpdated={loadLeads}
      />
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={loadLeads}
      />
    </div>
  )
}

function SortableHead({
  label,
  onClick,
  className = '',
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <TableHead className={`text-slate-400 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 hover:text-white"
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
  )
}

function LeadPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ color, backgroundColor: `${color}20` }}
    >
      {label}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin text-primary" />
      Loading leads...
    </div>
  )
}
