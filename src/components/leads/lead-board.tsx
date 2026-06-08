'use client'

import { useMemo, useState } from 'react'
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CalendarClock, Mail, Phone } from 'lucide-react'
import type { Contact, LeadStage } from '@/types'
import {
  LEAD_CATEGORY_COLORS,
  LEAD_STAGE_COLORS,
  LEAD_STAGES,
} from '@/lib/leads'

interface LeadBoardProps {
  leads: Contact[]
  onLeadMoved: (leadId: string, stage: LeadStage) => void
  onLeadOpen: (leadId: string) => void
}

export function LeadBoard({
  leads,
  onLeadMoved,
  onLeadOpen,
}: LeadBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const leadsByStage = useMemo(() => {
    const map = new Map<LeadStage, Contact[]>(
      LEAD_STAGES.map((stage) => [stage, []]),
    )
    for (const lead of leads) map.get(lead.stage)?.push(lead)
    return map
  }, [leads])

  const activeLead = activeId
    ? leads.find((lead) => lead.id === activeId) ?? null
    : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    if (!event.over) return

    const leadId = String(event.active.id)
    const stage = String(event.over.id) as LeadStage
    const lead = leads.find((item) => item.id === leadId)
    if (!lead || !LEAD_STAGES.includes(stage) || lead.stage === stage) return
    onLeadMoved(leadId, stage)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 lg:snap-none">
        {LEAD_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            leads={leadsByStage.get(stage) ?? []}
            onLeadOpen={onLeadOpen}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? (
          <div className="w-[280px] opacity-90">
            <LeadCard lead={activeLead} onOpen={() => {}} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function StageColumn({
  stage,
  leads,
  onLeadOpen,
}: {
  stage: LeadStage
  leads: Contact[]
  onLeadOpen: (leadId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <section className="flex w-[85vw] min-w-[260px] max-w-[320px] shrink-0 snap-start flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:w-auto lg:max-w-none lg:flex-1 lg:basis-[260px] lg:shrink lg:snap-none">
      <div
        className="-mx-4 -mt-4 h-[3px] rounded-t-xl"
        style={{ backgroundColor: LEAD_STAGE_COLORS[stage] }}
      />
      <header className="flex items-center justify-between pt-3">
        <h2 className="truncate text-sm font-semibold text-white">{stage}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          {leads.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={`mt-3 flex min-h-40 flex-1 flex-col gap-2 rounded-lg transition-all ${
          isOver
            ? 'bg-primary/5 outline outline-2 outline-dashed outline-primary outline-offset-2'
            : ''
        }`}
      >
        {leads.length === 0 ? (
          <div className="flex min-h-40 flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-700 px-4 text-center text-xs text-slate-500">
            Drop a lead here
          </div>
        ) : (
          leads.map((lead) => (
            <DraggableLeadCard
              key={lead.id}
              lead={lead}
              onOpen={() => onLeadOpen(lead.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function DraggableLeadCard({
  lead,
  onOpen,
}: {
  lead: Contact
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.3 : 1, touchAction: 'none' }}
    >
      <LeadCard lead={lead} onOpen={onOpen} />
    </div>
  )
}

function LeadCard({
  lead,
  onOpen,
  overlay = false,
}: {
  lead: Contact
  onOpen: () => void
  overlay?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      tabIndex={overlay ? -1 : 0}
      className="w-full cursor-grab rounded-lg border border-slate-700 bg-slate-900 p-3 text-left shadow-sm transition-colors hover:border-slate-600 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-white">
          {lead.name || 'Unnamed'}
        </p>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            color: LEAD_CATEGORY_COLORS[lead.category],
            backgroundColor: `${LEAD_CATEGORY_COLORS[lead.category]}20`,
          }}
        >
          {lead.category}
        </span>
      </div>
      <div className="mt-2 space-y-1 text-xs text-slate-400">
        <p className="flex items-center gap-1.5">
          <Phone className="size-3" />
          <span className="truncate">{lead.phone}</span>
        </p>
        {lead.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="size-3" />
            <span className="truncate">{lead.email}</span>
          </p>
        )}
        {lead.next_followup && (
          <p className="flex items-center gap-1.5 text-amber-300">
            <CalendarClock className="size-3" />
            <span className="truncate">
              {new Date(lead.next_followup).toLocaleString()}
            </span>
          </p>
        )}
        {(lead.campaign || lead.platform || lead.ad_name) && (
          <p className="truncate border-t border-slate-800 pt-2 text-[11px] text-slate-500">
            {[lead.platform, lead.campaign, lead.ad_name].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
    </button>
  )
}
