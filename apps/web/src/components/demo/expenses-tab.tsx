'use client'

import { useState } from 'react'
import { getDemoExpenses } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface DemoExpense {
  id: string
  description: string
  amount_cents: number
  date: string
  recurring: boolean
  recurring_interval: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null
  vendor: string | null
  category: { id: string; name: string; color: string }
  notes: string | null
}

const CATEGORIES = [
  { id: 'cat-1', name: 'Rent', color: '#ef4444' },
  { id: 'cat-2', name: 'Insurance', color: '#f97316' },
  { id: 'cat-3', name: 'Utilities', color: '#eab308' },
  { id: 'cat-4', name: 'Equipment', color: '#22c55e' },
  { id: 'cat-5', name: 'Cleaning', color: '#06b6d4' },
  { id: 'cat-6', name: 'Music & Software', color: '#8b5cf6' },
  { id: 'cat-7', name: 'Marketing', color: '#ec4899' },
  { id: 'cat-8', name: 'Accounting & Legal', color: '#64748b' },
  { id: 'cat-9', name: 'Other', color: '#94a3b8' },
]

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

const fmt = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

function monthlyEquivalent(expense: DemoExpense): number {
  if (!expense.recurring) return 0
  switch (expense.recurring_interval) {
    case 'weekly': return expense.amount_cents * 4.33
    case 'fortnightly': return expense.amount_cents * 2.17
    case 'quarterly': return expense.amount_cents / 3
    case 'yearly': return expense.amount_cents / 12
    default: return expense.amount_cents
  }
}

const EMPTY_FORM = {
  description: '',
  amount: '',
  categoryId: 'cat-1',
  recurring: true,
  recurring_interval: 'monthly' as string,
  vendor: '',
  notes: '',
  date: new Date().toISOString().split('T')[0]!,
}

export function DemoExpensesTab() {
  const [expenses, setExpenses] = useState<DemoExpense[]>(() => getDemoExpenses() as DemoExpense[])
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowDialog(true)
  }

  function openEdit(expense: DemoExpense) {
    setEditingId(expense.id)
    setForm({
      description: expense.description,
      amount: (expense.amount_cents / 100).toFixed(2),
      categoryId: expense.category.id,
      recurring: expense.recurring,
      recurring_interval: expense.recurring_interval ?? 'monthly',
      vendor: expense.vendor ?? '',
      notes: expense.notes ?? '',
      date: expense.date,
    })
    setShowDialog(true)
  }

  function handleSave() {
    if (!form.description.trim() || !form.amount) return
    const category = CATEGORIES.find(c => c.id === form.categoryId) ?? CATEGORIES[0]!

    if (editingId) {
      setExpenses(prev => prev.map(e => e.id === editingId ? {
        ...e,
        description: form.description.trim(),
        amount_cents: Math.round(parseFloat(form.amount) * 100),
        category,
        recurring: form.recurring,
        recurring_interval: form.recurring ? form.recurring_interval as DemoExpense['recurring_interval'] : null,
        vendor: form.vendor.trim() || null,
        notes: form.notes.trim() || null,
        date: form.date,
      } : e))
    } else {
      const newExpense: DemoExpense = {
        id: `exp-demo-${Date.now()}`,
        description: form.description.trim(),
        amount_cents: Math.round(parseFloat(form.amount) * 100),
        date: form.date,
        recurring: form.recurring,
        recurring_interval: form.recurring ? form.recurring_interval as DemoExpense['recurring_interval'] : null,
        vendor: form.vendor.trim() || null,
        category,
        notes: form.notes.trim() || null,
      }
      setExpenses(prev => [...prev, newExpense])
    }
    setShowDialog(false)
  }

  function handleDelete(id: string) {
    setExpenses(prev => prev.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  // Group by category
  const grouped = new Map<string, DemoExpense[]>()
  for (const exp of expenses) {
    const list = grouped.get(exp.category.id) ?? []
    list.push(exp)
    grouped.set(exp.category.id, list)
  }

  const monthlyTotal = expenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0)
  const oneTimeTotal = expenses.filter(e => !e.recurring).reduce((sum, e) => sum + e.amount_cents, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Track and manage your studio operating costs</p>
        <Button onClick={openCreate}>+ New Expense</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground">Monthly Recurring</div>
            <div className="text-2xl font-bold">{formatCents(monthlyTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground">One-time Costs</div>
            <div className="text-2xl font-bold">{formatCents(oneTimeTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-muted-foreground">Total Expenses</div>
            <div className="text-2xl font-bold">{expenses.length} items</div>
          </CardContent>
        </Card>
      </div>

      {/* Grouped expenses */}
      {Array.from(grouped.entries()).map(([catId, catExpenses]) => {
        const cat = catExpenses[0]!.category
        const subtotal = catExpenses.reduce((sum, e) => sum + monthlyEquivalent(e), 0)
        return (
          <Card key={catId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </CardTitle>
                <span className="text-sm font-medium text-muted-foreground">{formatCents(subtotal)}/mo</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {catExpenses.map(expense => (
                  <div key={expense.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{expense.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCents(expense.amount_cents)}
                        {expense.recurring && expense.recurring_interval ? `/${expense.recurring_interval === 'monthly' ? 'mo' : expense.recurring_interval === 'weekly' ? 'wk' : expense.recurring_interval === 'yearly' ? 'yr' : expense.recurring_interval}` : ' (one-time)'}
                        {expense.vendor && ` · ${expense.vendor}`}
                        {expense.notes && ` · ${expense.notes}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {!expense.recurring && <Badge variant="secondary">One-time</Badge>}
                      <Button variant="outline" size="sm" onClick={() => openEdit(expense)}>Edit</Button>
                      {confirmDelete === expense.id ? (
                        <div className="flex items-center gap-1">
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(expense.id)}>Yes</Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>No</Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(expense.id)}>Delete</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {expenses.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No expenses yet. Add your first expense to start tracking costs.
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDialog(false)}>
          <div className="bg-card border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Expense' : 'Add Expense'}</h2>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Studio rent, Electricity bill"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Amount (NZD)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
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
                <label className="text-sm font-medium">Category</label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                  value={form.categoryId}
                  onChange={e => setForm({ ...form, categoryId: e.target.value })}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={e => setForm({ ...form, recurring: e.target.checked })}
                  className="rounded"
                />
                Recurring expense
              </label>
            </div>

            {form.recurring && (
              <div>
                <label className="text-sm font-medium">Frequency</label>
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[44px]"
                  value={form.recurring_interval}
                  onChange={e => setForm({ ...form, recurring_interval: e.target.value })}
                >
                  {RECURRENCE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Vendor (optional)</label>
              <Input
                value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g. Meridian Energy"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <textarea
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm min-h-[60px] resize-none"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!form.description.trim() || !form.amount}
              >
                {editingId ? 'Save Changes' : 'Add Expense'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
