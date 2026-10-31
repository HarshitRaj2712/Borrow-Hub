import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

export function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function sendVerificationEmail(user, token) {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Email delivery is not configured. Missing: ${missing.join(', ')}`)
    error.code = 'EMAIL_NOT_CONFIGURED'
    throw error
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  })
  const verifyUrl = `${process.env.APP_BASE_URL || 'http://localhost:4000'}/api/auth/verify-email?token=${token}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Verify your Borrow Hub email',
    text: `Hi ${user.name}, verify your Borrow Hub profile here: ${verifyUrl}. This link expires in 24 hours.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Verify your Borrow Hub profile by clicking the link below. It expires in 24 hours.</p><p><a href="${verifyUrl}">Verify my email</a></p>`
  })
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}
