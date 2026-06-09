import { z } from 'zod';

const SafeString = z.string().min(1).max(200);
const TotpCode = z
  .string()
  .min(6)
  .max(20)
  .regex(/^[0-9A-Za-z-]+$/);

export const LoginInput = z
  .object({
    login: SafeString,
    password: z.string().min(8).max(200),
    totp: TotpCode,
  })
  .strict();
export type LoginInput = z.infer<typeof LoginInput>;

export const StepUpInput = z
  .object({
    totp: TotpCode,
    action: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z][a-z0-9._-]*$/),
  })
  .strict();
export type StepUpInput = z.infer<typeof StepUpInput>;

export interface SessionView {
  login: string;
  expiresAt: string;
}
