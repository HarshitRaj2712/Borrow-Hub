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
    const stream = cloudinary.uploader.upload_stream({ folder: 'borrow-hub/avatars', public_id: userId, overwrite: true, resource_type: 'image' }, (error, result) => error ? reject(error) : resolve(result))
    stream.end(buffer)
  })
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
