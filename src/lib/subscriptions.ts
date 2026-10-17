import { hasSupabaseConfig } from './supabase/config';
import { createClient } from './supabase/server';

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  durationMonths: number;
  currency: string;
  active: boolean;
  order: number;
  description: string;
  renewal: string;
};

export type SubscriptionRecord = {
  id: string;
  usuario_id: string;
  plan_id: string;
  estado: 'pendiente' | 'activa' | 'vencida' | 'cancelada';
  precio_centimos: number;
  moneda: string;
  duracion_meses: number;
  periodo_inicio: string | null;
  periodo_fin: string | null;
  cancelar_al_final_del_periodo: boolean;
  cancelacion_solicitada_at: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  stripe_mode?: 'test' | 'live' | null;
  payment_issue?: string | null;
  access_revoked_at?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getPublicPlans(): Promise<SubscriptionPlan[]> {
  if (!hasSupabaseConfig()) {
    throw new Error('El catálogo de planes no está disponible.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('listar_planes_activos');

  if (error || !data) {
    throw new Error('El catálogo de planes no está disponible.');
  }

  const planRows = data as Array<{
    id: string;
    codigo: string;
    nombre: string;
    precio_centimos: number;
    moneda: string;
    duracion_meses: number;
    activo: boolean;
    orden: number;
  }>;

  return planRows.map((plan) => ({
    id: plan.id,
    code: plan.codigo,
    name: plan.nombre,
    priceCents: Number(plan.precio_centimos),
    durationMonths: Number(plan.duracion_meses),
    currency: plan.moneda,
    active: Boolean(plan.activo),
    order: Number(plan.orden),
    description: `Acceso ${plan.nombre.toLowerCase()} a todas las convocatorias disponibles.`,
    renewal:
      plan.duracion_meses === 1
        ? 'Automática cada mes'
        : plan.duracion_meses === 6
          ? 'Automática cada 6 meses'
          : 'Automática cada año',
  }));
}

export async function getCurrentUserSubscription(): Promise<SubscriptionRecord | null> {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data, error } = await supabase.rpc('consultar_mi_suscripcion');

    if (error || !data) {
      return null;
    }

    return data as SubscriptionRecord;
  } catch {
    return null;
  }
}

export async function startPendingSubscription(planId: string): Promise<{ ok: boolean; subscription?: SubscriptionRecord; error?: string }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: 'La contratación todavía no está disponible.' };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, error: 'Debes iniciar sesión para continuar.' };
    }

    if (!user.email_confirmed_at) {
      return { ok: false, error: 'Debes verificar tu correo antes de continuar.' };
    }

    const { data, error } = await supabase.rpc('iniciar_contratacion', { p_plan_id: planId });

    if (error) {
      return { ok: false, error: error.message || 'No se pudo iniciar la contratación.' };
    }

    return { ok: true, subscription: data as SubscriptionRecord };
  } catch {
    return { ok: false, error: 'La contratación todavía no está disponible.' };
  }
}

export async function abandonPendingSubscription(): Promise<{ ok: boolean; error?: string; subscription?: SubscriptionRecord }> {
  if (!hasSupabaseConfig()) {
    return { ok: false, error: 'No hay una contratación pendiente para abandonar.' };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('abandonar_contratacion_pendiente');

    if (error) {
      return { ok: false, error: error.message || 'No se pudo abandonar la contratación.' };
    }

    return { ok: true, subscription: data as SubscriptionRecord };
  } catch {
    return { ok: false, error: 'No hay una contratación pendiente para abandonar.' };
  }
}

export async function hasActiveSubscriptionAccess(): Promise<boolean> {
  if (!hasSupabaseConfig()) {
    return false;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return false;
    }

    const { data, error } = await supabase.rpc('comprobar_acceso_suscripcion', {
      p_usuario_id: user.id,
    });

    if (error) {
      return false;
    }

    return Boolean(data);
  } catch {
    return false;
  }
}
