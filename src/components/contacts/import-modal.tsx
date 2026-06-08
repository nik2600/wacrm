'use client'

import { useRef, useState } from 'react'
import { FileText, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { parseLeadCsv, type LeadImportRow } from '@/lib/lead-import'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type ImportResult = {
  created: number
  updated: number
  failed: number
  total: number
  errors?: {
    row: number
    phone: string
    message: string
  }[]
}

export function ImportModal({
  open,
  onOpenChange,
  onImported,
}: ImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<LeadImportRow[]>([])
  const [publishedUrl, setPublishedUrl] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetRange, setSheetRange] = useState('Sheet1')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setFile(null)
    setRows([])
    setPublishedUrl('')
    setSpreadsheetId('')
    setSheetRange('Sheet1')
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset()
    onOpenChange(nextOpen)
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]
    if (!selected) return
    const parsed = parseLeadCsv(await selected.text())
    setFile(selected)
    setRows(parsed)
    setResult(null)
    if (!parsed.length) {
      toast.error('No valid rows found. A phone column is required.')
    }
  }

  async function runImport(body: Record<string, unknown>) {
    setImporting(true)
    setResult(null)
    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as ImportResult & { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Import failed')
      setResult(payload)
      onImported()
      toast.success(
        `${payload.created} created, ${payload.updated} updated`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const preview = rows.slice(0, 5)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-700 bg-slate-900 text-slate-200 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Import Leads</DialogTitle>
          <DialogDescription className="text-slate-400">
            Required column: phone. Supported attribution columns include
            campaign, platform, ad, and source.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="upload">CSV Upload</TabsTrigger>
            <TabsTrigger value="published">Published CSV</TabsTrigger>
            <TabsTrigger value="private">Private Sheet</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-700 p-6 transition-colors hover:border-primary/50"
            >
              {file ? (
                <>
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm text-slate-300">{file.name}</span>
                  <span className="text-xs text-slate-500">
                    {rows.length} valid rows
                  </span>
                </>
              ) : (
                <>
                  <Upload className="size-8 text-slate-500" />
                  <span className="text-sm text-slate-400">
                    Choose a CSV file
                  </span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {preview.length > 0 && <ImportPreview rows={preview} />}
            <Button
              disabled={!rows.length || importing}
              onClick={() => runImport({ mode: 'rows', rows })}
              className="bg-primary text-primary-foreground"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import {rows.length || ''} Leads
            </Button>
          </TabsContent>

          <TabsContent value="published" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="published-url">Published Google Sheets CSV URL</Label>
              <Input
                id="published-url"
                value={publishedUrl}
                onChange={(event) => setPublishedUrl(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="border-slate-700 bg-slate-800 text-white"
              />
              <p className="text-xs text-slate-500">
                In Google Sheets, use File → Share → Publish to web and choose CSV.
              </p>
            </div>
            <Button
              disabled={!publishedUrl.trim() || importing}
              onClick={() =>
                runImport({ mode: 'published_csv', url: publishedUrl.trim() })
              }
              className="bg-primary text-primary-foreground"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import Published Sheet
            </Button>
          </TabsContent>

          <TabsContent value="private" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="spreadsheet-id">Spreadsheet ID</Label>
              <Input
                id="spreadsheet-id"
                value={spreadsheetId}
                onChange={(event) => setSpreadsheetId(event.target.value)}
                placeholder="Value between /d/ and /edit in the sheet URL"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-range">Sheet or range</Label>
              <Input
                id="sheet-range"
                value={sheetRange}
                onChange={(event) => setSheetRange(event.target.value)}
                placeholder="Sheet1!A:Z"
                className="border-slate-700 bg-slate-800 text-white"
              />
            </div>
            <p className="text-xs text-slate-500">
              Share the sheet with the configured Google service-account email.
            </p>
            <Button
              disabled={!spreadsheetId.trim() || !sheetRange.trim() || importing}
              onClick={() =>
                runImport({
                  mode: 'private_sheet',
                  spreadsheetId: spreadsheetId.trim(),
                  range: sheetRange.trim(),
                })
              }
              className="bg-primary text-primary-foreground"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              Import Private Sheet
            </Button>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm">
            <span className="text-primary">{result.created} created</span>
            <span className="mx-2 text-slate-600">•</span>
            <span className="text-blue-300">{result.updated} updated</span>
            {result.failed > 0 && (
              <>
                <span className="mx-2 text-slate-600">•</span>
                <span className="text-red-400">{result.failed} failed</span>
              </>
            )}
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-red-300">
                {result.errors.map((error) => (
                  <li key={`${error.row}-${error.phone}`}>
                    Row {error.row} ({error.phone}): {error.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="border-slate-700 bg-slate-900">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportPreview({ rows }: { rows: LeadImportRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700">
      <table className="w-full text-xs">
        <thead className="bg-slate-800 text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left">Phone</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Campaign</th>
            <th className="px-3 py-2 text-left">Platform</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.phone}-${index}`} className="border-t border-slate-700">
              <td className="px-3 py-2 text-slate-300">{row.phone}</td>
              <td className="px-3 py-2 text-slate-300">{row.name || '-'}</td>
              <td className="px-3 py-2 text-slate-300">{row.campaign || '-'}</td>
              <td className="px-3 py-2 text-slate-300">{row.platform || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
