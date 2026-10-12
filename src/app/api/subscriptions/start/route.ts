import { NextResponse } from 'next/server';

import { startPendingSubscription } from '@/lib/subscriptions';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { planId?: string };

    if (!body.planId) {
      return NextResponse.json({ message: 'Falta el identificador del plan.' }, { status: 400 });
    }

    const result = await startPendingSubscription(body.planId);

    if (!result.ok) {
      const status = result.error?.toLowerCase().includes('sesión')
        ? 401
        : result.error?.toLowerCase().includes('verificar')
          ? 403
          : 400;
      return NextResponse.json({ message: result.error ?? 'No se pudo iniciar la contratación.' }, { status });
    }

    return NextResponse.json({ subscription: result.subscription }, { status: 200 });
  } catch {
    return NextResponse.json({ message: 'La contratación todavía no está disponible.' }, { status: 503 });
  }
}
