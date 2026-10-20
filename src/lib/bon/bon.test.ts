import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { draftSchema, normalizeBonUrl } from './draft';
import { downloadBon, extractBonDraft } from './extract';

const url = 'https://bon.navarra.es/es/anuncio/-/texto/2025/101/21/';
const html = readFileSync('src/lib/bon/fixtures/reference.html', 'utf8');

describe('BON extraction and review', () => {
  it('extracts the complete reference syllabus independently from the numbered bases', () => {
    const { draft, warnings } = extractBonDraft(html, url);
    expect(draft.blocks.map((block) => [block.name, block.topics.length])).toEqual([
      ['Actividad administrativa', 5],
      ['Normativa básica en la Administración de la Comunidad Foral de Navarra', 18],
      ['Informática', 4],
    ]);
    expect(draft.blocks.map((block) => block.topics[0].number)).toEqual([1, 1, 1]);
    expect(draft.blocks[1].topics[6].text).toContain(
      'Organización de la Administración de la Comunidad Foral de Navarra',
    );
    expect(draft.blocks[2].topics[3].text).toContain('cintas de opciones.');
    expect(draft.resolution).toBe('RESOLUCIÓN 1322/2025');
    expect(draft.announcementCode).toBe('F2507100');
    expect(draft.publicationDate).toBe('2025-05-22');
    expect(warnings).toEqual([]);
    expect(draftSchema.safeParse(draft).success).toBe(false);
    draft.reviewed = true;
    draft.blocks.forEach((block) =>
      block.topics.forEach((topic) => {
        topic.decision = 'new';
      }),
    );
    expect(draftSchema.safeParse(draft).success).toBe(true);
    draft.blocks[0].topics[1].number = 1;
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });
  it('canonicalizes languages, query parameters and trailing slash', () => {
    expect(normalizeBonUrl(url.replace('/es/', '/eu/').slice(0, -1) + '?tracking=1#top')).toEqual(
      normalizeBonUrl(url),
    );
    for (const invalid of [
      'http://bon.navarra.es/es/anuncio/-/texto/2025/101/21',
      'https://bon.navarra.es.evil.org/es/anuncio/-/texto/2025/101/21',
      'https://user@bon.navarra.es/es/anuncio/-/texto/2025/101/21',
      'https://bon.navarra.es/a.pdf',
    ])
      expect(() => normalizeBonUrl(invalid)).toThrow();
  });
  it('uses General and preserves continuation paragraphs', () => {
    const result = extractBonDraft(
      '<p class="a-titulo">Convocatoria</p><p class="contenido"><p>ANEXO II</p><p>Temario</p><p>Tema 1.–Contenido íntegro.</p><p>Continuación adicional.</p><p>ANEXO III</p><p>Otro contenido</p><p>Código del anuncio: X</p>',
      url,
    );
    expect(result.draft.blocks[0].name).toBe('General');
    expect(result.draft.blocks[0].topics[0].text).toBe(
      'Contenido íntegro.\nContinuación adicional.',
    );
  });
  it('reports absent and ambiguous syllabuses and rejects corrections', () => {
    expect(
      extractBonDraft('<p class="a-titulo">Convocatoria</p><p class="contenido"><p>Bases</p>', url)
        .warnings.length,
    ).toBeGreaterThan(0);
    expect(() =>
      extractBonDraft('<p class="a-titulo">Corrección de errores de convocatoria</p>', url),
    ).toThrow('no están soportadas');
    expect(
      extractBonDraft(
        '<p class="a-titulo">Convocatoria</p><p class="contenido"><p>Temario</p><p>Tema 1.–A</p><p>Temario</p><p>Tema 1.–B</p>',
        url,
      ).warnings.length,
    ).toBeGreaterThan(0);
  });
  it('rejects external redirects and limits streamed downloads and content types', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: 'https://example.org/' } }),
      );
    await expect(downloadBon(url, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      downloadBon(
        url,
        vi
          .fn()
          .mockResolvedValue(
            new Response('PDF', { headers: { 'Content-Type': 'application/pdf' } }),
          ),
      ),
    ).rejects.toThrow('Contenido no compatible');
    await expect(
      downloadBon(
        url,
        vi
          .fn()
          .mockResolvedValue(
            new Response('x'.repeat(2_000_001), { headers: { 'Content-Type': 'text/html' } }),
          ),
      ),
    ).rejects.toThrow('tamaño');
  });
});
