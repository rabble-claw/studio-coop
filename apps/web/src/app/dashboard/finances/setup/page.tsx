'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStudioId } from '@/hooks/use-studio-id'
import { financeApi, memberApi } from '@/lib/api-client'

interface Category {
  id: string
  name: string
  icon: string
  default_amount_cents: number
}

interface Teacher {
  id: string
  user_id: string
  display_name: string
  avatar_url: string | null
}

interface InstructorSetup {
  user_id: string
  name: string
  comp_type: 'per_class' | 'monthly_salary' | 'hybrid'
  per_class_rate_cents: number
  monthly_salary_cents: number
}

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'rent', name: 'Rent / Lease', icon: '🏠', default_amount_cents: 350000 },
  { id: 'instructor_pay', name: 'Instructor Pay', icon: '👩‍🏫', default_amount_cents: 0 },
  { id: 'utilities', name: 'Utilities', icon: '💡', default_amount_cents: 80000 },
  { id: 'insurance', name: 'Insurance', icon: '🛡️', default_amount_cents: 35000 },
  { id: 'equipment', name: 'Equipment & Maintenance', icon: '🔧', default_amount_cents: 40000 },
  { id: 'marketing', name: 'Marketing & Ads', icon: '📣', default_amount_cents: 30000 },
  { id: 'software', name: 'Software & Subscriptions', icon: '💻', default_amount_cents: 20000 },
  { id: 'cleaning', name: 'Cleaning & Supplies', icon: '🧹', default_amount_cents: 15000 },
  { id: 'accounting', name: 'Accounting & Legal', icon: '📊', default_amount_cents: 25000 },
  { id: 'music', name: 'Music Licensing', icon: '🎵', default_amount_cents: 5000 },
  { id: 'other', name: 'Other', icon: '📦', default_amount_cents: 0 },
]

const DEFAULT_SELECTED = ['rent', 'instructor_pay', 'utilities', 'insurance']

const fmt = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })

function formatCents(cents: number): string {
  return fmt.format(cents / 100)
}

export default function FinanceSetupPage() {
  const router = useRouter()
  const { studioId, loading: studioLoading } = useStudioId()
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 0: category selection
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(DEFAULT_SELECTED))

  // Step 1: amounts per category
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  // Step 2: instructor setup
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [instructorSetups, setInstructorSetups] = useState<InstructorSetup[]>([])
  const [teachersLoading, setTeachersLoading] = useState(false)

  // Load categories from API on mount
  useEffect(() => {
    if (studioLoading || !studioId) return
    async function loadCategories() {
      try {
        const result = await financeApi.listCategories(studioId!) as unknown as { categories: Category[] }
        if (result.categories?.length) {
          setCategories(result.categories)
        }
      } catch {
        // Use fallback categories
      }
    }
    loadCategories()
  }, [studioId, studioLoading])

  // Initialize amounts when moving to step 1
  useEffect(() => {
    if (currentStep === 1) {
      const initial: Record<string, string> = {}
      categories.forEach(cat => {
        if (selectedCategories.has(cat.id)) {
          initial[cat.id] = amounts[cat.id] ?? (cat.default_amount_cents > 0 ? (cat.default_amount_cents / 100).toFixed(2) : '')
        }
      })
      setAmounts(prev => ({ ...prev, ...initial }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // Load teachers when moving to step 2
  useEffect(() => {
    if (currentStep === 2 && studioId && teachers.length === 0) {
      setTeachersLoading(true)
      async function loadTeachers() {
        try {
          const result = await memberApi.list(studioId!, 'role=teacher') as { members: Array<{ user_id: string; display_name: string; avatar_url: string | null; id: string }> }
          const teacherList = result.members ?? []
          setTeachers(teacherList.map(t => ({ id: t.id, user_id: t.user_id, display_name: t.display_name, avatar_url: t.avatar_url })))
          setInstructorSetups(teacherList.map(t => ({
            user_id: t.user_id,
            name: t.display_name,
            comp_type: 'per_class',
            per_class_rate_cents: 5000,
            monthly_salary_cents: 0,
          })))
        } catch {
          // Teachers may not be available yet
        } finally {
          setTeachersLoading(false)
        }
      }
      loadTeachers()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, studioId])

  function toggleCategory(id: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateInstructor(userId: string, field: keyof InstructorSetup, value: string) {
    setInstructorSetups(prev => prev.map(i => {
      if (i.user_id !== userId) return i
      if (field === 'comp_type') return { ...i, comp_type: value as InstructorSetup['comp_type'] }
      if (field === 'per_class_rate_cents') return { ...i, per_class_rate_cents: Math.round(parseFloat(value || '0') * 100) }
      if (field === 'monthly_salary_cents') return { ...i, monthly_salary_cents: Math.round(parseFloat(value || '0') * 100) }
      return i
    }))
  }

  function computeMonthlyTotal(): number {
    let total = 0
    for (const catId of selectedCategories) {
      const val = amounts[catId]
      if (val) total += parseFloat(val) * 100
    }
    for (const inst of instructorSetups) {
      if (inst.comp_type === 'monthly_salary' || inst.comp_type === 'hybrid') {
        total += inst.monthly_salary_cents
      }
      if (inst.comp_type === 'per_class' || inst.comp_type === 'hybrid') {
        // Estimate 8 classes/month for preview
        total += inst.per_class_rate_cents * 8
      }
    }
    return total
  }

  async function handleSave() {
    if (!studioId) return
    setSaving(true)
    setError(null)
    try {
      const expenses = Array.from(selectedCategories)
        .filter(catId => catId !== 'instructor_pay')
        .map(catId => {
          const cat = categories.find(c => c.id === catId)
          return {
            category: catId,
            name: cat?.name ?? catId,
            amount_cents: Math.round(parseFloat(amounts[catId] || '0') * 100),
            recurrence: 'monthly' as const,
          }
        })
        .filter(e => e.amount_cents > 0)

      const instructors = instructorSetups.map(i => ({
        user_id: i.user_id,
        comp_type: i.comp_type,
        per_class_rate_cents: i.per_class_rate_cents,
        monthly_salary_cents: i.monthly_salary_cents,
      }))

      await financeApi.setup(studioId, { expenses, instructors })
      router.push('/dashboard/finances')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (studioLoading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading...</div>

  const STEPS = ['Costs', 'Amounts', 'Instructors', 'Review']

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === i ? 'bg-primary text-primary-foreground' :
                currentStep > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-10 h-0.5 bg-muted mb-5" />}
          </div>
        ))}
      </div>

      {/* Step 0: Category Selection */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What are your biggest costs?</CardTitle>
            <p className="text-sm text-muted-foreground">Select the expense categories that apply to your studio.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors text-center min-h-[44px] ${
                    selectedCategories.has(cat.id)
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                  aria-pressed={selectedCategories.has(cat.id)}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setCurrentStep(1)} disabled={selectedCategories.size === 0}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Amount Inputs */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>How much do you spend?</CardTitle>
            <p className="text-sm text-muted-foreground">Enter your estimated monthly amount for each category. Pre-filled with industry averages.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories
              .filter(cat => selectedCategories.has(cat.id) && cat.id !== 'instructor_pay')
              .map(cat => (
                <div key={cat.id} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center shrink-0">{cat.icon}</span>
                  <div className="flex-1">
                    <label htmlFor={`amount-${cat.id}`} className="text-sm font-medium">{cat.name}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        id={`amount-${cat.id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7"
                        value={amounts[cat.id] ?? ''}
                        onChange={e => setAmounts(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/month</span>
                </div>
              ))}
            {selectedCategories.has('instructor_pay') && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                Instructor pay will be configured in the next step.
              </div>
            )}
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>Back</Button>
              <Button onClick={() => setCurrentStep(2)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Instructor Compensation */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Your instructors</CardTitle>
            <p className="text-sm text-muted-foreground">Set up compensation for each instructor at your studio.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {teachersLoading && (
              <div className="py-8 text-center text-muted-foreground" aria-busy="true" role="status">Loading instructors...</div>
            )}
            {!teachersLoading && teachers.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                No instructors found. You can add them later from the Instructors page.
              </div>
            )}
            {!teachersLoading && instructorSetups.map(inst => (
              <div key={inst.user_id} className="p-4 border rounded-lg space-y-3">
                <div className="font-medium">{inst.name}</div>
                <div>
                  <label htmlFor={`comp-type-${inst.user_id}`} className="text-sm font-medium">Compensation Type</label>
                  <select
                    id={`comp-type-${inst.user_id}`}
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[44px]"
                    value={inst.comp_type}
                    onChange={e => updateInstructor(inst.user_id, 'comp_type', e.target.value)}
                  >
                    <option value="per_class">Per Class</option>
                    <option value="monthly_salary">Monthly Salary</option>
                    <option value="hybrid">Hybrid (Salary + Per Class)</option>
                  </select>
                </div>
                {(inst.comp_type === 'per_class' || inst.comp_type === 'hybrid') && (
                  <div>
                    <label htmlFor={`rate-${inst.user_id}`} className="text-sm font-medium">Per Class Rate (NZD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        id={`rate-${inst.user_id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7"
                        value={(inst.per_class_rate_cents / 100).toFixed(2)}
                        onChange={e => updateInstructor(inst.user_id, 'per_class_rate_cents', e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {(inst.comp_type === 'monthly_salary' || inst.comp_type === 'hybrid') && (
                  <div>
                    <label htmlFor={`salary-${inst.user_id}`} className="text-sm font-medium">Monthly Salary (NZD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        id={`salary-${inst.user_id}`}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7"
                        value={(inst.monthly_salary_cents / 100).toFixed(2)}
                        onChange={e => updateInstructor(inst.user_id, 'monthly_salary_cents', e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>Back</Button>
              <Button onClick={() => setCurrentStep(3)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Save */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Your financial snapshot</CardTitle>
            <p className="text-sm text-muted-foreground">Review your estimated monthly expenses before saving.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Fixed expenses */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fixed Expenses</h3>
              <div className="space-y-2">
                {categories
                  .filter(cat => selectedCategories.has(cat.id) && cat.id !== 'instructor_pay')
                  .map(cat => {
                    const val = parseFloat(amounts[cat.id] || '0') * 100
                    if (val <= 0) return null
                    return (
                      <div key={cat.id} className="flex justify-between items-center text-sm">
                        <span>{cat.icon} {cat.name}</span>
                        <span className="font-medium">{formatCents(val)}/mo</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Instructor costs */}
            {instructorSetups.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Instructor Compensation</h3>
                <div className="space-y-2">
                  {instructorSetups.map(inst => {
                    let costLabel = ''
                    if (inst.comp_type === 'per_class') {
                      costLabel = `${formatCents(inst.per_class_rate_cents)}/class`
                    } else if (inst.comp_type === 'monthly_salary') {
                      costLabel = `${formatCents(inst.monthly_salary_cents)}/mo`
                    } else {
                      costLabel = `${formatCents(inst.monthly_salary_cents)}/mo + ${formatCents(inst.per_class_rate_cents)}/class`
                    }
                    return (
                      <div key={inst.user_id} className="flex justify-between items-center text-sm">
                        <span>{inst.name}</span>
                        <span className="font-medium">{costLabel}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Estimated Monthly Total</span>
                <span className="text-lg font-bold">{formatCents(computeMonthlyTotal())}</span>
              </div>
              {instructorSetups.some(i => i.comp_type === 'per_class' || i.comp_type === 'hybrid') && (
                <p className="text-xs text-muted-foreground mt-1">* Per-class rates estimated at 8 classes/month per instructor.</p>
              )}
            </div>

            {error && (
              <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>Back</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
