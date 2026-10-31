import { z } from 'zod'

export const itemFields = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(10).max(2000),
  category: z.string().trim().min(2),
  subcategory: z.string().trim().max(100).default(''),
  condition: z.enum(['New', 'Like New', 'Good', 'Fair']),
  pricePerDay: z.coerce.number().int().min(0),
  deposit: z.coerce.number().int().min(0),
  minBorrowDays: z.coerce.number().int().positive().default(1),
  maxBorrowDays: z.coerce.number().int().positive().default(30),
  city: z.string().trim().min(2),
  area: z.string().trim().min(2),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
})

export const itemSchema = withDurationValidation(withCoordinatePairValidation(itemFields))
export const itemUpdateSchema = withDurationValidation(withCoordinatePairValidation(itemFields.partial()))

function withCoordinatePairValidation(schema) {
  return schema
    .refine(value => value.lat === undefined || value.lng !== undefined, { message: 'Longitude is required when latitude is provided', path: ['lng'] })
    .refine(value => value.lng === undefined || value.lat !== undefined, { message: 'Latitude is required when longitude is provided', path: ['lat'] })
}

function withDurationValidation(schema) {
  return schema.refine(value => value.minBorrowDays === undefined || value.maxBorrowDays === undefined || value.maxBorrowDays >= value.minBorrowDays, {
    message: 'Maximum borrow days must be at least minimum borrow days',
    path: ['maxBorrowDays']
  })
}
