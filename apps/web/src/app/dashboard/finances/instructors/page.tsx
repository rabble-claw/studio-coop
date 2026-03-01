'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useStudioId } from '@/hooks/use-studio-id'
import { financeApi } from '@/lib/api-client'

interface Instructor {
  id: string
  user_id: string
  name: string
  avatar_url: string | null
  comp_type: 'per_class' | 'monthly_salary' | 'hybrid' | 'revenue_share'
  per_class_rate_cents: number
  monthly_salary_cents: number
  revenue_share_percent: number | null
  effective_from: string | null
  effective_to: string | null
}

interface InstructorCost {
  classes_taught: number
  monthly_cost_cents: number
}

const COMP_TYPE_LABELS: Record<string, string> = {
  per_class: 'Per Class',
  monthly_salary: 'Monthly Salary',
  hybrid: 'Hybrid',
  revenue_share: 'Revenue Share',
}

const COMP_TYPE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  per_class: 'default',
  monthly_salary: 'secondary',
  hybrid: 'outline',
  revenue_share: 'outline',
}

const fmt = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

const EMPTY_FORM = {
  comp_type: 'per_class' as Instructor['comp_type'],
  per_class_rate: '',
  monthly_salary: '',
  revenue_share_percent: '',
  effective_from: '',
  effective_to: '',
}

export default function InstructorsPage() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [instructors, setInstructors] = useState<Instructor[]>([])
  const [costs, setCosts] = useState<Record<string, InstructorCost>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Edit dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dialogSaving, setDialogSaving] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId
    async function load() {
      try {
        const result = await financeApi.listInstructors(sid) as unknown as { instructors: Instructor[] }
        const instrList = result.instructors ?? []
        setInstructors(instrList)

        // Load costs for each instructor
        const costEntries: Record<string, InstructorCost> = {}
        try {
          const costResult = await financeApi.instructorCost(sid) as { total_cents: number; by_instructor: Array<{ user_id: string; name: string; classes: number; total_cents: number }> }
          for (const entry of costResult.by_instructor ?? []) {
            const matched = instrList.find(i => i.user_id === entry.user_id)
            if (matched) {
              costEntries[matched.id] = { classes_taught: entry.classes, monthly_cost_cents: entry.total_cents }
            }
          }
        } catch {
          // Cost data may not be available
        }
        setCosts(costEntries)
      } catch {
        setError('Failed to load instructors. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading])

  function openEdit(instructor: Instructor) {
    setEditingId(instructor.id)
    setForm({
      comp_type: instructor.comp_type,
      per_class_rate: instructor.per_class_rate_cents > 0 ? (instructor.per_class_rate_cents / 100).toFixed(2) : '',
      monthly_salary: instructor.monthly_salary_cents > 0 ? (instructor.monthly_salary_cents / 100).toFixed(2) : '',
      revenue_share_percent: instructor.revenue_share_percent !== null ? String(instructor.revenue_share_percent) : '',
      effective_from: instructor.effective_from ?? '',
      effective_to: instructor.effective_to ?? '',
    })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!studioId || !editingId) return
    setDialogSaving(true)
    setActionError(null)
    try {
      const data = {
        comp_type: form.comp_type,
        per_class_rate_cents: Math.round(parseFloat(form.per_class_rate || '0') * 100),
        monthly_salary_cents: Math.round(parseFloat(form.monthly_salary || '0') * 100),
        revenue_share_percent: form.revenue_share_percent ? parseFloat(form.revenue_share_percent) : null,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
      }
      const result = await financeApi.updateInstructor(studioId, editingId, data) as unknown as { instructor: Instructor }
      setInstructors(prev => prev.map(i => i.id === editingId ? result.instructor : i))
      setShowDialog(false)
    } catch (e) {
      setActionError(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDialogSaving(false)
    }
  }

  async function handleDelete(instructorId: string) {
    if (!studioId) return
    try {
      await financeApi.deleteInstructor(studioId, instructorId)
      setInstructors(prev => prev.filter(i => i.id !== instructorId))
    } catch (e) {
      setActionError(`Failed to remove: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  const totalMonthlyCost = Object.values(costs).reduce((sum, c) => sum + (c.monthly_cost_cents ?? 0), 0)

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading instructors...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instructor Compensation</h1>
          <p className="text-muted-foreground">Manage pay rates and track instructor costs</p>
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {/* Monthly summary */}
      {instructors.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">This Month&apos;s Instructor Costs</div>
                <div className="text-2xl font-bold">{formatCents(totalMonthlyCost)}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {instructors.length} {instructors.length === 1 ? 'instructor' : 'instructors'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructor cards */}
      <div className="grid gap-4">
        {instructors.map(instructor => {
          const cost = costs[instructor.id]
          return (
            <Card key={instructor.id}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {instructor.avatar_url ? (
                        <img src={instructor.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                          {instructor.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{instructor.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={COMP_TYPE_VARIANTS[instructor.comp_type] ?? 'default'}>
                          {COMP_TYPE_LABELS[instructor.comp_type] ?? instructor.comp_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {instructor.comp_type === 'per_class' && `${formatCents(instructor.per_class_rate_cents)}/class`}
                          {instructor.comp_type === 'monthly_salary' && `${formatCents(instructor.monthly_salary_cents)}/mo`}
                          {instructor.comp_type === 'hybrid' && `${formatCents(instructor.monthly_salary_cents)}/mo + ${formatCents(instructor.per_class_rate_cents)}/class`}
                          {instructor.comp_type === 'revenue_share' && `${instructor.revenue_share_percent}% revenue`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {cost && (
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">{cost.classes_taught} classes this month</div>
                        <div className="font-medium">{formatCents(cost.monthly_cost_cents)}</div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => openEdit(instructor)}>Edit</Button>
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => setDeleteTarget(instructor.id)}>Remove</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {instructors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No instructor compensation records yet. Run the financial setup wizard or add instructors from the Members page.
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">Edit Compensation</h2>
            <div>
              <label htmlFor="inst-comp-type" className="text-sm font-medium">Compensation Type</label>
              <select
                id="inst-comp-type"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                value={form.comp_type}
                onChange={e => setForm({ ...form, comp_type: e.target.value as Instructor['comp_type'] })}
              >
                <option value="per_class">Per Class</option>
                <option value="monthly_salary">Monthly Salary</option>
                <option value="hybrid">Hybrid (Salary + Per Class)</option>
                <option value="revenue_share">Revenue Share</option>
              </select>
            </div>
            {(form.comp_type === 'per_class' || form.comp_type === 'hybrid') && (
              <div>
                <label htmlFor="inst-per-class" className="text-sm font-medium">Per Class Rate (NZD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="inst-per-class"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.per_class_rate}
                    onChange={e => setForm({ ...form, per_class_rate: e.target.value })}
                    placeholder="50.00"
                  />
                </div>
              </div>
            )}
            {(form.comp_type === 'monthly_salary' || form.comp_type === 'hybrid') && (
              <div>
                <label htmlFor="inst-salary" className="text-sm font-medium">Monthly Salary (NZD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="inst-salary"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.monthly_salary}
                    onChange={e => setForm({ ...form, monthly_salary: e.target.value })}
                    placeholder="2000.00"
                  />
                </div>
              </div>
            )}
            {form.comp_type === 'revenue_share' && (
              <div>
                <label htmlFor="inst-rev-share" className="text-sm font-medium">Revenue Share (%)</label>
                <Input
                  id="inst-rev-share"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={form.revenue_share_percent}
                  onChange={e => setForm({ ...form, revenue_share_percent: e.target.value })}
                  placeholder="30"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inst-eff-from" className="text-sm font-medium">Effective From</label>
                <Input
                  id="inst-eff-from"
                  type="date"
                  value={form.effective_from}
                  onChange={e => setForm({ ...form, effective_from: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="inst-eff-to" className="text-sm font-medium">Effective To</label>
                <Input
                  id="inst-eff-to"
                  type="date"
                  value={form.effective_to}
                  onChange={e => setForm({ ...form, effective_to: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={dialogSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={dialogSaving}>
                {dialogSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Action error toast */}
      {actionError && (
        <div role="alert" className="fixed bottom-4 right-4 z-50 text-sm px-4 py-3 rounded-md bg-red-50 text-red-700 shadow-lg">
          {actionError}
          <button onClick={() => setActionError(null)} className="ml-2 font-bold">x</button>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Remove instructor"
        description="Are you sure you want to remove this instructor's compensation record? This will not remove them from the studio."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { if (deleteTarget) return handleDelete(deleteTarget) }}
      />
    </div>
  )
}
