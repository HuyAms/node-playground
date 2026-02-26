import { z } from 'zod';

export const UserRole = z.enum(['admin', 'editor', 'viewer']);
export type UserRole = z.infer<typeof UserRole>;

/** The persisted User shape — what lives in the repository */
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: UserRole,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

/** POST /users body */
export const createUserSchema = z.object({
  name: z
    .string({ required_error: 'name is required' })
    .min(2, 'name must be at least 2 characters')
    .max(100, 'name must be at most 100 characters')
    .trim(),
  email: z
    .string({ required_error: 'email is required' })
    .email('email must be a valid email address')
    .toLowerCase(),
  role: UserRole.default('viewer'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** PATCH /users/:id body — all fields optional */
export const updateUserSchema = createUserSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** GET /users query params — coerce strings to numbers */
export const paginationSchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: 'page must be a number' })
    .int('page must be an integer')
    .positive('page must be positive')
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a number' })
    .int('limit must be an integer')
    .positive('limit must be positive')
    .max(100, 'limit must not exceed 100')
    .default(10),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

/** GET /users/:id params */
export const userIdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;
