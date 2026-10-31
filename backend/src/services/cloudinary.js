import { v2 as cloudinary } from 'cloudinary'

export function uploadAvatar(buffer, userId) {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Avatar uploads are not configured. Missing: ${missing.join(', ')}`)
    error.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw error
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'borrow-hub/avatars', public_id: userId, overwrite: true, resource_type: 'image', transformation: [{ width: 512, height: 512, crop: 'limit', fetch_format: 'auto', quality: 'auto' }] }, (error, result) => error ? reject(error) : resolve(result))
    stream.end(buffer)
  })
}

export async function deleteCloudinaryImage(publicId) {
  if (!publicId) return
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Cloudinary is not configured. Missing: ${missing.join(', ')}`)
    error.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw error
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true })
}

export async function deleteCloudinaryFolder(prefix) {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Cloudinary is not configured. Missing: ${missing.join(', ')}`)
    error.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw error
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: 'image' })
}

export function optimizedImageUrl(publicId) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  return cloudinary.url(publicId, { secure: true, resource_type: 'image', transformation: [{ width: 1200, crop: 'limit', fetch_format: 'auto', quality: 'auto' }] })
}

export function signedPrivateImageUrl(publicId) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  return cloudinary.url(publicId, { secure: true, type: 'authenticated', sign_url: true, expires_at: Math.floor(Date.now() / 1000) + 300 })
}

export function uploadItemImage(buffer, itemId) {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Item image uploads are not configured. Missing: ${missing.join(', ')}`)
    error.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw error
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `borrow-hub/items/${itemId}`, resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result))
    stream.end(buffer)
  })
}

export function uploadPrivateVerificationDocument(buffer, userId, kind) {
  const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Identity verification uploads are not configured. Missing: ${missing.join(', ')}`)
    error.code = 'CLOUDINARY_NOT_CONFIGURED'
    throw error
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  })
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `borrow-hub/verification/${userId}`, public_id: kind, type: 'authenticated', resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result))
    stream.end(buffer)
  })
}
