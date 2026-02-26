export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    }
  }
}

export const notFound = (entity: string) =>
  new AppError(404, 'NOT_FOUND', `${entity} not found`)

export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = 'Forbidden') =>
  new AppError(403, 'FORBIDDEN', message)

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details)

export const conflict = (message: string) =>
  new AppError(409, 'CONFLICT', message)
