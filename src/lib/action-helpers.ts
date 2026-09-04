import { z } from 'zod';
import { getSessionUser } from '@/lib/auth-session';

export type ActionState<T = any> = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  success?: boolean;
  data?: T;
};

export function rpcAction<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: (data: z.infer<S>) => Promise<T>
) {
  return async (input: unknown): Promise<ActionState<T>> => {
    try {
      const result = schema.safeParse(input);
      if (!result.success) {
        return {
          error: 'Validation failed',
          fieldErrors: result.error.flatten().fieldErrors,
        };
      }

      const data = await action(result.data);
      return { success: true, data };
    } catch (e: any) {
      console.error(e);
      return { error: e.message || 'Internal server error' };
    }
  };
}

export function rpcActionWithAuth<S extends z.ZodType<any, any>, T>(
  schema: S,
  action: (data: z.infer<S>, user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>) => Promise<T>
) {
  return async (input: unknown): Promise<ActionState<T>> => {
    try {
      const user = await getSessionUser();
      if (!user) {
        return { error: 'Unauthorized' };
      }

      const result = schema.safeParse(input);
      if (!result.success) {
        return {
          error: 'Validation failed',
          fieldErrors: result.error.flatten().fieldErrors,
        };
      }

      const data = await action(result.data, user);
      return { success: true, data };
    } catch (e: any) {
      console.error(e);
      return { error: e.message || 'Internal server error' };
    }
  };
}
