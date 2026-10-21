import { z } from 'zod';

export function normalizeBonUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('La URL no es válida.');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'bon.navarra.es' ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error('Solo se admiten anuncios HTTPS de bon.navarra.es.');
  }
  const match = url.pathname.match(
    /^\/(?:es|eu)\/anuncio\/-\/texto\/(\d{4})\/([1-9]\d*)\/([1-9]\d*)\/?$/,
  );
  if (!match) throw new Error('La URL debe corresponder a un anuncio del BON.');
  const sourceId = `${match[1]}/${match[2]}/${match[3]}`;
  return { sourceId, url: `https://bon.navarra.es/es/anuncio/-/texto/${sourceId}/` };
}

export const draftTopicSchema = z.object({
  key: z.string().min(1),
  number: z.number().int().positive(),
  text: z.string().trim().min(1),
  name: z.string().trim().min(1),
  decision: z.enum(['pending', 'new', 'existing']),
  topicId: z.string().uuid().nullable(),
});
export const draftSchema = z
  .object({
    sourceUrl: z.string(),
    sourceId: z.string(),
    name: z.string().trim().min(1),
    description: z.string(),
    organization: z.string(),
    group: z.string(),
    publicationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal('')),
    resolution: z.string(),
    announcementCode: z.string(),
    blocks: z
      .array(
        z.object({
          key: z.string().min(1),
          name: z.string().trim().min(1),
          reference: z.string(),
          topics: z.array(draftTopicSchema).min(1),
        }),
      )
      .min(1),
    reviewed: z.literal(true),
  })
  .superRefine((draft, context) => {
    try {
      const source = normalizeBonUrl(draft.sourceUrl);
      if (source.sourceId !== draft.sourceId) throw new Error();
    } catch {
      context.addIssue({ code: 'custom', message: 'El origen del anuncio no es válido.' });
    }
    const ids = new Set<string>();
    const texts = new Set<string>();
    for (const block of draft.blocks) {
      const numbers = new Set<number>();
      for (const topic of block.topics) {
        if (numbers.has(topic.number))
          context.addIssue({
            code: 'custom',
            message: 'Hay números oficiales repetidos en un bloque.',
          });
        numbers.add(topic.number);
        if (topic.decision === 'pending' || (topic.decision === 'existing' && !topic.topicId))
          context.addIssue({
            code: 'custom',
            message: 'Resuelve la reutilización de todos los temas.',
          });
        if (topic.decision === 'existing' && topic.topicId) {
          if (ids.has(topic.topicId))
            context.addIssue({
              code: 'custom',
              message: 'No puedes vincular el mismo tema dos veces.',
            });
          ids.add(topic.topicId);
        }
        const text = topic.text.toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
        if (texts.has(text))
          context.addIssue({
            code: 'custom',
            message: 'Hay contenidos repetidos; resuélvelos antes de confirmar.',
          });
        texts.add(text);
      }
    }
  });
export type BonTopic = z.infer<typeof draftTopicSchema>;
export type BonDraft = Omit<z.infer<typeof draftSchema>, 'reviewed'> & { reviewed: boolean };
