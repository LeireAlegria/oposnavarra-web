import { z } from 'zod';
const optionSchema = z.object({ id: z.string().uuid(), text: z.string() });
export const demoQuestionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  options: z.array(optionSchema).length(4),
});
export const demoResultSchema = demoQuestionSchema.extend({
  selectedOptionId: z.string().uuid(),
  correctOptionId: z.string().uuid(),
  explanation: z.string(),
  reference: z.string().nullable(),
  correct: z.boolean(),
});
export const demoAttemptSchema = z.object({
  id: z.string().uuid(),
  version: z.number(),
  name: z.string(),
  state: z.enum(['started', 'completed', 'claimed']),
  expiresAt: z.string(),
  answered: z.number().int().min(0).max(5),
  score: z.number().int().min(0).max(5),
  results: z.array(demoResultSchema),
  question: demoQuestionSchema.nullable(),
  completionEventId: z.string().uuid().nullable().optional(),
  claimEventId: z.string().uuid().nullable().optional(),
  invalidated: z.boolean().optional(),
  registeredFromDemo: z.boolean().optional(),
});
export type DemoAttempt = z.infer<typeof demoAttemptSchema>;
export type DemoQuestion = z.infer<typeof demoQuestionSchema>;
export const demoAvailableSchema = z.object({
  version: z.number(),
  name: z.string(),
  question: demoQuestionSchema,
});
export type DemoAvailable = z.infer<typeof demoAvailableSchema>;
export const publicCatalogSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    topics: z.array(z.object({ name: z.string(), number: z.number(), count: z.number() })),
  }),
);
export type PublicCatalog = z.infer<typeof publicCatalogSchema>;
export async function demoOperation(
  input:
    | { action: 'start' | 'restore' | 'claim'; token: string }
    | { action: 'answer'; token: string; position: number; option: string },
) {
  const response = await fetch('/api/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message ?? 'No se pudo recuperar la prueba. Vuelve a intentarlo.');
  return demoAttemptSchema.parse(body);
}
