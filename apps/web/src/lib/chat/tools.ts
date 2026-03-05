import { tool } from 'ai'
import { z } from 'zod'

async function apiCall(baseUrl: string, path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${baseUrl}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    return { error: true, status: res.status, message: err.message }
  }
  return res.json()
}

export function advisorTools(apiBaseUrl: string, studioId: string, accessToken: string) {
  return {
    getFinancialOverview: tool({
      description:
        'Get monthly revenue, expenses, instructor costs, net income, and profit margin for a studio. Omit month for current month.',
      parameters: z.object({
        month: z.string().optional().describe('YYYY-MM format, e.g. 2026-03'),
      }),
      execute: async ({ month }) => {
        const params = month ? `?month=${month}` : ''
        return apiCall(apiBaseUrl, `/studios/${studioId}/finances/overview${params}`, accessToken)
      },
    }),

    getProfitAndLoss: tool({
      description:
        'Get multi-month profit and loss history showing revenue, expenses, and net income trends.',
      parameters: z.object({
        months: z
          .number()
          .optional()
          .default(6)
          .describe('Number of months of history (default 6)'),
      }),
      execute: async ({ months }) => {
        return apiCall(
          apiBaseUrl,
          `/studios/${studioId}/finances/pnl?months=${months}`,
          accessToken
        )
      },
    }),

    getCashFlow: tool({
      description:
        'Get cash flow data with inflows, outflows, and running balance over multiple months.',
      parameters: z.object({
        months: z
          .number()
          .optional()
          .default(6)
          .describe('Number of months of history (default 6)'),
      }),
      execute: async ({ months }) => {
        return apiCall(
          apiBaseUrl,
          `/studios/${studioId}/finances/cash-flow?months=${months}`,
          accessToken
        )
      },
    }),

    getHealthCheck: tool({
      description:
        'Get a 6-dimension financial health score with industry benchmarks. Covers profit margin, revenue diversity, cost structure, cash position, growth trend, and member economics.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/finances/health-check`, accessToken)
      },
    }),

    getBreakEven: tool({
      description:
        'Get break-even analysis: how many members or daily revenue needed to cover fixed costs.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/finances/break-even`, accessToken)
      },
    }),

    runScenario: tool({
      description:
        'Run a what-if financial scenario. Adjust pricing, member count, class count, or expenses to see projected impact on revenue and profit.',
      parameters: z.object({
        priceChangePercent: z
          .number()
          .optional()
          .describe('Percentage change in pricing, e.g. 10 for +10%'),
        memberChangePercent: z
          .number()
          .optional()
          .describe('Percentage change in member count, e.g. -5 for -5%'),
        newClassesPerWeek: z
          .number()
          .optional()
          .describe('Number of additional classes per week'),
        additionalMonthlyExpense: z
          .number()
          .optional()
          .describe('Additional monthly expense in cents'),
      }),
      execute: async (params) => {
        return apiCall(
          apiBaseUrl,
          `/studios/${studioId}/finances/scenario`,
          accessToken,
          {
            method: 'POST',
            body: JSON.stringify(params),
          }
        )
      },
    }),

    getReportsOverview: tool({
      description:
        'Get high-level studio metrics: active members, monthly revenue, attendance rate, and retention rate.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/reports/overview`, accessToken)
      },
    }),

    getRevenueByType: tool({
      description:
        'Get monthly revenue broken down by type: subscriptions, drop-ins, class packs, and private bookings.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/reports/revenue`, accessToken)
      },
    }),

    getAttendance: tool({
      description:
        'Get weekly attendance data: number of classes, check-ins, and fill rates over recent weeks.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/reports/attendance`, accessToken)
      },
    }),

    getPopularClasses: tool({
      description:
        'Get the top 10 most popular classes by attendance, including fill rates and average attendance.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/reports/popular-classes`, accessToken)
      },
    }),

    getAtRiskMembers: tool({
      description:
        'Get members at risk of churning — those with no attendance in the last 14+ days. Includes last class date and days since.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/reports/at-risk`, accessToken)
      },
    }),

    getExpenses: tool({
      description:
        'Get all studio expenses with categories, amounts, and whether they are recurring or one-time.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/finances/expenses`, accessToken)
      },
    }),

    getInstructorCosts: tool({
      description:
        'Get instructor compensation records: per-class rates, number of classes taught, and total compensation.',
      parameters: z.object({}),
      execute: async () => {
        return apiCall(apiBaseUrl, `/studios/${studioId}/finances/instructors`, accessToken)
      },
    }),
  }
}
