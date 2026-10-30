import { z } from 'zod';

export const addressSchema = z.object({
  houseNumber: z.string().optional().default(''),
  street: z.string().optional().default(''),
  locality: z.string().optional().default(''),
  villageWard: z.string().optional().default('12'),
  city: z.string().min(2, 'City is required'),
  district: z.string().min(2, 'District is required'),
  state: z.string().min(2, 'State is required'),
  pinCode: z.string().regex(/^[1-9][0-9]{5}$/, 'Must be a valid 6-digit Indian PIN code'),
  country: z.string().default('India'),
  formattedAddress: z.string().optional().default(''),
  placeId: z.string().nullable().optional().default(null),
  latitude: z
    .number({ invalid_type_error: 'Latitude must be a valid numeric coordinate' })
    .min(-90, 'Latitude must be between -90 and 90 degrees')
    .max(90, 'Latitude must be between -90 and 90 degrees')
    .nullable()
    .optional()
    .default(null),
  longitude: z
    .number({ invalid_type_error: 'Longitude must be a valid numeric coordinate' })
    .min(-180, 'Longitude must be between -180 and 180 degrees')
    .max(180, 'Longitude must be between -180 and 180 degrees')
    .nullable()
    .optional()
    .default(null),
  verified: z.boolean().optional().default(false),
});

export const createVoterSchema = z.object({
  boothSerialNumber: z.coerce
    .number({ required_error: 'Booth serial number is required as the primary roll identifier' })
    .int('Booth serial number must be a valid integer')
    .positive('Booth serial number must be greater than 0 (e.g. 1, 2, 3...)'),
  epicNumber: z
    .string()
    .optional()
    .default('')
    .transform((val) => (val ? val.trim().toUpperCase() : '')),
  fullName: z.string().min(2, 'Full Name is required and must be at least 2 characters').max(100),
  relativeName: z.string().min(2, 'Relative Name is required').max(100),
  relationType: z.enum(['Father', 'Mother', 'Husband', 'Other']).default('Father'),
  gender: z.enum(['Male', 'Female', 'Third Gender']),
  age: z.number().int().min(18, 'Voter must be at least 18 years old').max(120),
  dateOfBirth: z.string().nullable().optional().default(null),
  address: addressSchema,
  pollingStationId: z.string().nullable().optional().default(null),
  familyRole: z.enum(['FH', 'FM', 'SM']).optional().default('SM'),
  familyHeadId: z.string().nullable().optional().default(null),
  mobileNumber: z
    .string()
    .optional()
    .default('')
    .transform((val) => (val ? val.trim() : '')),
  verificationStatus: z.string().optional().default('Verified'),
  isDuplicate: z.boolean().optional().default(false),
  duplicateFlags: z.array(z.string()).optional().default([]),
  clearDuplicates: z.boolean().optional(),
});

export const updateVoterSchema = createVoterSchema.partial();
