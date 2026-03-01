'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useStudioId } from '@/hooks/use-studio-id'
import { financeApi } from '@/lib/api-client'

interface Expense {
  id: string
  category: string
  name: string
  amount_cents: number
  recurrence: 'monthly' | 'weekly' | 'yearly' | 'one_time'
  start_date: string | null
  end_date: string | null
  notes: string | null
  active: boolean
}

interface Category {
  id: string
  name: string
  icon: string
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'rent', name: 'Rent / Lease', icon: '🏠' },
  { id: 'utilities', name: 'Utilities', icon: '💡' },
  { id: 'insurance', name: 'Insurance', icon: '🛡️' },
  { id: 'equipment', name: 'Equipment & Maintenance', icon: '🔧' },
  { id: 'marketing', name: 'Marketing & Ads', icon: '📣' },
  { id: 'software', name: 'Software & Subscriptions', icon: '💻' },
  { id: 'cleaning', name: 'Cleaning & Supplies', icon: '🧹' },
  { id: 'accounting', name: 'Accounting & Legal', icon: '📊' },
  { id: 'music', name: 'Music Licensing', icon: '🎵' },
  { id: 'other', name: 'Other', icon: '📦' },
]

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one_time', label: 'One-time' },
]

const fmt = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

function monthlyEquivalent(expense: Expense): number {
  switch (expense.recurrence) {
    case 'weekly': return expense.amount_cents * 4.33
    case 'yearly': return expense.amount_cents / 12
    case 'one_time': return 0
    default: return expense.amount_cents
  }
}

const EMPTY_FORM = {
  category: 'rent',
  name: '',
  amount: '',
  recurrence: 'monthly' as Expense['recurrence'],
  start_date: '',
  end_date: '',
  notes: '',
}

export default function ExpensesPage() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showEnded, setShowEnded] = useState(false)

  // Dialog state
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
        const [expResult, catResult] = await Promise.allSettled([
          financeApi.listExpenses(sid) as unknown as Promise<{ expenses: Expense[] }>,
          financeApi.listCategories(sid) as unknown as Promise<{ categories: Category[] }>,
        ])
        if (expResult.status === 'fulfilled') {
          setExpenses(expResult.value.expenses ?? [])
        } else {
          setError('Failed to load expenses.')
        }
        if (catResult.status === 'fulfilled' && catResult.value.categories?.length) {
          setCategories(catResult.value.categories)
        }
      } catch {
        setError('Failed to load expenses. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading])

  function getCategoryInfo(catId: string): Category {
    return categories.find(c => c.id === catId) ?? { id: catId, name: catId, icon: '📦' }
  }

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowDialog(true)
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id)
    setForm({
      category: expense.category,
      name: expense.name,
      amount: (expense.amount_cents / 100).toFixed(2),
      recurrence: expense.recurrence,
      start_date: expense.start_date ?? '',
      end_date: expense.end_date ?? '',
      notes: expense.notes ?? '',
    })
    setShowDialog(true)
  }

  async function handleSave() {
    if (!studioId) return
    setDialogSaving(true)
    setActionError(null)
    try {
      const data = {
        category: form.category,
        name: form.name,
        amount_cents: Math.round(parseFloat(form.amount || '0') * 100),
        recurrence: form.recurrence,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      }

      if (editingId) {
        const result = await financeApi.updateExpense(studioId, editingId, data) as unknown as { expense: Expense }
        setExpenses(prev => prev.map(e => e.id === editingId ? result.expense : e))
      } else {
        const result = await financeApi.createExpense(studioId, data) as unknown as { expense: Expense }
        setExpenses(prev => [...prev, result.expense])
      }
      setShowDialog(false)
    } catch (e) {
      setActionError(`Failed to save: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDialogSaving(false)
    }
  }

  async function handleDelete(expenseId: string) {
    if (!studioId) return
    try {
      await financeApi.deleteExpense(studioId, expenseId)
      setExpenses(prev => prev.filter(e => e.id !== expenseId))
    } catch (e) {
      setActionError(`Failed to delete: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }

  // Filter and group
  const visibleExpenses = showEnded ? expenses : expenses.filter(e => e.active !== false)
  const grouped = new Map<string, Expense[]>()
  for (const exp of visibleExpenses) {
    const list = grouped.get(exp.category) ?? []
    list.push(exp)
    grouped.set(exp.category, list)
  }

  const monthlyTotal = visibleExpenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0)

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading expenses...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Track and manage your studio operating costs</p>
        </div>
        <Button onClick={openCreate}>+ New Expense</Button>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {/* Monthly total banner */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Estimated Monthly Total</div>
              <div className="text-2xl font-bold">{formatCents(monthlyTotal)}</div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showEnded}
                onChange={e => setShowEnded(e.target.checked)}
                className="rounded"
              />
              Show ended expenses
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Grouped expenses */}
      {Array.from(grouped.entries()).map(([catId, catExpenses]) => {
        const cat = getCategoryInfo(catId)
        const subtotal = catExpenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0)
        return (
          <Card key={catId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span>{cat.icon}</span> {cat.name}
                </CardTitle>
                <span className="text-sm font-medium text-muted-foreground">{formatCents(subtotal)}/mo</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {catExpenses.map(expense => (
                  <div key={expense.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{expense.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCents(expense.amount_cents)}
                        {expense.recurrence !== 'one_time' && `/${expense.recurrence === 'monthly' ? 'mo' : expense.recurrence === 'weekly' ? 'wk' : 'yr'}`}
                        {expense.recurrence === 'one_time' && ' (one-time)'}
                        {expense.notes && ` · ${expense.notes}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {expense.end_date && new Date(expense.end_date) < new Date() && (
                        <Badge variant="secondary">Ended</Badge>
                      )}
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => openEdit(expense)}>Edit</Button>
                      <Button variant="outline" size="sm" className="min-h-[44px] touch-manipulation" onClick={() => setDeleteTarget(expense.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {grouped.size === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No expenses yet. Add your first expense to start tracking costs.
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'Add Expense'}</h2>
            <div>
              <label htmlFor="expense-category" className="text-sm font-medium">Category</label>
              <select
                id="expense-category"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-name" className="text-sm font-medium">Name</label>
              <Input
                id="expense-name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Studio rent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="expense-amount" className="text-sm font-medium">Amount (NZD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="expense-recurrence" className="text-sm font-medium">Recurrence</label>
                <select
                  id="expense-recurrence"
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                  value={form.recurrence}
                  onChange={e => setForm({ ...form, recurrence: e.target.value as Expense['recurrence'] })}
                >
                  {RECURRENCE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="expense-start" className="text-sm font-medium">Start Date</label>
                <Input
                  id="expense-start"
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="expense-end" className="text-sm font-medium">End Date</label>
                <Input
                  id="expense-end"
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label htmlFor="expense-notes" className="text-sm font-medium">Notes</label>
              <textarea
                id="expense-notes"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px]"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} disabled={dialogSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name || !form.amount || dialogSaving}>
                {dialogSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Expense'}
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
        title="Delete expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteTarget) return handleDelete(deleteTarget) }}
      />
    </div>
  )
}
