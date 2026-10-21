import { normalizeBonUrl, type BonDraft } from './draft';

function decodeText(html: string) {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ntilde: 'ñ',
    uuml: 'ü',
  };
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith('#')) {
        const point =
          code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
      }
      return entities[code] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractBonDraft(
  html: string,
  sourceUrl: string,
): { draft: BonDraft; warnings: string[] } {
  const source = normalizeBonUrl(sourceUrl);
  const title = decodeText(
    html.match(/<p[^>]*class="[^"]*a-titulo[^"]*"[^>]*>([\s\S]*?)<\//i)?.[1] ?? '',
  );
  if (!title) throw new Error('Contenido no compatible: no se identifica el anuncio principal.');
  if (/correcci[oó]n|modificaci[oó]n|modifica\b/i.test(title))
    throw new Error(
      'Las correcciones y modificaciones del BON no están soportadas en esta versión.',
    );
  const content =
    html.match(/<p[^>]*class="contenido"[^>]*>([\s\S]*?)<p>\s*C[oó]digo del anuncio/i)?.[1] ??
    html.match(/<p[^>]*class="contenido"[^>]*>([\s\S]*)/i)?.[1];
  if (!content) throw new Error('Contenido no compatible: no se encuentra el texto del anuncio.');
  const lines = [
    ...content
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .matchAll(/<(p|h[1-6]|li)\b([^>]*)>([\s\S]*?)(?=<\/(?:p|h[1-6]|li)>|<(?:p|h[1-6]|li)\b)/gi),
  ]
    .map((match) => ({
      text: decodeText(match[3]),
      heading: /titulo/i.test(match[2]) || /^h/.test(match[1]),
    }))
    .filter((line) => line.text);
  const starts = lines.flatMap((line, index) =>
    /^(?:ANEXO\s+[IVX\d]+\s*[.\s]*[–—:.-]+\s*)?(?:temario|programa)(?:\s|[.:–—-]|$)/i.test(
      line.text,
    ) && line.text.length < 200
      ? [index]
      : [],
  );
  const warnings: string[] = [];
  if (/<(?:table|img|iframe|object)\b/i.test(content)) {
    warnings.push('El anuncio incluye tablas, imágenes u otros contenidos especiales. Comprueba el temario completo y completa manualmente cualquier contenido que falte.');
  }
  if (!starts.length)
    warnings.push(
      'No se ha identificado el temario. Complétalo manualmente consultando el anuncio.',
    );
  if (starts.length > 1)
    warnings.push(
      'Hay varios posibles temarios. Se propone el primero; revisa y completa el borrador.',
    );
  const blocks: BonDraft['blocks'] = [];
  let current: BonDraft['blocks'][number] | undefined;
  let lastTopic: BonDraft['blocks'][number]['topics'][number] | undefined;
  for (const line of starts.length ? lines.slice(starts[0] + 1) : []) {
    if (/^(?:ANEXO\s+[IVX\d]+|C[oó]digo del anuncio)/i.test(line.text)) break;
    const block = line.text.match(/^((?:Parte|Bloque)\s+[IVX\dA-Z]+)\s*[.\s]*[–—:.-]+\s*(.+)$/i);
    if (block) {
      current = {
        key: `block-${blocks.length}`,
        name: block[2].replace(/\.$/, ''),
        reference: block[1],
        topics: [],
      };
      blocks.push(current);
      lastTopic = undefined;
      continue;
    }
    const topic = line.text.match(/^(?:Tema\s+)?(\d+)\s*[.]?\s*[–—:.-]\s*(.+)$/i);
    if (topic) {
      if (!current) {
        current = { key: 'general', name: 'General', reference: '', topics: [] };
        blocks.push(current);
      }
      lastTopic = {
        key: `topic-${blocks.length}-${current.topics.length}`,
        number: Number(topic[1]),
        text: topic[2],
        name: topic[2],
        decision: 'new',
        topicId: null,
      };
      current.topics.push(lastTopic);
    } else if (lastTopic) {
      if (line.heading)
        warnings.push(`Revisa el contenido incorporado al tema ${lastTopic.number}: ${line.text}`);
      lastTopic.text += `\n${line.text}`;
      lastTopic.name = lastTopic.text;
    } else warnings.push(`Contenido pendiente de revisar: ${line.text}`);
  }
  if (!blocks.some((block) => block.topics.length))
    warnings.push('No se han extraído temas. Añádelos manualmente antes de confirmar.');
  const date = decodeText(html).match(
    /BOLET[IÍ]N\s+N[º°o]?\s*\d+\s*[-–]\s*(\d{1,2}) de (\w+) de (\d{4})/i,
  );
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const month = date ? months.indexOf(date[2].toLowerCase()) + 1 : 0;
  return {
    draft: {
      sourceUrl: source.url,
      sourceId: source.sourceId,
      name: title,
      description: title,
      organization: title.match(/al servicio de (.+?)(?:\.$|$)/i)?.[1] ?? '',
      group: decodeText(content).match(/(?:de\s+)?nivel\s+([A-E])\b/i)?.[1] ?? '',
      publicationDate:
        date && month
          ? `${date[3]}-${String(month).padStart(2, '0')}-${date[1].padStart(2, '0')}`
          : '',
      resolution: title.match(/^RESOLUCI[ÓO]N\s+[^,]+/i)?.[0] ?? '',
      announcementCode: decodeText(html).match(/C[oó]digo del anuncio:\s*(\w+)/i)?.[1] ?? '',
      blocks,
      reviewed: false,
    },
    warnings,
  };
}

export async function downloadBon(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  let target = normalizeBonUrl(url).url;
  const originalSourceId = normalizeBonUrl(url).sourceId;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(target, {
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Redirección del BON no válida.');
        const destination = normalizeBonUrl(new URL(location, target).href);
        if (destination.sourceId !== originalSourceId) throw new Error('La redirección conduce a otro anuncio. Introduce su URL para revisarlo.');
        target = destination.url;
        continue;
      }
      if (!response.ok) throw new Error('No se pudo descargar el anuncio del BON.');
      if (!response.headers.get('content-type')?.includes('text/html'))
        throw new Error('Contenido no compatible: se requiere un anuncio HTML.');
      if (Number(response.headers.get('content-length')) > 2_000_000)
        throw new Error('El anuncio supera el tamaño de descarga permitido.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('El BON devolvió contenido vacío.');
      let size = 0;
      let result = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new Error('El anuncio supera el tamaño de descarga permitido.');
        }
        result += decoder.decode(value, { stream: true });
      }
      return result + decoder.decode();
    }
    throw new Error('El BON devuelve demasiadas redirecciones.');
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Se agotó el tiempo de descarga del BON.');
    if (error instanceof TypeError)
      throw new Error('No se pudo conectar con el BON. Inténtalo de nuevo.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
