import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { attemptSummarySchema, attemptQuestionSchema } from '@/lib/test-platform-api';
const challengeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  questionCount: z.number(),
  criterion: z.enum(['finalizacion', 'porcentaje']),
  threshold: z.number(),
  minimum: z.number(),
  xp: z.number(),
  completed: z.boolean(),
  best: z.number().nullable(),
  lastAttemptId: z.string().uuid().nullable(),
  available: z.boolean(),
  activeAttemptId: z.string().uuid().nullable(),
});
const stopSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum(['tema', 'repaso_bloque']),
  blockName: z.string(),
  blockId: z.string().uuid(),
  challenges: z.array(challengeSchema),
});
export const pathMapSchema = z.object({
  paths: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      state: z.string(),
      convocationName: z.string(),
    }),
  ),
  unavailableConvocations: z.array(z.string()),
  canPractice: z.boolean(),
  activity: z.object({ current: z.number(), best: z.number(), dailyDone: z.boolean() }),
  path: z
    .object({
      id: z.string().uuid(),
      title: z.string(),
      state: z.string(),
      completedChallenges: z.number(),
      totalChallenges: z.number(),
      completedTopics: z.number(),
      totalTopics: z.number(),
      percentage: z.number(),
      xp: z.number(),
      stops: z.array(stopSchema),
    })
    .nullable(),
});
export const pathAttemptSchema = attemptSummarySchema.extend({
  questions: z.array(
    attemptQuestionSchema.extend({
      options: z.array(
        z.object({
          id: z.string().uuid(),
          text: z.string(),
          order: z.number(),
          isCorrect: z.boolean().optional(),
        }),
      ),
    }),
  ),
  pathId: z.string().uuid(),
  pathChallengeId: z.string().uuid(),
  pathState: z.enum(['en_curso', 'finalizado', 'abandonado', 'invalidado']),
  pathVersion: z.number().int(),
  pathTitle: z.string(),
  pathEvaluation: z.object({
    criterion: z.enum(['finalizacion', 'porcentaje']),
    threshold: z.number(),
    minimum: z.number(),
    xp: z.number(),
  }),
  pathPassed: z.boolean().nullable(),
  pathXpEarned: z.number().nullable(),
  canPractice: z.boolean(),
  conflict: z.boolean().optional(),
});
export type PathMap = z.infer<typeof pathMapSchema>;
export type PathAttempt = z.infer<typeof pathAttemptSchema>;
export type PathChallenge = z.infer<typeof challengeSchema>;
export type PathStop = z.infer<typeof stopSchema>;
export async function pathRpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await createClient().rpc(name, args);
  if (error) {
    if (['22023', '42501'].includes(error.code)) throw new Error(error.message);
    if (error.code === '23514')
      throw new Error(
        'Revisa la configuración: las preguntas deben ser positivas, la XP no negativa y el porcentaje entre 0 y 100. Las reglas publicadas no se pueden modificar.',
      );
    throw new Error('No se pudo completar la operación de Mi camino. Vuelve a intentarlo.');
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new Error('No se pudo recuperar el estado del camino. Actualiza para reintentarlo.');
  return parsed.data;
}
export const getLearningPath = (pathId: string | null) =>
  pathRpc('camino_map', { p_path: pathId }, pathMapSchema);
export const getPathAttempt = (id: string) =>
  pathRpc('camino_attempt', { p_attempt: id }, pathAttemptSchema);
export const startPathChallenge = (id: string) =>
  pathRpc('camino_start', { p_challenge: id }, pathAttemptSchema);
export const savePathAnswer = (attempt: PathAttempt, questionId: string, answerId: string | null) =>
  pathRpc(
    'camino_save',
    {
      p_attempt: attempt.id,
      p_question: questionId,
      p_option: answerId,
      p_version: attempt.pathVersion,
    },
    pathAttemptSchema,
  );
export const finishPathAttempt = (attempt: PathAttempt) =>
  pathRpc(
    'camino_finish',
    { p_attempt: attempt.id, p_version: attempt.pathVersion },
    pathAttemptSchema,
  );
export const abandonPathAttempt = (id: string) =>
  pathRpc('camino_abandon', { p_attempt: id }, pathAttemptSchema);
export function challengeRequirement(
  challenge: Pick<PathChallenge, 'criterion' | 'minimum' | 'questionCount'>,
) {
  return challenge.criterion === 'finalizacion'
    ? 'Iniciación: finaliza y responde al menos una pregunta. No mide dominio.'
    : `Necesitas ${challenge.minimum} aciertos de ${challenge.questionCount}. Los errores y blancos no suman; no hay penalización adicional.`;
}
