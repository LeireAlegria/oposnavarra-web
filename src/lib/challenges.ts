import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';

const rankingSchema = z.object({
  name: z.string(),
  isMe: z.boolean(),
  position: z.number().nullable(),
  score: z.number().nullable(),
  correct: z.number().nullable(),
  incorrect: z.number().nullable(),
  blank: z.number().nullable(),
  seconds: z.number().nullable(),
  deliveryReason: z.string().nullable(),
  notStarted: z.boolean(),
});
const challengeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(['abierto', 'cerrado']),
  creatorName: z.string(),
  convocationName: z.string(),
  topics: z.array(z.string()),
  questionCount: z.number(),
  durationSeconds: z.number().nullable(),
  canJoin: z.boolean(),
  isParticipant: z.boolean(),
  isCreator: z.boolean().nullable().transform(Boolean),
  attemptId: z.string().uuid().nullable(),
  attemptStatus: z.enum(['en_curso', 'finalizado']).nullable(),
  invitationToken: z.string().optional(),
  closedReason: z.string().nullable(),
  closedAt: z.string().nullable(),
  ranking: z.array(rankingSchema).optional(),
});
export type Challenge = z.infer<typeof challengeSchema>;
export const CLOSE_CHALLENGE_WARNING =
  'Al cerrar el reto se entregarán los intentos en curso con las respuestas guardadas y se publicarán los resultados. Quienes no hayan empezado ya no podrán realizarlo. Esta acción no se puede deshacer.';
async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await createClient().rpc(name, args);
  if (error)
    throw new Error(
      error.code === 'PGRST202'
        ? 'Los retos todavía no están disponibles. Falta aplicar su migración.'
        : ['22023', '23514', '42501'].includes(error.code)
          ? error.message
          : 'No se pudo completar la operación del reto. Inténtalo de nuevo.',
    );
  return data;
}
export async function listChallenges() {
  return z.array(challengeSchema).parse(await rpc('listar_mis_retos'));
}
export async function getChallenge(id: string) {
  return challengeSchema.parse(await rpc('consultar_reto', { p_reto_id: id }));
}
export async function getInvitation(token: string) {
  return challengeSchema.parse(await rpc('consultar_invitacion_reto', { p_token: token }));
}
export async function joinChallenge(token: string, name: string) {
  return z
    .string()
    .uuid()
    .parse(await rpc('unirse_reto', { p_token: token, p_nombre_visible: name }));
}
export async function startChallenge(id: string) {
  return z
    .string()
    .uuid()
    .parse(await rpc('comenzar_reto', { p_reto_id: id }));
}
export async function closeChallenge(id: string) {
  return challengeSchema.parse(await rpc('cerrar_reto', { p_reto_id: id }));
}
export async function createChallenge(input: {
  title: string;
  convocationId: string;
  topicIds: string[];
  questionCount: number;
  durationSeconds: number | null;
  participants: number;
  name: string;
}) {
  return z
    .string()
    .uuid()
    .parse(
      await rpc('crear_reto', {
        p_titulo: input.title,
        p_convocatoria_id: input.convocationId,
        p_temas: input.topicIds,
        p_numero_preguntas: input.questionCount,
        p_duracion_segundos: input.durationSeconds,
        p_participantes: input.participants,
        p_nombre_visible: input.name,
      }),
    );
}
