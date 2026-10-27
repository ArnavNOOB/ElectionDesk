import { z } from 'zod';

export const boothLocationSchema = z
  .object({
    latitude: z
      .number({ invalid_type_error: 'Latitude must be a valid numeric coordinate' })
      .min(-90, 'Latitude must be between -90 and 90 degrees')
      .max(90, 'Latitude must be between -90 and 90 degrees')
      .nullable()
      .optional(),
    longitude: z
      .number({ invalid_type_error: 'Longitude must be a valid numeric coordinate' })
      .min(-180, 'Longitude must be between -180 and 180 degrees')
      .max(180, 'Longitude must be between -180 and 180 degrees')
      .nullable()
      .optional(),
  })
  .optional();

export const boothSchema = z.object({
  officialBoothNumber: z
    .union([z.string(), z.number()])
    .transform((val) => String(val).trim())
    .refine((val) => val.length > 0, 'Official booth number is required'),
  stationName: z.string().min(3, 'Station name is required').max(200),
  electoralArea: z.string().min(2, 'Electoral area is required').max(100),
  assemblyConstituency: z.string().min(2, 'Assembly constituency is required').max(100),
  parliamentaryConstituency: z.string().min(2, 'Parliamentary constituency is required').max(100),
  district: z.string().min(2, 'District is required').max(100),
  address: z.string().min(5, 'Physical address of the booth is required').max(300),
  location: boothLocationSchema,
  sourceReference: z.string().optional().default('Official Electoral Roll 2026'),
  status: z.enum(['Active', 'Inactive', 'Under_Review']).optional().default('Active'),
});
