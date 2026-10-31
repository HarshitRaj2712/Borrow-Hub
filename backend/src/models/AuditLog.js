import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema({
  actorId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  targetType: { type: String, required: true },
  targetId: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  at: { type: Date, default: Date.now, index: true }
}, { versionKey: false })

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
