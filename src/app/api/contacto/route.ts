import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createPrivilegedClient } from '@/lib/supabase/privileged';
import { getContactIp } from '@/lib/contact-origin';

const contactSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Introduce tu nombre.')
      .max(120, 'El nombre admite hasta 120 caracteres.'),
    email: z
      .string()
      .trim()
      .email('Introduce un correo electrónico válido.')
      .max(254, 'El correo admite hasta 254 caracteres.'),
    message: z
      .string()
      .trim()
      .min(1, 'Introduce un mensaje.')
      .max(5000, 'El mensaje admite hasta 5.000 caracteres.'),
    honeypot: z.string().max(0).optional(),
  })
  .strict();

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Revisa los campos del formulario.' }, { status: 400 });
  }
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Revisa los campos del formulario.',
        errors: Object.fromEntries(
          Object.entries(parsed.error.flatten().fieldErrors).map(([key, value]) => [
            key,
            value?.[0],
          ]),
        ),
      },
      { status: 400 },
    );
  }
  try {
    const ip = getContactIp(request);
    if (!ip)
      return NextResponse.json(
        { message: 'No se pudo guardar tu consulta. Inténtalo de nuevo más tarde.' },
        { status: 503 },
      );
    const client = createPrivilegedClient();
    const { error } = await client.rpc('guardar_mensaje_contacto', {
      p_nombre: parsed.data.name,
      p_email: parsed.data.email,
      p_mensaje: parsed.data.message,
      p_ip_hash: createHash('sha256').update(ip).digest('hex'),
    });
    if (error)
      return NextResponse.json(
        {
          message:
            error.code === 'P0001'
              ? 'Debes esperar quince minutos antes de volver a intentarlo.'
              : 'No se pudo guardar el mensaje. Inténtalo de nuevo.',
        },
        { status: error.code === 'P0001' ? 429 : 503 },
      );
    return NextResponse.json({
      message: 'Hemos recibido tu mensaje. Gracias por contactar con OposNavarra.',
    });
  } catch {
    return NextResponse.json(
      { message: 'No se pudo guardar el mensaje. Inténtalo de nuevo.' },
      { status: 503 },
    );
  }
}
