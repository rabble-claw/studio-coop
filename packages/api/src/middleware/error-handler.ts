import type { ErrorHandler } from 'hono'
import { AppError } from '../lib/errors'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status as any)
  }

  console.error('Unexpected error:', err)
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
      },
    },
    500
  )
}
