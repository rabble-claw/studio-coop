import { api, ApiError } from '../lib/api'

// Mock supabase
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token-123' } },
      }),
    },
  },
}))

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('API client', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('makes GET request with auth token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    })

    const result = await api.get('/api/test')
    expect(result).toEqual({ data: 'test' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('makes POST request with body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'new-1' }),
    })

    const result = await api.post('/api/items', { name: 'test' })
    expect(result).toEqual({ id: 'new-1' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    )
  })

  it('makes PUT request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ updated: true }),
    })

    await api.put('/api/items/1', { name: 'updated' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'PUT' })
    )
  })

  it('makes DELETE request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    })

    await api.delete('/api/items/1')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('throws ApiError on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: () => Promise.resolve({ message: 'Item not found' }),
    })

    await expect(api.get('/api/missing')).rejects.toThrow('Item not found')
    await expect(api.get('/api/missing')).rejects.toBeInstanceOf(ApiError)
  })

  it('returns undefined for 204 responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
    })

    const result = await api.delete('/api/items/1')
    expect(result).toBeUndefined()
  })

  it('handles non-JSON error responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not json')),
    })

    await expect(api.get('/api/broken')).rejects.toThrow('Internal Server Error')
  })
})
