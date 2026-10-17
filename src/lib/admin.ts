import { createClient } from '@/lib/supabase/server';

export type AdminSummary = {
  convocatorias: number;
  temas: number;
  examenes: number;
  preguntas: number;
  usuarios: number;
  planes: number;
  suscripciones: number;
};

const fallbackSummary: AdminSummary = {
  convocatorias: 3,
  temas: 8,
  examenes: 2,
  preguntas: 64,
  usuarios: 12,
  planes: 3,
  suscripciones: 7,
};

export async function getAdminSummary(): Promise<AdminSummary> {
  const supabase = await createClient();

  try {
    const [convocatorias, temas, examenes, preguntas, perfiles, planes, suscripciones] = await Promise.all([
      supabase.from('convocatorias').select('id', { count: 'exact', head: true }),
      supabase.from('temas').select('id', { count: 'exact', head: true }),
      supabase.from('examenes').select('id', { count: 'exact', head: true }),
      supabase.from('preguntas').select('id', { count: 'exact', head: true }),
      supabase.from('perfiles').select('id', { count: 'exact', head: true }),
      supabase.from('planes').select('id', { count: 'exact', head: true }),
      supabase.from('suscripciones').select('id', { count: 'exact', head: true }),
    ]);

    return {
      convocatorias: convocatorias.count ?? fallbackSummary.convocatorias,
      temas: temas.count ?? fallbackSummary.temas,
      examenes: examenes.count ?? fallbackSummary.examenes,
      preguntas: preguntas.count ?? fallbackSummary.preguntas,
      usuarios: perfiles.count ?? fallbackSummary.usuarios,
      planes: planes.count ?? fallbackSummary.planes,
      suscripciones: suscripciones.count ?? fallbackSummary.suscripciones,
    };
  } catch {
    return fallbackSummary;
  }
}
