'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DemoCopilotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Copilot</h1>
        <p className="text-muted-foreground">
          Demo mode preview for the AI copilot experience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Copilot Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            The live copilot requires backend AI and finance data tools. In demo mode,
            use the dashboard pages to explore sample studio data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/demo/reports">Open Demo Reports</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/demo/money">Open Demo Money</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
