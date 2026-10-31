import crypto from 'node:crypto'
import nodemailer from 'nodemailer'

export function createVerificationToken() {
  return createToken(24 * 60 * 60 * 1000)
}

export function createPasswordResetToken() {
  return createToken(60 * 60 * 1000)
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function sendVerificationEmail(user, token) {
  const transporter = createTransporter()
  const verifyUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/verify-email?token=${token}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Verify your Borrow Hub email',
    text: `Hi ${user.name}, verify your Borrow Hub profile here: ${verifyUrl}. This link expires in 24 hours.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Verify your Borrow Hub profile by clicking the link below. It expires in 24 hours.</p><p><a href="${verifyUrl}">Verify my email</a></p>`
  })
}

export async function sendPasswordResetEmail(user, token) {
  const transporter = createTransporter()
  const resetUrl = `${process.env.FRONTEND_BASE_URL || 'http://localhost:5173'}/reset-password?token=${token}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Reset your Borrow Hub password',
    text: `Hi ${user.name}, reset your Borrow Hub password here: ${resetUrl}. This link expires in 1 hour.`,
    html: `<p>Hi ${escapeHtml(user.name)},</p><p>Reset your Borrow Hub password by clicking the link below. It expires in 1 hour.</p><p><a href="${resetUrl}">Reset my password</a></p>`
  })
}

export async function sendBookingReminderEmail(user, booking) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Borrow Hub reminder: ${booking.itemTitle}`,
    text: `Your booking for ${booking.itemTitle} ends on ${new Date(booking.endDate).toLocaleDateString()}. Please arrange the return with the owner.`,
    html: `<p>Your booking for <strong>${escapeHtml(booking.itemTitle)}</strong> ends on ${new Date(booking.endDate).toLocaleDateString()}.</p><p>Please arrange the return with the owner.</p>`
  })
}

export async function sendBookingOverdueEmail(user, booking, overdueDays) {
  const transporter = createTransporter()
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: `Borrow Hub overdue return: ${booking.itemTitle}`,
    text: `Your booking for ${booking.itemTitle} is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue. Please arrange the return with the owner.`,
    html: `<p>Your booking for <strong>${escapeHtml(booking.itemTitle)}</strong> is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.</p><p>Please arrange the return with the owner.</p>`
  })
}

export async function sendIdentityVerificationResultEmail(user, status, rejectionReason = '') {
  const transporter = createTransporter()
  const outcome = status === 'approved' ? 'approved' : `rejected${rejectionReason ? `: ${rejectionReason}` : ''}`
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Borrow Hub identity verification update',
    text: `Your Borrow Hub identity verification request was ${outcome}.`,
    html: `<p>Your Borrow Hub identity verification request was <strong>${escapeHtml(outcome)}</strong>.</p>`
  })
}

function createToken(durationMs) {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + durationMs) }
}

function createTransporter() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
  const missing = required.filter(name => !process.env[name])
  if (missing.length) {
    const error = new Error(`Email delivery is not configured. Missing: ${missing.join(', ')}`)
    error.code = 'EMAIL_NOT_CONFIGURED'
    throw error
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  })
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}
