import { z } from 'zod';

const importAmount = z.number().positive().refine(value =>
  value <= Number.MAX_SAFE_INTEGER / 100 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
'Kwota wymaga bezpiecznej precyzji do dwóch miejsc po przecinku.');

export const importTransactionSchema = z.object({
  date: z.iso.date(),
  type: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  from_account: z.string().trim(),
  account_link_state: z.enum(['COMPLETE', 'MISSING_DESTINATION']).optional(),
  missing_destination_reason: z.enum(['LEGACY', 'ABSENT_IN_FILE', 'REFERENCE_NOT_FOUND']).nullable().optional(),
  to_category_parent: z.string().nullable().optional(),
  to_category: z.string().nullable().optional(),
  to_account: z.string().nullable().optional(),
  amount: importAmount,
  currency: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()),
  transaction_amount: importAmount.nullable().optional(),
  transaction_currency: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()).nullable().optional(),
  amount2: importAmount.nullable().optional(),
  currency2: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()).nullable().optional(),
  notes: z.string().optional().default(''),
});

export const importAccountSchema = z.object({
  name: z.string(),
  balance: z.number().nullable(),
  currency: z.string().trim().min(3).max(12).transform(value => value.toUpperCase()),
});

export const importAnalysisSchema = z.object({
  source_app: z.string().nullable().optional(),
  source_format: z.string(),
  confidence: z.number().min(0).max(1),
  allow_missing_destination: z.boolean().optional().default(false),
  transactions: z.array(importTransactionSchema),
  accounts: z.array(importAccountSchema),
});

export type ImportAnalysis = z.infer<typeof importAnalysisSchema>;
