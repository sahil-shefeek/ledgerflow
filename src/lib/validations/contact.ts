import { z } from 'zod';

export const phoneValidator = z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number (e.g., +919876543210).')
    .or(z.literal(''))
    .optional();

export const baseContactSchema = z.object({
    name: z.string().trim().min(1, 'Please enter a name.').min(2, 'Name must be at least 2 characters.'),
    phone: phoneValidator,
    image_url: z.string().optional(),
});
