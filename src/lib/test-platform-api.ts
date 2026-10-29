import { z } from 'zod';

import { createClient } from '@/lib/supabase/client';

const topicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  number: z.number().int().positive(),
  order: z.number().int().positive(),
});

const catalogTopicSchema = topicSchema.extend({
  blockId: z.string().uuid().optional(),
  blockName: z.string().default('General'),
  blockOrder: z.number().int().positive().default(1),
  availableQuestions: z.number().int().nonnegative(),
});

const resultByTopicSchema = z.object({
  topicId: z.string().uuid(),
  topicName: z.string(),
  topicNumber: z.number().int().positive(),
  questionCount: z.number().int().nonnegative(),
  aciertos: z.number().int().nonnegative(),
  fallos: z.number().int().nonnegative(),
  enBlanco: z.number().int().nonnegative(),
  porcentajeAciertos: z.number().min(0).max(100),
});

const resultSchema = z.object({
  totalQuestions: z.number().int().positive(),
  aciertos: z.number().int().nonnegative(),
  fallos: z.number().int().nonnegative(),
  enBlanco: z.number().int().nonnegative(),
  puntuacionNeta: z.number(),
  nota: z.number().min(0).max(10),
  porcentajeAciertos: z.number().min(0).max(100),
  tiempoEmpleadoSegundos: z.number().int().nonnegative(),
  penalizacionAplicada: z.number().min(0).max(1),
  byTopic: z.array(resultByTopicSchema),
});

export const attemptSummarySchema = z.object({
  pathId: z.string().uuid().optional(),
  pathChallengeId: z.string().uuid().optional(),
  challengeId: z.string().uuid().optional(),
  challengeTitle: z.string().optional(),
  challengeClosed: z.boolean().optional(),
  id: z.string().uuid(),
  status: z.enum(['in_progress', 'finalized']),
  convocationId: z.string().uuid(),
  convocationName: z.string(),
  officialExamId: z.string().uuid().nullable(),
  officialExamName: z.string().nullable(),
  selectedTopics: z.array(topicSchema),
  questionCount: z.number().int().positive(),
  timeLimitSeconds: z.number().int().positive().nullable(),
  startedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).nullable(),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
  result: resultSchema.nullable(),
});

const questionOptionSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  order: z.number().int().positive(),
  isCorrect: z.boolean().optional(),
});

export const attemptQuestionSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().positive(),
  text: z.string(),
  explanation: z.string().nullable().optional(),
  contentChanged: z.boolean().optional(),
  selectedAnswerId: z.string().uuid().nullable(),
  status: z.enum(['correcta', 'incorrecta', 'en_blanco']).nullable(),
  topics: z.array(topicSchema),
  options: z.array(questionOptionSchema).length(4),
});

const attemptSchema = attemptSummarySchema.extend({
  questions: z.array(attemptQuestionSchema),
});

const historyPageSchema = z.object({
  items: z.array(attemptSummarySchema),
  hasMore: z.boolean(),
});

const attemptIdSchema = z.object({ id: z.string().uuid() });

export type TestTopic = z.infer<typeof topicSchema>;
export type TestCatalogTopic = z.infer<typeof catalogTopicSchema>;
export type TestConvocation = {
  id: string;
  name: string;
  topics: TestCatalogTopic[];
};
export type TestOfficialExam = {
  id: string;
  name: string;
  date: string | null;
  convocationId: string;
  convocationName: string;
  questionCount: number;
};
export type TestResult = z.infer<typeof resultSchema>;
export type TestAttemptSummary = z.infer<typeof attemptSummarySchema>;
export type TestAttemptQuestion = z.infer<typeof attemptQuestionSchema>;
export type TestAttempt = z.infer<typeof attemptSchema>;
export type TestHistoryPage = z.infer<typeof historyPageSchema>;

async function executeRpc(name: string, args?: Record<string, unknown>): Promise<unknown> {
  const supabase = createClient();
  const { data, error } = args ? await supabase.rpc(name, args) : await supabase.rpc(name);

  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error(
        'Las operaciones de tests aún no están disponibles en la base de datos. Aplica la migración pendiente y vuelve a intentarlo.',
      );
    }
    throw new Error(error.message);
  }
  if (data === null) {
    throw new Error(`La operación ${name} no devolvió datos.`);
  }

  return data;
}

function parseResponse<T>(schema: z.ZodType<T>, response: unknown, operation: string): T {
  const result = schema.safeParse(response);
  if (!result.success) {
    throw new Error(`La respuesta de ${operation} no tiene el formato esperado.`);
  }

  return result.data;
}

const catalogSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    topics: z.array(catalogTopicSchema),
  }),
);

const officialExamCatalogSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    date: z.string().nullable(),
    convocationId: z.string().uuid(),
    convocationName: z.string(),
    questionCount: z.number().int().positive(),
  }),
);

export async function getTestCatalog(): Promise<TestConvocation[]> {
  return parseResponse(
    catalogSchema,
    await executeRpc('consultar_catalogo_test'),
    'consultar el catálogo de tests',
  );
}

export async function getOfficialExamCatalog(): Promise<TestOfficialExam[]> {
  return parseResponse(
    officialExamCatalogSchema,
    await executeRpc('consultar_catalogo_examenes_oficiales'),
    'consultar el catálogo de exámenes oficiales',
  );
}

export async function countAvailableTestQuestions(
  convocationId: string,
  topicIds: string[],
): Promise<number> {
  return parseResponse(
    z.number().int().nonnegative(),
    await executeRpc('contar_preguntas_test', {
      p_convocatoria_id: convocationId,
      p_temas_seleccionados: topicIds,
    }),
    'contar las preguntas disponibles',
  );
}

export async function createTestAttempt(input: {
  convocationId: string;
  questionCount: number;
  timeLimitSeconds: number | null;
  topicIds: string[];
}): Promise<string> {
  const response = await executeRpc('crear_intento_test', {
    p_convocatoria_id: input.convocationId,
    p_numero_preguntas: input.questionCount,
    p_tiempo_limite_segundos: input.timeLimitSeconds,
    p_temas_seleccionados: input.topicIds,
  });
  const row = Array.isArray(response) ? response[0] : response;
  return parseResponse(attemptIdSchema, row, 'crear el test').id;
}

export async function createOfficialTestAttempt(input: {
  convocationId: string;
  examId: string;
  timeLimitSeconds: number | null;
}): Promise<string> {
  const response = await executeRpc('crear_intento_test_oficial', {
    p_convocatoria_id: input.convocationId,
    p_examen_id: input.examId,
    p_tiempo_limite_segundos: input.timeLimitSeconds,
  });
  const row = Array.isArray(response) ? response[0] : response;
  return parseResponse(attemptIdSchema, row, 'crear el test oficial').id;
}

export async function listInProgressTestAttempts(): Promise<TestAttemptSummary[]> {
  return parseResponse(
    z.array(attemptSummarySchema),
    await executeRpc('listar_intentos_en_curso_test'),
    'consultar los tests en curso',
  );
}

export async function getTestAttempt(attemptId: string): Promise<TestAttempt> {
  return parseResponse(
    attemptSchema,
    await executeRpc('consultar_intento_test', { p_test_intento_id: attemptId }),
    'consultar el test',
  );
}

export async function saveTestAnswer(input: {
  attemptId: string;
  questionId: string;
  answerId: string;
}): Promise<boolean> {
  return parseResponse(
    z.boolean(),
    await executeRpc('guardar_respuesta_test', {
      p_test_intento_id: input.attemptId,
      p_pregunta_id: input.questionId,
      p_respuesta_id: input.answerId,
    }),
    'guardar la respuesta',
  );
}

export async function finalizeTestAttempt(attemptId: string): Promise<TestAttemptSummary> {
  return parseResponse(
    attemptSummarySchema,
    await executeRpc('finalizar_intento_test', { p_test_intento_id: attemptId }),
    'finalizar el test',
  );
}

export async function getTestHistory(limit: number, offset: number): Promise<TestHistoryPage> {
  return parseResponse(
    historyPageSchema,
    await executeRpc('listar_historial_test', {
      p_limite: limit,
      p_offset: offset,
    }),
    'consultar el historial de tests',
  );
}
