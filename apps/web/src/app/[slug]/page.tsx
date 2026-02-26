import { notFound } from 'next/navigation'
import { formatTime, formatDate } from '@/lib/utils'
import { isDemoMode, demoStudio, demoClasses, demoMembers } from '@/lib/demo-data'
import Link from 'next/link'

async function getStudioData(slug: string) {
  if (isDemoMode()) {
    if (slug !== demoStudio.slug) return null
    const classesByDate = demoClasses.reduce<Record<string, typeof demoClasses>>((acc, cls) => {
      if (!acc[cls.date]) acc[cls.date] = []
      acc[cls.date]!.push(cls)
      return acc
    }, {})
    return { studio: demoStudio, classesByDate, memberCount: demoMembers.length }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: studio } = await supabase.from('studios').select('*').eq('slug', slug).single()
  if (!studio) return null

  const today = new Date().toISOString().split('T')[0]
  const { data: classes } = await supabase
    .from('class_instances')
    .select('*, teacher:users!class_instances_teacher_id_fkey(name), template:class_templates!class_instances_template_id_fkey(name, description)')
    .eq('studio_id', studio.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date')
    .order('start_time')
    .limit(20)

  const { count: memberCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studio.id)
    .eq('status', 'active')

  const classesByDate = (classes ?? []).reduce<Record<string, typeof classes>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  return { studio, classesByDate, memberCount: memberCount ?? 0 }
}

export default async function PublicStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getStudioData(slug)
  if (!data) notFound()
  const { studio, classesByDate, memberCount } = data

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Studio Co-op
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="inline-flex items-center rounded-full border border-transparent bg-secondary text-secondary-foreground px-2.5 py-0.5 text-xs font-semibold mb-3 capitalize">
            {studio.discipline}
          </span>
          <h1 className="text-4xl font-bold mb-3">{studio.name}</h1>
          {studio.description && (
            <p className="text-lg text-muted-foreground max-w-2xl">{studio.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span>{memberCount} members</span>
            <span>{studio.timezone}</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Upcoming Classes</h2>

        {Object.keys(classesByDate).length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No upcoming classes scheduled.</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(classesByDate).map(([date, dayClasses]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  {formatDate(date)}
                </h3>
                <div className="space-y-2">
                  {dayClasses!.map((cls) => (
                    <div key={cls.id} className="rounded-xl border bg-card text-card-foreground shadow-sm">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <div className="font-medium">{cls.template?.name ?? 'Class'}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                            {cls.teacher && ` with ${cls.teacher.name}`}
                          </div>
                          {cls.template?.description && (
                            <div className="text-sm text-muted-foreground mt-1 max-w-lg">{cls.template.description}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {cls.max_capacity - (cls.booked_count ?? 0)} spots left
                          </div>
                          <div className="text-xs text-muted-foreground">{cls.max_capacity} max</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Want to book a class?</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            Sign in to book
          </Link>
        </div>
      </div>

      {isDemoMode() && (
        <div className="fixed bottom-4 right-4 bg-amber-100 text-amber-800 text-xs px-3 py-1.5 rounded-full shadow-sm border border-amber-200">
          🎭 Demo Mode — Empire Aerial Arts
        </div>
      )}
    </div>
  )
}
