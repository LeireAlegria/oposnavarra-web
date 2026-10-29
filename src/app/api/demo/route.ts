import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createPrivilegedClient } from '@/lib/supabase/privileged';

const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal('restore'), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal('claim'), token: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z
    .object({
      action: z.literal('answer'),
      token: z.string().regex(/^[a-f0-9]{64}$/),
      position: z.number().int().min(0).max(4),
      option: z.string().uuid(),
    })
    .strict(),
]);
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return NextResponse.json({ message: 'Solicitud no válida.' }, { status: 403, headers });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Solicitud no válida.' }, { status: 400, headers });
    }
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ message: 'Solicitud no válida.' }, { status: 400, headers });
    const input = parsed.data;
    const hash = createHash('sha256').update(input.token).digest('hex');
    let result;
    if (input.action === 'restore' || input.action === 'claim') {
      const client = await createClient();
      result = await client.rpc(input.action === 'claim' ? 'demo_claim' : 'demo_restore', {
        p_token: input.token,
      });
    } else {
      const header = process.env.DEMO_IP_HEADER || process.env.CONTACT_IP_HEADER;
      const ip = header ? request.headers.get(header)?.trim() : null;
      if (!ip || !isIP(ip))
        return NextResponse.json(
          {
            message: 'La prueba no está disponible en este momento. Vuelve a intentarlo más tarde.',
          },
          { status: 503, headers },
        );
      const fingerprint = createHash('sha256')
        .update(isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip)
        .digest('hex');
      const client = createPrivilegedClient();
      result =
        input.action === 'start'
          ? await client.rpc('demo_start', { p_hash: hash, p_origin: fingerprint })
          : await client.rpc('demo_answer', {
              p_hash: hash,
              p_origin: fingerprint,
              p_position: input.position,
              p_option: input.option,
            });
    }
    if (result.error) {
      const code = result.error.code;
      return NextResponse.json(
        {
          message:
            code === 'P0001'
              ? 'Has alcanzado el límite de solicitudes. Espera una hora antes de volver a intentarlo.'
              : code === '22023'
                ? result.error.message
                : code === '42501'
                  ? 'Inicia sesión para guardar el resultado.'
                  : 'No se pudo completar la operación. Conservamos tu avance; vuelve a intentarlo.',
        },
        {
          status: code === 'P0001' ? 429 : code === '22023' ? 400 : code === '42501' ? 401 : 503,
          headers: { ...headers, ...(code === 'P0001' ? { 'Retry-After': '3600' } : {}) },
        },
      );
    }
    return NextResponse.json(result.data, { headers });
  } catch {
    return NextResponse.json(
      { message: 'No se pudo conectar. Vuelve a intentarlo; tu selección se conserva.' },
      { status: 503, headers },
    );
  }
}
