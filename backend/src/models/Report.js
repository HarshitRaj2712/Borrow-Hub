import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  reporterId: { type: String, required: true, index: true },
  itemId: { type: String, index: true },
  userId: { type: String, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open', index: true }
}, { timestamps: true, versionKey: false })

reportSchema.index({ reporterId: 1, itemId: 1 }, { unique: true, partialFilterExpression: { itemId: { $exists: true } } })
reportSchema.index({ reporterId: 1, userId: 1 }, { unique: true, partialFilterExpression: { userId: { $exists: true } } })

export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema)
