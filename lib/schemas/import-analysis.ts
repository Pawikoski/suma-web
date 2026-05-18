import { z } from 'zod';

export const importTransactionSchema = z.object({
  date: z.string(),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  from_account: z.string(),
  to_category_parent: z.string().nullable().optional(),
  to_category: z.string().nullable().optional(),
  to_account: z.string().nullable().optional(),
  amount: z.number(),
  currency: z.string(),
  amount2: z.number().nullable().optional(),
  currency2: z.string().nullable().optional(),
  notes: z.string().optional().default(''),
});

export const importAccountSchema = z.object({
  name: z.string(),
  balance: z.number().nullable(),
  currency: z.string(),
});

export const importAnalysisSchema = z.object({
  source_app: z.string().nullable().optional(),
  source_format: z.string(),
  confidence: z.number(),
  transactions: z.array(importTransactionSchema),
  accounts: z.array(importAccountSchema),
});

export type ImportAnalysis = z.infer<typeof importAnalysisSchema>;
