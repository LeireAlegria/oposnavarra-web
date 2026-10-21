import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createQuestionTemplate, parseQuestionWorkbook } from '@/lib/question-import/workbook';
import { MAX_IMPORT_BYTES, reviewRows, type ImportCatalog } from '@/lib/question-import/model';

export const runtime = 'nodejs';
const settingsSchema = z
  .object({
    origin: z.enum(['examen_oficial', 'generada_documentacion']),
    reference: z.string().trim().max(32767),
    examId: z.string().uuid().nullable(),
  })
  .refine((value) => value.origin !== 'examen_oficial' || value.examId, {
    message: 'Selecciona el examen de destino para las preguntas oficiales.',
  });
const decisionsSchema = z
  .array(
    z.object({
      rowNumber: z.number().int().min(2),
      included: z.boolean(),
      topicId: z.string().uuid().nullable(),
      topicResolved: z.boolean(),
      duplicateAccepted: z.boolean(),
    }),
  )
  .max(1000);
const duplicateSnapshotsSchema = z
  .array(
    z.object({
      rowNumber: z.number().int(),
      ids: z.array(z.string().uuid()),
      versions: z.array(z.object({ id: z.string().uuid(), version: z.string() })),
    }),
  )
  .max(1000);
const topicSnapshotsSchema = z
  .array(
    z.object({ id: z.string().uuid(), nombre: z.string(), descripcion: z.string().nullable() }),
  )
  .max(1000);
async function adminClient() {
  const client = await createClient();
  const { data, error } = await client.rpc('es_admin_actual');
  return !error && data === true ? client : null;
}
export async function GET() {
  if (!(await adminClient()))
    return NextResponse.json(
      { message: 'Solo los administradores pueden descargar la plantilla.' },
      { status: 403 },
    );
  const buffer = await createQuestionTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-preguntas.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
export async function POST(request: Request) {
  const client = await adminClient();
  if (!client)
    return NextResponse.json(
      { message: 'Solo los administradores pueden importar preguntas.' },
      { status: 403 },
    );
  try {
    // Bound multipart parsing even when Content-Length is absent or untrusted.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Selecciona un archivo .xlsx.');
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 7 * 1024 * 1024) {
        await reader.cancel();
        throw new Error(
          'La solicitud supera el tamaño permitido. El Excel debe tener hasta 5 MiB.',
        );
      }
      chunks.push(value);
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? '' },
      body,
    }).formData();
    const settings = settingsSchema.safeParse(JSON.parse(String(form.get('settings'))));
    if (!settings.success)
      throw new Error(
        'Completa la procedencia y selecciona un examen existente cuando sea obligatorio.',
      );
    const file = form.get('file');
    if (
      !(file instanceof File) ||
      !/\.xlsx$/i.test(file.name) ||
      file.size < 1 ||
      file.size > MAX_IMPORT_BYTES ||
      form.getAll('file').length !== 1
    )
      throw new Error('Selecciona un único archivo .xlsx de hasta 5 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const rows = await parseQuestionWorkbook(bytes, !!settings.data.examId);
    const action = form.get('action');
    if (action === 'preview') {
      const { data, error } = await client.rpc('revisar_importacion_preguntas_admin', {
        p_examen_id: settings.data.examId,
        p_filas: rows.map((row) => ({
          rowNumber: row.rowNumber,
          text: row.text,
          options: row.options,
        })),
      });
      if (error)
        throw new Error(
          error.code === 'PGRST202'
            ? 'La importación aún no está disponible. Aplica la migración 013.'
            : 'No se pudo revisar el banco. Comprueba que el examen existe y reintenta.',
        );
      return NextResponse.json(
        { rows, catalog: data },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (action !== 'confirm') throw new Error('Operación no admitida.');
    const decisions = decisionsSchema.safeParse(JSON.parse(String(form.get('decisions'))));
    const snapshots = duplicateSnapshotsSchema.safeParse(
      JSON.parse(String(form.get('duplicateSnapshots'))),
    );
    const operationId = z.string().uuid().safeParse(form.get('operationId'));
    const topicSnapshots = topicSnapshotsSchema.safeParse(
      JSON.parse(String(form.get('topicSnapshots'))),
    );
    if (
      !topicSnapshots.success ||
      !decisions.success ||
      !snapshots.success ||
      !operationId.success ||
      form.get('reviewed') !== 'true'
    )
      throw new Error('Revisa todas las decisiones y confirma el resumen antes de importar.');
    if (
      decisions.data.length !== rows.length ||
      new Set(decisions.data.map((decision) => decision.rowNumber)).size !== rows.length ||
      rows.some((row) => !decisions.data.some((decision) => decision.rowNumber === row.rowNumber))
    )
      throw new Error('La revisión no corresponde al archivo. Vuelve a subirlo.');
    const includedRows = rows.filter(
      (row) => decisions.data.find((decision) => decision.rowNumber === row.rowNumber)?.included,
    );
    if (!includedRows.length) throw new Error('Incluye al menos una fila para importar.');
    // Re-parse and validate all included content, never trusting browser row values or formula caches.
    const catalog: ImportCatalog = {
      topics: [],
      duplicates: [],
      occupiedNumbers: [],
      examName: null,
      convocationNames: [],
    };
    const reviewed = reviewRows({ rows, catalog }, decisions.data, !!settings.data.examId);
    const blocking = reviewed.find(
      (item) =>
        item.decision?.included &&
        (item.issues.length || item.pendingTopic || item.pendingDuplicate),
    );
    if (blocking)
      throw new Error(
        `Fila ${blocking.row.rowNumber}: ${blocking.issues[0]?.column ?? 'tema o duplicado'}: ${blocking.issues[0]?.message ?? 'resuelve las decisiones pendientes.'}`,
      );
    const payload = {
      ...settings.data,
      fileHash: createHash('sha256').update(bytes).digest('hex'),
      totalRows: rows.length,
      reviewed: true,
      rows: includedRows.map((row) => {
        const decision = decisions.data.find((item) => item.rowNumber === row.rowNumber)!;
        return {
          rowNumber: row.rowNumber,
          number: row.number,
          text: row.text,
          options: row.options,
          correctAnswer: row.correctAnswer,
          explanation: row.explanation,
          topicId: decision.topicId,
          topicResolved: decision.topicResolved,
          duplicateAccepted: decision.duplicateAccepted,
          duplicateIds: snapshots.data.find((item) => item.rowNumber === row.rowNumber)?.ids ?? [],
          duplicateVersions:
            snapshots.data.find((item) => item.rowNumber === row.rowNumber)?.versions ?? [],
          topicSnapshot: topicSnapshots.data.find((topic) => topic.id === decision.topicId) ?? null,
        };
      }),
    };
    const { data, error } = await client.rpc('confirmar_importacion_preguntas_admin', {
      p_clave: operationId.data,
      p_datos: payload,
    });
    if (error) {
      if (!error.code || /^(PGRST00|5)/.test(error.code)) {
        return NextResponse.json(
          {
            message:
              'No se pudo recuperar el resultado. Reintenta la misma confirmación para comprobar la operación.',
            uncertain: true,
          },
          { status: 503 },
        );
      }
      const diagnosticCode = /^[A-Z0-9]{5,8}$/.test(error.code) ? error.code : 'UNKNOWN';
      console.error('[question-import] Confirmation rejected', { code: diagnosticCode });
      const knownMessages: Record<string, string> = {
        PGRST202:
          'La base de datos no tiene disponible la operación de importación. Revisa las migraciones pendientes de Supabase.',
        '42501':
          'No tienes permisos para confirmar la importación. Comprueba tu sesión y los permisos de administrador.',
        '23505':
          'Se ha encontrado un registro repetido. Si elegiste un examen, comprueba que sus números de pregunta siguen libres y vuelve a revisar el archivo.',
        '23503':
          'Una referencia del lote ya no está disponible. Comprueba el examen y los temas seleccionados y vuelve a revisar el archivo.',
      };
      const safeMessage =
        error.code === '22023' &&
        /^(Fila \d+:|La clave de confirmación|El examen ya no existe)/.test(error.message)
          ? error.message
          : (knownMessages[error.code] ??
            `No se pudo importar el lote completo (código ${diagnosticCode}). La base de datos rechazó la operación y no se han guardado preguntas parciales.`);
      return NextResponse.json(
        { message: safeMessage, needsReview: true, errorCode: diagnosticCode },
        { status: 409 },
      );
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof SyntaxError
            ? 'La solicitud no es válida. Vuelve a revisar el archivo.'
            : error instanceof TypeError
              ? 'No se pudo procesar la solicitud. Comprueba el archivo y la conexión e inténtalo de nuevo.'
              : error instanceof Error
                ? error.message
                : 'No se pudo procesar el archivo.',
      },
      { status: 400 },
    );
  }
}
