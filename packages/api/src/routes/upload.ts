import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { badRequest } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'

const upload = new Hono()

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
}

// POST /api/upload
// multipart/form-data fields: file (File), studioId (string), classId (string)
upload.post('/', authMiddleware, async (c) => {
  const user = c.get('user')

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    throw badRequest('Expected multipart/form-data')
  }

  const file = formData.get('file') as File | null
  const studioId = formData.get('studioId') as string | null
  const classId = formData.get('classId') as string | null

  if (!file) throw badRequest('file is required')
  if (!studioId) throw badRequest('studioId is required')
  if (!classId) throw badRequest('classId is required')

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw badRequest(`File type not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`)
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw badRequest('File too large. Maximum size is 10MB')
  }

  const ext = EXT_MAP[file.type]
  const uniqueId = crypto.randomUUID()
  const path = `feed/${studioId}/${classId}/${user.id}/${uniqueId}.${ext}`

  const supabase = createServiceClient()
  const buffer = await file.arrayBuffer()

  const { error } = await supabase.storage
    .from('feed-media')
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) throw badRequest(`Upload failed: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('feed-media')
    .getPublicUrl(path)

  return c.json({ url: publicUrl }, 201)
})

export { upload }
export default upload
