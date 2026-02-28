'use client'

import { useState } from 'react'
import Link from 'next/link'
import { demoClasses, demoTemplates, demoTeachers, demoStudio, type DemoClass } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTime, formatDate } from '@/lib/utils'

export default function DemoSchedulePage() {
  const [classes, setClasses] = useState<DemoClass[]>(demoClasses)
  const [showAddModal, setShowAddModal] = useState(false)

  // Form state
  const [selectedTemplateId, setSelectedTemplateId] = useState(demoTemplates[0]?.id ?? '')
  const [selectedTeacherId, setSelectedTeacherId] = useState(demoTeachers[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]!)
  const [startTime, setStartTime] = useState('17:30')
  const [endTime, setEndTime] = useState('18:30')
  const [capacity, setCapacity] = useState(demoTemplates[0]?.default_capacity ?? 12)

  const selectedTemplate = demoTemplates.find((t) => t.id === selectedTemplateId)

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId)
    const tpl = demoTemplates.find((t) => t.id === templateId)
    if (tpl) {
      setCapacity(tpl.default_capacity)
      // Auto-set end time based on template duration
      const [h, m] = startTime.split(':').map(Number)
      const endMinutes = h! * 60 + m! + tpl.default_duration_min
      const endH = Math.floor(endMinutes / 60) % 24
      const endM = endMinutes % 60
      setEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`)
    }
  }

  function handleStartTimeChange(time: string) {
    setStartTime(time)
    const tpl = demoTemplates.find((t) => t.id === selectedTemplateId)
    if (tpl) {
      const [h, m] = time.split(':').map(Number)
      const endMinutes = h! * 60 + m! + tpl.default_duration_min
      const endH = Math.floor(endMinutes / 60) % 24
      const endM = endMinutes % 60
      setEndTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`)
    }
  }

  function handleAddClass() {
    const template = demoTemplates.find((t) => t.id === selectedTemplateId)
    const teacher = demoTeachers.find((t) => t.id === selectedTeacherId)
    if (!template || !teacher) return

    const newClass: DemoClass = {
      id: `cls-new-${Date.now()}`,
      studio_id: 'demo-empire-001',
      template_id: selectedTemplateId,
      teacher_id: selectedTeacherId,
      date: selectedDate,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      max_capacity: capacity,
      booked_count: 0,
      status: 'scheduled',
      template: { name: template.name, description: template.description },
      teacher: { id: teacher.id, name: teacher.name },
    }

    setClasses((prev) => [...prev, newClass].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.start_time.localeCompare(b.start_time)
    }))
    setShowAddModal(false)
  }

  const classesByDate = classes.reduce<Record<string, DemoClass[]>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">{demoStudio.name} class schedule</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>+ Add Class</Button>
      </div>

      {/* Add Class Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-background rounded-lg shadow-lg border p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-semibold">Add Class</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Template</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  {demoTemplates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Teacher</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                >
                  {demoTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start Time</label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End Time</label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Capacity</label>
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                />
              </div>

              {selectedTemplate && (
                <p className="text-xs text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddClass}>
                Add Class
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(classesByDate).map(([date, dateClasses]) => (
          <div key={date}>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {formatDate(date)}
            </h2>
            <div className="grid gap-2">
              {dateClasses.map((cls) => {
                const spotsLeft = cls.max_capacity - cls.booked_count
                const fillPercent = (cls.booked_count / cls.max_capacity) * 100
                return (
                  <Link key={cls.id} href={`/demo/classes/${cls.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-mono text-muted-foreground w-28">
                                {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                              </div>
                              <div>
                                <div className="font-medium">{cls.template.name}</div>
                                <div className="text-sm text-muted-foreground">with {cls.teacher.name}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm">
                                <span className="font-medium">{cls.booked_count}</span>
                                <span className="text-muted-foreground">/{cls.max_capacity}</span>
                              </div>
                              <div className="w-20 h-1.5 bg-secondary rounded-full mt-1">
                                <div
                                  className={`h-full rounded-full ${fillPercent > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                                  style={{ width: `${Math.min(fillPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              spotsLeft <= 2
                                ? 'bg-red-100 text-red-700'
                                : spotsLeft <= 4
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {spotsLeft === 0 ? 'Full' : `${spotsLeft} left`}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
