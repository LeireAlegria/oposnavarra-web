import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RATE_LIMIT_COOKIE = 'oposnavarra_contact_rate_limit';
const RATE_LIMIT_MS = 30_000;

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(5000),
  honeypot: z.string().optional().or(z.literal('')).transform((value) => value ?? ''),
});

function buildError(message: string, errors?: Record<string, string>) {
  return NextResponse.json({ message, errors }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      const formattedErrors = Object.fromEntries(
        Object.entries(errors).map(([key, value]) => [key, value?.[0] ?? 'Campo no válido']),
      );

      return buildError('Revisa los campos del formulario.', formattedErrors);
    }

    if (body.honeypot && typeof body.honeypot === 'string' && body.honeypot.trim().length > 0) {
      return buildError('La solicitud no puede procesarse.');
    }

    const cookieStore = await cookies();
    const lastRequestValue = cookieStore.get(RATE_LIMIT_COOKIE)?.value;
    const lastRequestTimestamp = Number(lastRequestValue ?? '0');

    if (!Number.isNaN(lastRequestTimestamp) && Date.now() - lastRequestTimestamp < RATE_LIMIT_MS) {
      return NextResponse.json(
        { message: 'Debes esperar antes de volver a intentarlo.' },
        { status: 429 },
      );
    }

    const recipient = process.env.CONTACT_EMAIL_TO;
    const apiKey = process.env.RESEND_API_KEY;

    if (!recipient || !apiKey) {
      return NextResponse.json(
        {
          message:
            'El servicio de correo no está configurado. Contacta con el equipo de OposNavarra directamente.',
        },
        { status: 503 },
      );
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'OposNavarra <onboarding@resend.dev>',
        to: [recipient],
        reply_to: parsed.data.email,
        subject: `Consulta desde la web de OposNavarra: ${parsed.data.name}`,
        text: `Nombre: ${parsed.data.name}\nCorreo: ${parsed.data.email}\n\nMensaje:\n${parsed.data.message}`,
      }),
    });

    if (!emailResponse.ok) {
      return NextResponse.json(
        {
          message: 'No se pudo enviar la consulta. Inténtalo de nuevo en unos minutos.',
        },
        { status: 502 },
      );
    }

    cookieStore.set(RATE_LIMIT_COOKIE, String(Date.now()), {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 30,
    });

    return NextResponse.json({
      message: 'Tu consulta se ha enviado correctamente. En breve revisaremos tu mensaje.',
    });
  } catch {
    return NextResponse.json(
      {
        message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.',
      },
      { status: 500 },
    );
  }
}
