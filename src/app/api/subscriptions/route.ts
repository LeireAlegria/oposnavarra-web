import { NextResponse } from 'next/server';

import { abandonPendingSubscription, getCurrentUserSubscription } from '@/lib/subscriptions';

export async function GET() {
  const subscription = await getCurrentUserSubscription();

  if (!subscription) {
    return NextResponse.json({ subscription: null }, { status: 200 });
  }

  return NextResponse.json({ subscription }, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { action?: 'cancel' | 'abandon' };

    if (body.action === 'cancel') {
      return NextResponse.json(
        { message: 'Gestiona la cancelación de renovación desde el portal de Stripe.' },
        { status: 409 },
      );
    }

    if (body.action === 'abandon') {
      const result = await abandonPendingSubscription();
      if (!result.ok) {
        return NextResponse.json({ message: result.error ?? 'No se pudo abandonar la contratación.' }, { status: 400 });
      }
      return NextResponse.json({ subscription: result.subscription }, { status: 200 });
    }

    return NextResponse.json({ message: 'Acción no soportada.' }, { status: 400 });
  } catch {
    return NextResponse.json({ message: 'No se pudo completar la acción.' }, { status: 400 });
  }
}
