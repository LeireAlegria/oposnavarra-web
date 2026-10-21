import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { draftSchema, normalizeBonUrl } from '@/lib/bon/draft';
import { downloadBon, extractBonDraft } from '@/lib/bon/extract';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: admin, error: authError } = await supabase.rpc('es_admin_actual');
  if (authError || !admin)
    return NextResponse.json(
      { message: 'Solo los administradores pueden importar convocatorias.' },
      { status: 403 },
    );
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 2_500_000) throw new Error();
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw new Error();
  } catch {
    return NextResponse.json(
      { message: 'La solicitud no es válida o supera el tamaño permitido.' },
      { status: 400 },
    );
  }
  if (body.action === 'extract') {
    try {
      const source = normalizeBonUrl(z.string().parse(body.url));
      const { data: existing, error } = await supabase
        .from('convocatorias')
        .select('id, nombre')
        .eq('origen_bon_id', source.sourceId)
        .maybeSingle();
      if (error)
        return NextResponse.json(
          {
            message:
              'No se pudo comprobar el origen. Comprueba que la migración 012 está aplicada.',
          },
          { status: 503 },
        );
      if (existing)
        return NextResponse.json(
          { message: 'El anuncio ya está importado.', existingId: existing.id },
          { status: 409 },
        );
      const result = extractBonDraft(await downloadBon(source.url), source.url);
      const { data: manual, error: manualError } = await supabase
        .from('convocatorias')
        .select('id, nombre')
        .is('origen_bon_id', null);
      if (manualError) throw new Error('No se pudieron comprobar las convocatorias manuales.');
      const words = result.draft.name.toLowerCase().match(/[a-záéíóúñ]{5,}/g) ?? [];
      const candidates = (manual ?? []).filter((item) =>
        words.some((word) => item.nombre.toLowerCase().includes(word)),
      );
      if (candidates.length)
        result.warnings.push(
          `Revisa posibles convocatorias manuales coincidentes: ${candidates.map((item) => item.nombre).join('; ')}. No se fusionarán.`,
        );
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        {
          message:
            error instanceof z.ZodError
              ? 'Introduce una URL del BON.'
              : error instanceof Error
                ? error.message
                : 'No se pudo extraer el anuncio.',
        },
        { status: 400 },
      );
    }
  }
  if (body.action === 'confirm') {
    const parsed = draftSchema.safeParse(body.draft);
    const operation = z.string().uuid().safeParse(body.operationId);
    if (!parsed.success || !operation.success)
      return NextResponse.json(
        { message: parsed.error?.issues.find((issue) => issue.code === 'custom')?.message ?? 'Revisa los campos obligatorios, el contenido de los temas y la clave de operación.' },
        { status: 400 },
      );
    const { data, error } = await supabase.rpc('confirmar_importacion_bon_admin', {
      p_operacion_id: operation.data,
      p_borrador: parsed.data,
    });
    if (error) {
      const { data: existing } = await supabase
        .from('convocatorias')
        .select('id')
        .eq('origen_bon_id', parsed.data.sourceId)
        .maybeSingle();
      return NextResponse.json(
        {
          message: existing
            ? 'El anuncio ya está importado.'
            : 'No se pudo guardar la importación. Revisa los datos y los temas vinculados; el borrador se conserva.',
          existingId: existing?.id,
        },
        { status: existing ? 409 : 400 },
      );
    }
    return NextResponse.json({ id: data });
  }
  return NextResponse.json({ message: 'Operación no admitida.' }, { status: 400 });
}
