const signatures = [
  { type: 'image/jpeg', matches: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  { type: 'image/png', matches: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: 'image/webp', matches: buffer => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }
]

export function validateImageUpload(file) {
  if (!file?.buffer) {
    const error = new Error('An image file is required (JPEG, PNG, or WebP).')
    error.status = 400
    throw error
  }
  const signature = signatures.find(candidate => candidate.matches(file.buffer))
  if (!signature || signature.type !== file.mimetype) {
    const error = new Error('Invalid image file. Upload a genuine JPEG, PNG, or WebP image.')
    error.status = 400
    throw error
  }
  return signature.type
}
