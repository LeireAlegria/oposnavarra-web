'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { BonImport } from '@/components/bon-import';
import { QuestionImport } from '@/components/question-import';
import { ConvocationBlocks } from '@/components/convocation-blocks';
import { getAdminUserEmails } from '@/lib/admin-user-emails';

function CatalogTable({
  label,
  columns,
  empty,
  children,
}: {
  label: string;
  columns: string[];
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto rounded-2xl border border-[#e5e1d8] bg-white focus-visible:outline-2 focus-visible:outline-[#bd3734]"
    >
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-[#77756e]">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-5 py-4 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e5e1d8]">
          {empty ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center text-[#77756e]">
                No hay resultados. Prueba otra búsqueda o crea un registro.
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

type SectionKey =
  | 'resumen'
  | 'convocatorias'
  | 'temas'
  | 'examenes'
  | 'preguntas'
  | 'usuarios'
  | 'suscripciones'
  | 'planes';

type Convocatoria = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  organismo_convocante?: string | null;
  ambito?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  fuente_oficial_url?: string | null;
  informacion_url?: string | null;
  activo?: boolean;
  created_at?: string;
  updated_at?: string;
  convocatoria_tema?: Array<{ count: number }>;
  convocatoria_examen?: Array<{ count: number }>;
};

type ConvocatoriaTema = {
  convocatoria_id: string;
  tema_id: string;
  numero: number;
  orden: number;
};

type ConvocatoriaExamen = {
  convocatoria_id: string;
  examen_id: string;
};

type Tema = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  created_at?: string;
};

type Examen = {
  id: string;
  nombre: string;
  fecha?: string | null;
  descripcion?: string | null;
  url_examen?: string | null;
  url_plantilla_respuestas?: string | null;
  es_oficial?: boolean;
  created_at?: string;
};

type Respuesta = {
  id?: string;
  orden: number;
  texto: string;
  es_correcta: boolean;
};

type Pregunta = {
  id: string;
  enunciado: string;
  numero?: number | null;
  explicacion?: string | null;
  fuente_url?: string | null;
  referencia_fuente?: string | null;
  estado?: string;
  origen?: string;
  situacion?: string;
  examen_id?: string | null;
  created_at?: string;
  respuestas?: Respuesta[];
  pregunta_tema?: Array<{ tema_id: string }>;
};

type Perfil = {
  id: string;
  email: string | null;
  last_sign_in_at: string | null;
  rol?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Plan = {
  id: string;
  codigo: string;
  nombre: string;
  moneda?: string;
  activo?: boolean;
  precio_centimos?: number;
  duracion_meses?: number;
  orden?: number;
};

type Suscripcion = {
  id: string;
  usuario_id: string;
  userEmail?: string | null;
  estado?: string;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  plan_id?: string | null;
  precio_centimos?: number;
  duracion_meses?: number;
  cancelar_al_final_del_periodo?: boolean;
  planes?: { nombre?: string | null } | null;
};

type QuestionForm = {
  enunciado: string;
  numero: string;
  explicacion: string;
  fuente_url: string;
  estado: 'revision' | 'publicada' | 'desactivada';
  origen: 'propia' | 'oficial';
  situacion: 'ordinaria' | 'reserva' | 'anulada';
  examen_id: string;
  answers: Respuesta[];
  topicIds: string[];
};

const emptyQuestionForm: QuestionForm = {
  enunciado: '',
  numero: '',
  explicacion: '',
  fuente_url: '',
  estado: 'revision',
  origen: 'propia',
  situacion: 'ordinaria',
  examen_id: '',
  answers: [
    { orden: 1, texto: '', es_correcta: false },
    { orden: 2, texto: '', es_correcta: false },
    { orden: 3, texto: '', es_correcta: false },
    { orden: 4, texto: '', es_correcta: false },
  ],
  topicIds: [],
};

const sectionLabels: Record<SectionKey, string> = {
  resumen: 'Vista general',
  convocatorias: 'Convocatorias',
  temas: 'Temas',
  examenes: 'Exámenes',
  preguntas: 'Banco de preguntas',
  usuarios: 'Usuarios',
  suscripciones: 'Suscripciones',
  planes: 'Planes',
};

const PAGE_SIZE = 8;

function getPageItems<T>(items: T[], page: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;

  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: safePage,
    pageCount,
  };
}

function formatUserDate(value: string | null | undefined, fallback: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return fallback;
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));
}

export function AdminConsole({ adminEmail }: { adminEmail: string }) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionKey>('resumen');
  const [importExamFilter, setImportExamFilter] = useState('');
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('todos');
  const [planFilter, setPlanFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [convocatoriaTemas, setConvocatoriaTemas] = useState<ConvocatoriaTema[]>([]);
  const [convocatoriaExamenes, setConvocatoriaExamenes] = useState<ConvocatoriaExamen[]>([]);
  const [managedConvocatoriaId, setManagedConvocatoriaId] = useState<string | null>(null);
  const [managedExamIds, setManagedExamIds] = useState<string[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [stats, setStats] = useState({
    convocatorias: 0,
    temas: 0,
    examenes: 0,
    preguntas: 0,
    usuarios: 0,
    suscripcionesActivas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [remoteCounts, setRemoteCounts] = useState({ preguntas: 0, usuarios: 0, suscripciones: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);
  const [catalogView, setCatalogView] = useState<'list' | 'form'>('list');
  const catalogHeadingRef = useRef<HTMLHeadingElement>(null);
  const [editingConvocatoriaId, setEditingConvocatoriaId] = useState<string | null>(null);
  const [editingTemaId, setEditingTemaId] = useState<string | null>(null);
  const topicNameRef = useRef<HTMLInputElement>(null);
  const [topicConvocationFilter, setTopicConvocationFilter] = useState('all');
  const [topicConvocatoriaId, setTopicConvocatoriaId] = useState('');
  const [topicNumero, setTopicNumero] = useState('1');
  const [topicOrden, setTopicOrden] = useState('1');
  const [editingExamenId, setEditingExamenId] = useState<string | null>(null);
  const [editingPreguntaId, setEditingPreguntaId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const now = new Date().toISOString();
      const [
        convocatoriasResult,
        convocatoriaTemasResult,
        convocatoriaExamenesResult,
        temasResult,
        examenesResult,
        preguntasResult,
        perfilesResult,
        planesResult,
        suscripcionesResult,
        convocatoriasCountResult,
        temasCountResult,
        examenesCountResult,
        preguntasCountResult,
        perfilesCountResult,
        activeSubscriptionsCountResult,
      ] = await Promise.all([
        supabase
          .from('convocatorias')
          .select('*, convocatoria_tema(count), convocatoria_examen(count)')
          .order('created_at', { ascending: false }),
        supabase.from('convocatoria_tema').select('convocatoria_id, tema_id, numero, orden'),
        supabase.from('convocatoria_examen').select('convocatoria_id, examen_id'),
        supabase.from('temas').select('*').order('created_at', { ascending: false }),
        supabase.from('examenes').select('*').order('created_at', { ascending: false }),
        supabase
          .from('preguntas')
          .select('*, respuestas(*), pregunta_tema(tema_id)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase
          .rpc('list_admin_users', {}, { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id')
          .range(0, PAGE_SIZE - 1),
        supabase.from('planes').select('*').order('orden', { ascending: true }),
        supabase
          .from('suscripciones')
          .select('*, planes(nombre)', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1),
        supabase.from('convocatorias').select('id', { count: 'exact', head: true }),
        supabase.from('temas').select('id', { count: 'exact', head: true }),
        supabase.from('examenes').select('id', { count: 'exact', head: true }),
        supabase.from('preguntas').select('id', { count: 'exact', head: true }),
        supabase.from('perfiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('suscripciones')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'activa')
          .lte('periodo_inicio', now)
          .gt('periodo_fin', now),
      ]);

      if (convocatoriasResult.error) throw convocatoriasResult.error;
      if (convocatoriaTemasResult.error) throw convocatoriaTemasResult.error;
      if (convocatoriaExamenesResult.error) throw convocatoriaExamenesResult.error;
      if (temasResult.error) throw temasResult.error;
      if (examenesResult.error) throw examenesResult.error;
      if (preguntasResult.error) throw preguntasResult.error;
      if (perfilesResult.error) throw perfilesResult.error;
      if (planesResult.error) throw planesResult.error;
      if (suscripcionesResult.error) throw suscripcionesResult.error;
      const countErrors = [
        convocatoriasCountResult.error,
        temasCountResult.error,
        examenesCountResult.error,
        preguntasCountResult.error,
        perfilesCountResult.error,
        activeSubscriptionsCountResult.error,
      ];
      const countError = countErrors.find(Boolean);
      if (countError) throw countError;

      setConvocatorias((convocatoriasResult.data ?? []) as Convocatoria[]);
      setConvocatoriaTemas((convocatoriaTemasResult.data ?? []) as ConvocatoriaTema[]);
      setConvocatoriaExamenes((convocatoriaExamenesResult.data ?? []) as ConvocatoriaExamen[]);
      setTemas((temasResult.data ?? []) as Tema[]);
      setExamenes((examenesResult.data ?? []) as Examen[]);
      setPreguntas((preguntasResult.data ?? []) as Pregunta[]);
      setPerfiles((perfilesResult.data ?? []) as Perfil[]);
      setPlanes((planesResult.data ?? []) as Plan[]);
      const subscriptions = (suscripcionesResult.data ?? []) as Suscripcion[];
      const { emails, error: emailsError } = await getAdminUserEmails(
        supabase,
        subscriptions.map((item) => item.usuario_id),
      );
      if (emailsError) throw emailsError;
      setSuscripciones(
        subscriptions.map((item) => ({ ...item, userEmail: emails.get(item.usuario_id) })),
      );
      setStats({
        convocatorias: convocatoriasCountResult.count ?? 0,
        temas: temasCountResult.count ?? 0,
        examenes: examenesCountResult.count ?? 0,
        preguntas: preguntasCountResult.count ?? 0,
        usuarios: perfilesCountResult.count ?? 0,
        suscripcionesActivas: activeSubscriptionsCountResult.count ?? 0,
      });
      setRemoteCounts({
        preguntas: preguntasResult.count ?? 0,
        usuarios: perfilesResult.count ?? 0,
        suscripciones: suscripcionesResult.count ?? 0,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo cargar el panel de administración.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (
      loading ||
      (activeSection !== 'preguntas' &&
        activeSection !== 'usuarios' &&
        activeSection !== 'suscripciones')
    ) {
      setListLoading(false);
      return;
    }

    let cancelled = false;
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    setListLoading(true);

    async function loadCurrentPage() {
      if (activeSection === 'preguntas') {
        let request = supabase
          .from('preguntas')
          .select('*, respuestas(*), pregunta_tema(tema_id)', { count: 'exact' })
          .order('created_at', { ascending: false });
        if (searchTerm.trim()) request = request.ilike('enunciado', `%${searchTerm.trim()}%`);
        if (activeFilter !== 'todos') request = request.eq('estado', activeFilter);
        if (importExamFilter) request = request.eq('examen_id', importExamFilter);
        const { data, count, error } = await request.range(from, to);
        if (cancelled) return;
        if (error) {
          setErrorMessage('No se pudo cargar la página de preguntas. Inténtalo de nuevo.');
        } else {
          setPreguntas((data ?? []) as Pregunta[]);
          setRemoteCounts((current) => ({ ...current, preguntas: count ?? 0 }));
          setErrorMessage('');
        }
      } else if (activeSection === 'usuarios') {
        let request = supabase
          .rpc('list_admin_users', {}, { count: 'exact' })
          .order('created_at', { ascending: false });
        if (activeFilter !== 'todos') request = request.eq('rol', activeFilter);
        if (searchTerm.trim()) {
          request = request.ilike('email', '%' + searchTerm.trim() + '%');
        }
        request = request.order('id');
        const { data, count, error } = await request.range(from, to);
        if (cancelled) return;
        if (error) {
          setErrorMessage('No se pudo cargar la página de usuarios. Inténtalo de nuevo.');
        } else {
          setPerfiles((data ?? []) as Perfil[]);
          setRemoteCounts((current) => ({ ...current, usuarios: count ?? 0 }));
          setErrorMessage('');
        }
      } else {
        let request = supabase
          .from('suscripciones')
          .select('*, planes(nombre)', { count: 'exact' })
          .order('created_at', { ascending: false });
        if (activeFilter !== 'todos') request = request.eq('estado', activeFilter);
        if (planFilter) request = request.eq('plan_id', planFilter);
        if (searchTerm.trim()) {
          if (
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              searchTerm.trim(),
            )
          ) {
            request = request.eq('usuario_id', searchTerm.trim());
          } else {
            request = request.ilike('planes.nombre', `%${searchTerm.trim()}%`);
          }
        }
        const { data, count, error } = await request.range(from, to);
        const subscriptions = (data ?? []) as Suscripcion[];
        const { emails, error: emailsError } = error
          ? { emails: new Map<string, string | null>(), error }
          : await getAdminUserEmails(
              supabase,
              subscriptions.map((item) => item.usuario_id),
            );
        if (cancelled) return;
        if (error || emailsError) {
          setErrorMessage('No se pudo cargar la página de suscripciones. Inténtalo de nuevo.');
        } else {
          setSuscripciones(
            subscriptions.map((item) => ({ ...item, userEmail: emails.get(item.usuario_id) })),
          );
          setRemoteCounts((current) => ({ ...current, suscripciones: count ?? 0 }));
          setErrorMessage('');
        }
      }

      if (!cancelled) setListLoading(false);
    }

    void loadCurrentPage();
    return () => {
      cancelled = true;
    };
  }, [
    activeFilter,
    activeSection,
    currentPage,
    loading,
    planFilter,
    searchTerm,
    supabase,
    importExamFilter,
  ]);

  async function toggleEntityActive(
    table: 'convocatorias' | 'temas' | 'planes',
    id: string,
    currentValue: boolean,
  ) {
    const nextValue = !currentValue;
    if (table === 'planes') {
      const plan = planes.find((item) => item.id === id);
      if (!plan) return;
      const { error } = await supabase.rpc('guardar_plan_admin', {
        p_plan_id: plan.id,
        p_codigo: plan.codigo,
        p_nombre: plan.nombre,
        p_precio_centimos: plan.precio_centimos,
        p_moneda: plan.moneda ?? 'EUR',
        p_duracion_meses: plan.duracion_meses,
        p_activo: nextValue,
        p_orden: plan.orden,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setPlanes((current) =>
        current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)),
      );
      return;
    }
    const { error } = await supabase.from(table).update({ activo: nextValue }).eq('id', id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (table === 'convocatorias') {
      setConvocatorias((current) =>
        current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)),
      );
    }
    if (table === 'temas') {
      setTemas((current) =>
        current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)),
      );
    }
  }

  async function deleteTema(tema: Tema) {
    if (
      !window.confirm(
        `¿Eliminar el tema "${tema.nombre}"?\n\nSe eliminará permanentemente si no está asociado a convocatorias, preguntas ni tests realizados. Si tiene dependencias, puedes desactivarlo en su lugar.`,
      )
    ) {
      return;
    }

    setErrorMessage('');
    const { error } = await supabase.rpc('eliminar_tema_admin', { p_tema_id: tema.id });
    if (error) {
      setErrorMessage(
        error.message.includes('No se puede eliminar el tema')
          ? error.message
          : 'No se pudo eliminar el tema. Inténtalo de nuevo.',
      );
      return;
    }

    setTemas((current) => current.filter((item) => item.id !== tema.id));
    await loadData();
  }

  async function saveConvocatoria(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const optionalText = (name: string) => String(formData.get(name) ?? '').trim() || null;
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      descripcion: optionalText('descripcion'),
      organismo_convocante: optionalText('organismo_convocante'),
      ambito: optionalText('ambito'),
      categoria: optionalText('categoria'),
      grupo: optionalText('grupo'),
      fuente_oficial_url: optionalText('fuente_oficial_url'),
      informacion_url: optionalText('informacion_url'),
      activo: String(formData.get('activo') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre de la convocatoria es obligatorio.');
      return;
    }

    const request = editingConvocatoriaId
      ? supabase.from('convocatorias').update(payload).eq('id', editingConvocatoriaId)
      : supabase.from('convocatorias').insert(payload);
    const { error } = await request;
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    form.reset();
    setEditingConvocatoriaId(null);
    setCatalogView('list');
    requestAnimationFrame(() => catalogHeadingRef.current?.focus());
    await loadData();
  }

  async function saveTema(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const numero = Number(formData.get('numero'));
    const orden = Number(formData.get('orden'));
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      activo: String(formData.get('activo') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre del tema es obligatorio.');
      return;
    }

    if (
      !editingTemaId &&
      topicConvocatoriaId &&
      (!Number.isInteger(numero) || numero <= 0 || !Number.isInteger(orden) || orden <= 0)
    ) {
      setErrorMessage('El número y el orden del tema deben ser enteros positivos.');
      return;
    }

    let existingRelations: Array<{ tema_id: string; numero: number; orden: number }> = [];
    if (!editingTemaId && topicConvocatoriaId) {
      const { data, error } = await supabase
        .from('convocatoria_tema')
        .select('tema_id, numero, orden')
        .eq('convocatoria_id', topicConvocatoriaId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      existingRelations = data ?? [];
      if (
        existingRelations.some((relation) => relation.numero === numero || relation.orden === orden)
      ) {
        setErrorMessage('Ese número o posición ya está asignado en la convocatoria.');
        return;
      }
    }

    let savedTemaId = editingTemaId;
    if (editingTemaId) {
      const { error } = await supabase.from('temas').update(payload).eq('id', editingTemaId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from('temas').insert(payload).select('id').single();
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      savedTemaId = data.id;

      if (topicConvocatoriaId) {
        const { error: associationError } = await supabase.rpc('guardar_temas_convocatoria_admin', {
          p_convocatoria_id: topicConvocatoriaId,
          p_relaciones: [...existingRelations, { tema_id: savedTemaId, numero, orden }],
        });
        if (associationError) {
          setErrorMessage(
            'El tema se creó, pero no se pudo vincular. Puedes asociarlo desde la gestión de convocatorias.',
          );
        }
      }
    }

    form.reset();
    setTopicConvocatoriaId('');
    setTopicNumero('1');
    setTopicOrden('1');
    setEditingTemaId(null);
    setCatalogView('list');
    requestAnimationFrame(() => catalogHeadingRef.current?.focus());
    await loadData();
  }

  async function saveExamen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      fecha: String(formData.get('fecha') ?? '').trim() || null,
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      url_examen: String(formData.get('url_examen') ?? '').trim() || null,
      url_plantilla_respuestas:
        String(formData.get('url_plantilla_respuestas') ?? '').trim() || null,
      es_oficial: String(formData.get('es_oficial') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre del examen es obligatorio.');
      return;
    }

    const request = editingExamenId
      ? supabase.from('examenes').update(payload).eq('id', editingExamenId)
      : supabase.from('examenes').insert(payload);
    const { error } = await request;
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    form.reset();
    setEditingExamenId(null);
    setCatalogView('list');
    requestAnimationFrame(() => catalogHeadingRef.current?.focus());
    await loadData();
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      codigo: String(formData.get('codigo') ?? '').trim(),
      nombre: String(formData.get('nombre') ?? '').trim(),
      precioCentimos: Math.round(Number(formData.get('precio_euros')) * 100),
      moneda: 'EUR',
      duracionMeses: Number(formData.get('duracion_meses')),
      activo: formData.get('activo') === 'on',
      orden: Number(formData.get('orden')),
    };

    if (
      !payload.codigo ||
      !payload.nombre ||
      !Number.isInteger(payload.precioCentimos) ||
      payload.precioCentimos <= 0 ||
      ![1, 6, 12].includes(payload.duracionMeses) ||
      !Number.isInteger(payload.orden) ||
      payload.orden <= 0
    ) {
      setErrorMessage('Revisa el código, nombre, precio, duración y orden del plan.');
      return;
    }

    const { error } = await supabase.rpc('guardar_plan_admin', {
      p_plan_id: editingPlanId,
      p_codigo: payload.codigo,
      p_nombre: payload.nombre,
      p_precio_centimos: payload.precioCentimos,
      p_moneda: payload.moneda,
      p_duracion_meses: payload.duracionMeses,
      p_activo: payload.activo,
      p_orden: payload.orden,
    });
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    form.reset();
    setEditingPlanId(null);
    await loadData();
  }

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('convocatoria');
    if (id && convocatorias.some((item) => item.id === id)) {
      setActiveSection('convocatorias');
      setSearchTerm(convocatorias.find((item) => item.id === id)?.nombre ?? '');
      setManagedConvocatoriaId(id);
      setManagedExamIds(
        convocatoriaExamenes
          .filter((item) => item.convocatoria_id === id)
          .map((item) => item.examen_id),
      );
    }
  }, [convocatorias, convocatoriaExamenes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('seccion') === 'preguntas') {
      setActiveSection('preguntas');
      if (params.get('estado') === 'revision') setActiveFilter('revision');
      const exam = params.get('examen');
      if (exam && /^[0-9a-f-]{36}$/i.test(exam)) setImportExamFilter(exam);
    }
  }, []);

  function openConvocatoriaAssociations(convocatoriaId: string) {
    if (managedConvocatoriaId === convocatoriaId) {
      setManagedConvocatoriaId(null);
      return;
    }
    setManagedConvocatoriaId(convocatoriaId);
    setManagedExamIds(
      convocatoriaExamenes
        .filter((relation) => relation.convocatoria_id === convocatoriaId)
        .map((relation) => relation.examen_id),
    );
  }

  async function saveConvocatoriaAssociations() {
    if (!managedConvocatoriaId) return;
    const { error: examsError } = await supabase.rpc('guardar_examenes_convocatoria_admin', {
      p_convocatoria_id: managedConvocatoriaId,
      p_examen_ids: managedExamIds,
    });
    if (examsError) {
      setErrorMessage(examsError.message);
      return;
    }

    setManagedConvocatoriaId(null);
    await loadData();
  }

  async function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!questionForm.enunciado.trim()) {
      setErrorMessage('El enunciado de la pregunta es obligatorio.');
      return;
    }
    if (
      questionForm.numero &&
      (!Number.isInteger(Number(questionForm.numero)) || Number(questionForm.numero) <= 0)
    ) {
      setErrorMessage('El número de pregunta debe ser un entero positivo.');
      return;
    }

    const validAnswers = questionForm.answers.filter((answer) => answer.texto.trim());
    if (questionForm.estado === 'publicada' && validAnswers.length !== 4) {
      setErrorMessage('Cada pregunta debe tener exactamente cuatro opciones con texto.');
      return;
    }
    if (
      questionForm.estado === 'publicada' &&
      validAnswers.filter((answer) => answer.es_correcta).length !== 1
    ) {
      setErrorMessage('Cada pregunta debe tener exactamente una respuesta correcta.');
      return;
    }

    try {
      const { error } = await supabase.rpc('guardar_pregunta_admin', {
        p_pregunta_id: editingPreguntaId,
        p_datos: {
          numero: questionForm.numero ? Number(questionForm.numero) : null,
          enunciado: questionForm.enunciado.trim(),
          explicacion: questionForm.explicacion.trim() || null,
          fuente_url: questionForm.fuente_url.trim() || null,
          estado: questionForm.estado,
          origen: questionForm.origen,
          situacion: questionForm.situacion,
          examen_id: questionForm.examen_id || null,
        },
        p_respuestas: validAnswers.map((answer) => ({
          orden: answer.orden,
          texto: answer.texto.trim(),
          es_correcta: answer.es_correcta,
        })),
        p_tema_ids: questionForm.topicIds,
      });
      if (error) throw error;

      setQuestionForm(emptyQuestionForm);
      setEditingPreguntaId(null);
      setCatalogView('list');
      requestAnimationFrame(() => catalogHeadingRef.current?.focus());
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la pregunta.';
      setErrorMessage(message);
    }
  }

  async function toggleProfileRole(profileId: string, currentRole: string | null) {
    const nextRole = currentRole === 'admin' ? 'usuario' : 'admin';
    const { error } = await supabase.from('perfiles').update({ rol: nextRole }).eq('id', profileId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPerfiles((current) =>
      current.map((item) => (item.id === profileId ? { ...item, rol: nextRole } : item)),
    );
  }

  const summaryCards = [
    { label: 'Convocatorias', value: stats.convocatorias, icon: '▤' },
    { label: 'Temas', value: stats.temas, icon: '☷' },
    { label: 'Exámenes', value: stats.examenes, icon: '▣' },
    { label: 'Preguntas', value: stats.preguntas, icon: '？' },
    { label: 'Usuarios', value: stats.usuarios, icon: '♙' },
    { label: 'Suscripciones activas', value: stats.suscripcionesActivas, icon: '↻' },
  ];

  const filteredConvocatorias = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es');
    return convocatorias
      .filter(
        (item) =>
          !query ||
          `${item.nombre} ${item.descripcion ?? ''}`.toLocaleLowerCase('es').includes(query),
      )
      .filter(
        (item) =>
          activeSection !== 'convocatorias' ||
          activeFilter === 'todos' ||
          String(Boolean(item.activo)) === activeFilter,
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') * (sortDirection === 'asc' ? 1 : -1));
  }, [activeFilter, activeSection, convocatorias, searchTerm, sortDirection]);
  const filteredTemas = useMemo(
    () =>
      temas
        .filter((item) => {
          const relations = convocatoriaTemas.filter((relation) => relation.tema_id === item.id);
          return (
            topicConvocationFilter === 'all' ||
            (topicConvocationFilter === 'unassigned'
              ? relations.length === 0
              : relations.some((relation) => relation.convocatoria_id === topicConvocationFilter))
          );
        })
        .filter((item) =>
          `${item.nombre} ${item.descripcion ?? ''}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'temas' ||
            activeFilter === 'todos' ||
            String(Boolean(item.activo)) === activeFilter,
        ),
    [activeFilter, activeSection, searchTerm, temas, convocatoriaTemas, topicConvocationFilter],
  );
  const filteredExamenes = useMemo(
    () =>
      examenes
        .filter((item) =>
          `${item.nombre} ${item.descripcion ?? ''}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'examenes' ||
            activeFilter === 'todos' ||
            String(Boolean(item.es_oficial)) === activeFilter,
        ),
    [activeFilter, activeSection, examenes, searchTerm],
  );
  const filteredPreguntas = useMemo(
    () =>
      preguntas
        .filter((item) =>
          `${item.enunciado} ${item.estado ?? ''} ${item.origen ?? ''} ${item.situacion ?? ''}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'preguntas' ||
            activeFilter === 'todos' ||
            item.estado === activeFilter,
        ),
    [activeFilter, activeSection, preguntas, searchTerm],
  );
  const filteredProfiles = useMemo(
    () =>
      perfiles
        .filter((item) =>
          `${item.email ?? ''} ${item.rol ?? 'usuario'}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'usuarios' ||
            activeFilter === 'todos' ||
            (item.rol ?? 'usuario') === activeFilter,
        ),
    [activeFilter, activeSection, perfiles, searchTerm],
  );
  const filteredSubscriptions = useMemo(
    () =>
      suscripciones
        .filter((item) =>
          `${item.usuario_id} ${item.planes?.nombre ?? ''} ${item.estado ?? ''}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'suscripciones' ||
            activeFilter === 'todos' ||
            item.estado === activeFilter,
        )
        .filter(
          (item) => activeSection !== 'suscripciones' || !planFilter || item.plan_id === planFilter,
        ),
    [activeFilter, activeSection, planFilter, searchTerm, suscripciones],
  );
  const filteredPlans = useMemo(
    () =>
      planes
        .filter((item) =>
          `${item.nombre} ${item.codigo}`
            .toLocaleLowerCase('es')
            .includes(searchTerm.trim().toLocaleLowerCase('es')),
        )
        .filter(
          (item) =>
            activeSection !== 'planes' ||
            activeFilter === 'todos' ||
            String(Boolean(item.activo)) === activeFilter,
        ),
    [activeFilter, activeSection, planes, searchTerm],
  );

  const activeRowCount =
    activeSection === 'convocatorias'
      ? filteredConvocatorias.length
      : activeSection === 'temas'
        ? filteredTemas.length
        : activeSection === 'examenes'
          ? filteredExamenes.length
          : activeSection === 'preguntas'
            ? remoteCounts.preguntas
            : activeSection === 'usuarios'
              ? remoteCounts.usuarios
              : activeSection === 'suscripciones'
                ? remoteCounts.suscripciones
                : filteredPlans.length;
  const activePageCount = Math.max(1, Math.ceil(activeRowCount / PAGE_SIZE));
  const activePage = Math.min(currentPage, activePageCount);
  const paginatedConvocatorias = getPageItems(filteredConvocatorias, currentPage).items;
  const paginatedTemas = getPageItems(filteredTemas, currentPage).items;
  const paginatedExamenes = getPageItems(filteredExamenes, currentPage).items;
  const paginatedPreguntas =
    activeSection === 'preguntas' ? preguntas : getPageItems(filteredPreguntas, currentPage).items;
  const paginatedProfiles =
    activeSection === 'usuarios' ? perfiles : getPageItems(filteredProfiles, currentPage).items;
  const paginatedSubscriptions =
    activeSection === 'suscripciones'
      ? suscripciones
      : getPageItems(filteredSubscriptions, currentPage).items;
  const paginatedPlans = getPageItems(filteredPlans, currentPage).items;
  const editingConvocatoria = convocatorias.find((item) => item.id === editingConvocatoriaId);
  const editingTema = temas.find((item) => item.id === editingTemaId);
  const editingExamen = examenes.find((item) => item.id === editingExamenId);
  const editingPlan = planes.find((item) => item.id === editingPlanId);

  const changeSection = (section: SectionKey) => {
    setCatalogView('list');
    setErrorMessage('');
    setActiveSection(section);
    setSearchTerm('');
    setActiveFilter('todos');
    setPlanFilter('');
    setCurrentPage(1);
    setIsMobileNavigationOpen(false);
  };

  const openCatalogForm = (section: SectionKey, id: string | null = null) => {
    if (section !== activeSection) changeSection(section);
    setEditingConvocatoriaId(section === 'convocatorias' ? id : null);
    setEditingTemaId(section === 'temas' ? id : null);
    setEditingExamenId(section === 'examenes' ? id : null);
    setEditingPreguntaId(section === 'preguntas' ? id : null);
    if (section === 'preguntas' && !id) setQuestionForm(emptyQuestionForm);
    setTopicConvocatoriaId('');
    setTopicNumero('1');
    setTopicOrden('1');
    setErrorMessage('');
    setCatalogView('form');
    requestAnimationFrame(() => catalogHeadingRef.current?.focus());
  };
  const closeCatalogForm = () => {
    setCatalogView('list');
    setEditingConvocatoriaId(null);
    setEditingTemaId(null);
    setEditingExamenId(null);
    setEditingPreguntaId(null);
    setQuestionForm(emptyQuestionForm);
    setErrorMessage('');
    requestAnimationFrame(() => catalogHeadingRef.current?.focus());
  };
  const isCatalogSection = ['convocatorias', 'temas', 'examenes', 'preguntas'].includes(
    activeSection,
  );
  const isCatalogForm = isCatalogSection && catalogView === 'form';
  const catalogEntityLabel =
    activeSection === 'convocatorias'
      ? 'convocatoria'
      : activeSection === 'temas'
        ? 'tema'
        : activeSection === 'preguntas'
          ? 'pregunta'
          : 'examen';
  const isEditingCatalog = Boolean(
    editingConvocatoriaId || editingTemaId || editingExamenId || editingPreguntaId,
  );

  const renderResumen = () => (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="flex items-center justify-between gap-4 rounded-2xl border border-[#e5e1d8] bg-white p-5 shadow-[0_12px_34px_rgba(48,47,43,0.035)]"
          >
            <div>
              <p className="text-sm text-[#77756e]">{card.label}</p>
              <p className="mt-2 font-serif text-3xl text-[#302f2b]">{card.value}</p>
            </div>
            <span
              aria-hidden="true"
              className="grid h-11 w-11 place-items-center rounded-xl bg-[#f8eeeb] text-xl text-[#bd3734]"
            >
              {card.icon}
            </span>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#e5e1d8] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e5e1d8] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-[#302f2b]">Convocatorias recientes</h2>
            <p className="mt-1 text-sm text-[#77756e]">
              Consulta y administra el catálogo disponible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCatalogForm('convocatorias')}
            className="min-h-11 rounded-lg bg-[#bd3734] px-4 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
          >
            + Nueva convocatoria
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <label className="sr-only" htmlFor="dashboard-convocatoria-search">
            Buscar convocatoria
          </label>
          <input
            id="dashboard-convocatoria-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar convocatoria..."
            className="min-h-11 w-full rounded-lg border border-[#e5e1d8] bg-[#fdfcf9] px-3 text-sm sm:max-w-sm"
          />
          <button
            type="button"
            onClick={() => openCatalogForm('examenes')}
            className="min-h-11 rounded-lg border border-[#d8d2c8] px-4 font-sans text-sm font-semibold text-[#393833] hover:bg-[#f8f7f3]"
          >
            Crear examen
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-[#77756e]">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'))}
                    className="inline-flex items-center gap-2"
                  >
                    Convocatoria{' '}
                    <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  </button>
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Temas
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Exámenes
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Estado
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Modificada
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeae2]">
              {paginatedConvocatorias.map((item) => (
                <tr key={item.id} className="text-[#393833]">
                  <td className="px-5 py-4">
                    <p className="font-semibold">{item.nombre}</p>
                    <p className="mt-1 max-w-sm truncate text-xs text-[#77756e]">
                      {item.descripcion ?? 'Sin descripción'}
                    </p>
                  </td>
                  <td className="px-5 py-4">{item.convocatoria_tema?.[0]?.count ?? 0}</td>
                  <td className="px-5 py-4">{item.convocatoria_examen?.[0]?.count ?? 0}</td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        item.activo
                          ? 'rounded-full bg-[#eaf3eb] px-2.5 py-1 text-xs font-semibold text-[#356a43]'
                          : 'rounded-full bg-[#f1eee9] px-2.5 py-1 text-xs font-semibold text-[#77756e]'
                      }
                    >
                      {item.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#77756e]">
                    {item.updated_at
                      ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                          new Date(item.updated_at),
                        )
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => changeSection('convocatorias')}
                      className="font-semibold text-[#bd3734] hover:underline"
                    >
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredConvocatorias.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#77756e]">
                    No hay convocatorias que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#e5e1d8] px-5 py-4 text-sm text-[#77756e]">
          <span>{filteredConvocatorias.length} convocatorias</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Página anterior"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="h-9 w-9 rounded-lg border border-[#e5e1d8] disabled:opacity-40"
            >
              ‹
            </button>
            <span>
              {getPageItems(filteredConvocatorias, currentPage).page} /{' '}
              {getPageItems(filteredConvocatorias, currentPage).pageCount}
            </span>
            <button
              type="button"
              aria-label="Página siguiente"
              disabled={currentPage >= getPageItems(filteredConvocatorias, currentPage).pageCount}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(getPageItems(filteredConvocatorias, page).pageCount, page + 1),
                )
              }
              className="h-9 w-9 rounded-lg border border-[#e5e1d8] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  const renderConvocatorias = () => (
    <div className="space-y-6">
      {catalogView === 'list' ? (
        <>
          <BonImport topics={temas} onSaved={() => void loadData()} />
          <CatalogTable
            label="Convocatorias"
            columns={['Convocatoria', 'Temas', 'Exámenes', 'Estado', 'Acciones']}
            empty={filteredConvocatorias.length === 0}
          >
            {getPageItems(filteredConvocatorias, currentPage).items.map((item) => (
              <Fragment key={item.id}>
                <tr className="align-top hover:bg-[#fdfcf9]">
                  <th scope="row" className="max-w-sm px-5 py-4 font-medium">
                    <p className="break-words">{item.nombre}</p>
                    <p className="mt-1 text-xs font-normal text-[var(--muted)]">
                      {[item.organismo_convocante, item.ambito, item.categoria, item.grupo]
                        .filter(Boolean)
                        .join(' / ') ||
                        item.descripcion ||
                        'Sin descripción'}
                    </p>
                  </th>
                  <td className="px-5 py-4">
                    {
                      convocatoriaTemas.filter((relation) => relation.convocatoria_id === item.id)
                        .length
                    }
                  </td>
                  <td className="px-5 py-4">
                    {
                      convocatoriaExamenes.filter(
                        (relation) => relation.convocatoria_id === item.id,
                      ).length
                    }
                  </td>
                  <td className="px-5 py-4">
                    <span className={item.activo ? 'text-emerald-700' : 'text-slate-600'}>
                      {item.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCatalogForm('convocatorias', item.id)}
                        className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleEntityActive('convocatorias', item.id, Boolean(item.activo))
                        }
                        className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                      >
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openConvocatoriaAssociations(item.id)}
                        aria-expanded={managedConvocatoriaId === item.id}
                        className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                      >
                        {managedConvocatoriaId === item.id
                          ? 'Cerrar temas y exámenes'
                          : 'Gestionar temas y exámenes'}
                      </button>
                    </div>
                  </td>
                </tr>
                {managedConvocatoriaId === item.id ? (
                  <tr>
                    <td colSpan={5} className="px-5 pb-5">
                      <div className="mt-4 space-y-5 border-t border-[var(--line)] pt-4">
                        <ConvocationBlocks
                          convocationId={item.id}
                          topics={temas}
                          onSaved={() => void loadData()}
                        />
                        <section>
                          <h4 className="text-sm font-semibold text-[var(--ink)]">
                            Exámenes asociados
                          </h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {examenes.map((examen) => (
                              <label
                                key={examen.id}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={managedExamIds.includes(examen.id)}
                                  onChange={(event) =>
                                    setManagedExamIds((current) =>
                                      event.target.checked
                                        ? [...current, examen.id]
                                        : current.filter((id) => id !== examen.id),
                                    )
                                  }
                                />
                                {examen.nombre}
                              </label>
                            ))}
                          </div>
                        </section>
                        <button
                          type="button"
                          onClick={() => void saveConvocatoriaAssociations()}
                          className="w-full rounded-full bg-[var(--coral)] px-5 py-3 text-sm font-semibold text-white"
                        >
                          Guardar asociaciones
                        </button>
                        <p className="text-xs text-[var(--muted)]">
                          Al retirar una asociación no se elimina el tema, el examen ni sus
                          preguntas.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </CatalogTable>
        </>
      ) : (
        <form
          key={`convocatoria-${editingConvocatoriaId ?? 'new'}`}
          onSubmit={saveConvocatoria}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8"
        >
          <p className="eyebrow">
            {editingConvocatoria ? 'Editar convocatoria' : 'Crear convocatoria'}
          </p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
              <input
                name="nombre"
                defaultValue={editingConvocatoria?.nombre ?? ''}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                Descripción
              </span>
              <textarea
                name="descripcion"
                defaultValue={editingConvocatoria?.descripcion ?? ''}
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            {[
              [
                'organismo_convocante',
                'Organismo convocante',
                editingConvocatoria?.organismo_convocante,
              ],
              ['ambito', 'Ámbito', editingConvocatoria?.ambito],
              ['categoria', 'Categoría', editingConvocatoria?.categoria],
              ['grupo', 'Grupo', editingConvocatoria?.grupo],
              [
                'fuente_oficial_url',
                'URL de la fuente oficial',
                editingConvocatoria?.fuente_oficial_url,
              ],
              ['informacion_url', 'URL de información', editingConvocatoria?.informacion_url],
            ].map(([name, label, value]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">{label}</span>
                <input
                  name={name ?? undefined}
                  type={String(name).endsWith('_url') ? 'url' : 'text'}
                  defaultValue={value ?? ''}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                />
              </label>
            ))}
            <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={editingConvocatoria?.activo ?? true}
              />
              Activa
            </label>
            <button
              type="button"
              onClick={closeCatalogForm}
              className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
            >
              {editingConvocatoria ? 'Guardar cambios' : 'Guardar convocatoria'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  const renderTemas = () => (
    <div className="space-y-6">
      {catalogView === 'list' ? (
        <>
          <div className="min-w-0 space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Filtrar por convocatoria</span>
              <select
                value={topicConvocationFilter}
                onChange={(event) => {
                  setTopicConvocationFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-sm"
              >
                <option value="all">Todas las convocatorias</option>
                <option value="unassigned">Sin convocatoria</option>
                {convocatorias.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>
            <CatalogTable
              label="Temas"
              columns={['Tema', 'Convocatorias', 'Estado', 'Acciones']}
              empty={paginatedTemas.length === 0}
            >
              {paginatedTemas.map((item) => (
                <tr key={item.id} className="align-top hover:bg-[#fdfcf9]">
                  <th scope="row" className="max-w-sm px-5 py-4 font-medium">
                    <p className="break-words">{item.nombre}</p>
                    {item.descripcion ? (
                      <details className="mt-2 text-xs font-normal text-[var(--muted)]">
                        <summary className="cursor-pointer py-2">Ver descripción</summary>
                        <p className="whitespace-pre-wrap break-words">{item.descripcion}</p>
                      </details>
                    ) : (
                      <p className="mt-1 text-xs font-normal text-[var(--muted)]">
                        Sin descripción
                      </p>
                    )}
                  </th>
                  <td className="max-w-xs px-5 py-4 text-xs text-[var(--muted)]">
                    {convocatorias
                      .filter((convocation) =>
                        convocatoriaTemas.some(
                          (relation) =>
                            relation.tema_id === item.id &&
                            relation.convocatoria_id === convocation.id,
                        ),
                      )
                      .map((convocation) => convocation.nombre)
                      .join(' / ') || 'Sin convocatoria asociada'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={item.activo ? 'text-emerald-700' : 'text-slate-600'}>
                      {item.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCatalogForm('temas', item.id)}
                        className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleEntityActive('temas', item.id, Boolean(item.activo))}
                        className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                      >
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTema(item)}
                        className="min-h-10 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </CatalogTable>
          </div>
        </>
      ) : (
        <form
          key={`tema-${editingTemaId ?? 'new'}`}
          onSubmit={saveTema}
          aria-label={editingTema ? 'Editar tema' : 'Crear tema'}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8"
        >
          <p className="eyebrow">{editingTema ? 'Editar tema' : 'Crear tema'}</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
              <input
                ref={topicNameRef}
                required
                name="nombre"
                defaultValue={editingTema?.nombre ?? ''}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                Descripción
              </span>
              <textarea
                name="descripcion"
                defaultValue={editingTema?.descripcion ?? ''}
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            {!editingTema ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                    Convocatoria (opcional)
                  </span>
                  <select
                    name="convocatoria_id"
                    value={topicConvocatoriaId}
                    onChange={(event) => {
                      const convocatoriaId = event.target.value;
                      const relations = convocatoriaTemas.filter(
                        (relation) => relation.convocatoria_id === convocatoriaId,
                      );
                      setTopicConvocatoriaId(convocatoriaId);
                      setTopicNumero(
                        String(Math.max(0, ...relations.map((relation) => relation.numero)) + 1),
                      );
                      setTopicOrden(
                        String(Math.max(0, ...relations.map((relation) => relation.orden)) + 1),
                      );
                    }}
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                  >
                    <option value="">Sin convocatoria asociada</option>
                    {convocatorias.map((convocatoria) => (
                      <option key={convocatoria.id} value={convocatoria.id}>
                        {convocatoria.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                {topicConvocatoriaId ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                        Número del tema
                      </span>
                      <input
                        name="numero"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={topicNumero}
                        onChange={(event) => setTopicNumero(event.target.value)}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                        Orden
                      </span>
                      <input
                        name="orden"
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={topicOrden}
                        onChange={(event) => setTopicOrden(event.target.value)}
                        className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                      />
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}
            <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
              <input type="checkbox" name="activo" defaultChecked={editingTema?.activo ?? true} />
              Activo
            </label>
            <button
              type="button"
              onClick={closeCatalogForm}
              className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
            >
              {editingTema ? 'Guardar cambios' : 'Guardar tema'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  const renderExamenes = () => (
    <div className="space-y-6">
      {catalogView === 'list' ? (
        <>
          <CatalogTable
            label="Exámenes"
            columns={['Examen', 'Fecha', 'Tipo', 'Acciones']}
            empty={paginatedExamenes.length === 0}
          >
            {paginatedExamenes.map((item) => (
              <tr key={item.id} className="align-top hover:bg-[#fdfcf9]">
                <th scope="row" className="max-w-md px-5 py-4 font-medium">
                  <p className="break-words">{item.nombre}</p>
                  <p className="mt-1 text-xs font-normal text-[var(--muted)]">
                    {item.descripcion || 'Sin descripción'}
                  </p>
                </th>
                <td className="whitespace-nowrap px-5 py-4">
                  {item.fecha
                    ? new Intl.DateTimeFormat('es-ES').format(new Date(item.fecha + 'T12:00:00'))
                    : 'Sin fecha'}
                </td>
                <td className="px-5 py-4">{item.es_oficial ? 'Oficial' : 'No oficial'}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => openCatalogForm('examenes', item.id)}
                    className="min-h-10 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </CatalogTable>
        </>
      ) : (
        <form
          key={`examen-${editingExamenId ?? 'new'}`}
          onSubmit={saveExamen}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8"
        >
          <p className="eyebrow">{editingExamen ? 'Editar examen' : 'Crear examen'}</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
              <input
                name="nombre"
                defaultValue={editingExamen?.nombre ?? ''}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Fecha</span>
              <input
                name="fecha"
                type="date"
                defaultValue={editingExamen?.fecha ?? ''}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                Descripción
              </span>
              <textarea
                name="descripcion"
                defaultValue={editingExamen?.descripcion ?? ''}
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>
            {[
              ['url_examen', 'URL del examen', editingExamen?.url_examen],
              [
                'url_plantilla_respuestas',
                'URL de la plantilla de respuestas',
                editingExamen?.url_plantilla_respuestas,
              ],
            ].map(([name, label, value]) => (
              <label key={name} className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">{label}</span>
                <input
                  name={name ?? undefined}
                  type="url"
                  defaultValue={value ?? ''}
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                />
              </label>
            ))}
            <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                name="es_oficial"
                defaultChecked={editingExamen?.es_oficial ?? true}
              />
              Examen oficial
            </label>
            <button
              type="button"
              onClick={closeCatalogForm}
              className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
            >
              {editingExamen ? 'Guardar cambios' : 'Guardar examen'}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  const renderPreguntas = () => (
    <div className="space-y-6">
      {catalogView === 'list' ? (
        <>
          <QuestionImport exams={examenes} onSaved={() => void loadData()} />
          {importExamFilter && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5e1d8] bg-white p-4 xl:col-span-2">
              <p className="text-sm">
                Examen:{' '}
                {examenes.find((exam) => exam.id === importExamFilter)?.nombre ??
                  'Examen seleccionado'}
              </p>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setImportExamFilter('')}
              >
                Ver todos los exámenes
              </button>
            </div>
          )}
          <CatalogTable
            label="Banco de preguntas"
            columns={['Enunciado', 'Examen', 'Estado', 'Origen', 'Situación', 'Acciones']}
            empty={paginatedPreguntas.length === 0}
          >
            {paginatedPreguntas.map((item) => (
              <tr key={item.id} className="align-top hover:bg-[#fdfcf9]">
                <th scope="row" className="max-w-md px-5 py-4 font-medium">
                  <p className="whitespace-pre-wrap break-words">{item.enunciado}</p>
                  <p className="mt-2 text-xs font-normal text-[var(--muted)]">
                    {item.respuestas?.length ?? 0} respuestas
                    {item.referencia_fuente ? ` / Fuente: ${item.referencia_fuente}` : ''}
                  </p>
                </th>
                <td className="max-w-xs px-5 py-4 text-[var(--muted)]">
                  {examenes.find((exam) => exam.id === item.examen_id)?.nombre ?? 'Sin examen'}
                  {item.numero != null ? ` / N.º ${item.numero}` : ''}
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold">
                    {item.estado === 'revision'
                      ? 'En revisión'
                      : item.estado === 'publicada'
                        ? 'Publicada'
                        : 'Desactivada'}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {item.origen === 'oficial' ? 'Examen oficial' : 'Propia'}
                </td>
                <td className="px-5 py-4">
                  {item.situacion === 'anulada'
                    ? 'Anulada'
                    : item.situacion === 'reserva'
                      ? 'Reserva'
                      : 'Ordinaria'}
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      openCatalogForm('preguntas', item.id);
                      setQuestionForm({
                        enunciado: item.enunciado,
                        numero: item.numero == null ? '' : String(item.numero),
                        explicacion: item.explicacion ?? '',
                        fuente_url: item.fuente_url ?? '',
                        estado: (item.estado ?? 'revision') as QuestionForm['estado'],
                        origen: (item.origen ?? 'propia') as QuestionForm['origen'],
                        situacion: (item.situacion ?? 'ordinaria') as QuestionForm['situacion'],
                        examen_id: item.examen_id ?? '',
                        answers: emptyQuestionForm.answers.map((answer) => {
                          const savedAnswer = item.respuestas?.find(
                            (candidate) => candidate.orden === answer.orden,
                          );
                          return savedAnswer
                            ? {
                                orden: answer.orden,
                                texto: savedAnswer.texto,
                                es_correcta: savedAnswer.es_correcta,
                              }
                            : answer;
                        }),
                        topicIds: item.pregunta_tema?.map((relation) => relation.tema_id) ?? [],
                      });
                    }}
                    className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
                  >
                    Editar pregunta
                  </button>
                </td>
              </tr>
            ))}
          </CatalogTable>
        </>
      ) : (
        <form
          key={`pregunta-${editingPreguntaId ?? 'new'}`}
          onSubmit={saveQuestion}
          aria-label={editingPreguntaId ? 'Editar pregunta' : 'Crear pregunta'}
          className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-8"
        >
          <p className="eyebrow">{editingPreguntaId ? 'Editar pregunta' : 'Nueva pregunta'}</p>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Enunciado</span>
              <textarea
                value={questionForm.enunciado}
                onChange={(event) =>
                  setQuestionForm((current) => ({ ...current, enunciado: event.target.value }))
                }
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Número</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={questionForm.numero}
                  onChange={(event) =>
                    setQuestionForm((current) => ({ ...current, numero: event.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Estado</span>
                <select
                  value={questionForm.estado}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      estado: event.target.value as QuestionForm['estado'],
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                >
                  <option value="revision">Revisión</option>
                  <option value="publicada">Publicada</option>
                  <option value="desactivada">Desactivada</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Origen</span>
                <select
                  value={questionForm.origen}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      origen: event.target.value as QuestionForm['origen'],
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                >
                  <option value="propia">Propia</option>
                  <option value="oficial">Oficial</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                  Situación
                </span>
                <select
                  value={questionForm.situacion}
                  onChange={(event) =>
                    setQuestionForm((current) => ({
                      ...current,
                      situacion: event.target.value as QuestionForm['situacion'],
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                >
                  <option value="ordinaria">Ordinaria</option>
                  <option value="reserva">Reserva</option>
                  <option value="anulada">Anulada</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                Explicación
              </span>
              <textarea
                value={questionForm.explicacion}
                onChange={(event) =>
                  setQuestionForm((current) => ({ ...current, explicacion: event.target.value }))
                }
                className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
                URL de la fuente
              </span>
              <input
                type="url"
                value={questionForm.fuente_url}
                onChange={(event) =>
                  setQuestionForm((current) => ({ ...current, fuente_url: event.target.value }))
                }
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Examen</span>
              <select
                value={questionForm.examen_id}
                onChange={(event) =>
                  setQuestionForm((current) => ({ ...current, examen_id: event.target.value }))
                }
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="">Sin examen asociado</option>
                {examenes.map((examen) => (
                  <option key={examen.id} value={examen.id}>
                    {examen.nombre}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--ink)]">Temas</p>
              <div className="flex flex-wrap gap-2">
                {temas.map((tema) => {
                  const selected = questionForm.topicIds.includes(tema.id);
                  return (
                    <button
                      key={tema.id}
                      type="button"
                      onClick={() =>
                        setQuestionForm((current) => ({
                          ...current,
                          topicIds: selected
                            ? current.topicIds.filter((id) => id !== tema.id)
                            : [...current.topicIds, tema.id],
                        }))
                      }
                      className={[
                        'rounded-full border px-3 py-2 text-xs font-semibold',
                        selected
                          ? 'border-[var(--coral)] bg-[rgba(243,111,94,0.08)] text-[var(--coral)]'
                          : 'border-[var(--line)] bg-white text-[var(--ink)]',
                      ].join(' ')}
                    >
                      {tema.nombre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {questionForm.answers.map((answer, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-[var(--line)] bg-[rgba(22,31,29,0.02)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--ink)]">
                      Opción {index + 1}
                    </span>
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={answer.es_correcta}
                        onChange={(event) =>
                          setQuestionForm((current) => ({
                            ...current,
                            answers: current.answers.map((item, currentIndex) =>
                              currentIndex === index
                                ? { ...item, es_correcta: event.target.checked }
                                : item,
                            ),
                          }))
                        }
                      />
                      Correcta
                    </label>
                  </div>
                  <input
                    value={answer.texto}
                    onChange={(event) =>
                      setQuestionForm((current) => ({
                        ...current,
                        answers: current.answers.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, texto: event.target.value } : item,
                        ),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
                    placeholder={`Texto de la opción ${index + 1}`}
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
            >
              {editingPreguntaId ? 'Guardar cambios' : 'Guardar pregunta'}
            </button>
            <button
              type="button"
              onClick={closeCatalogForm}
              className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );

  const renderUsuarios = () => (
    <CatalogTable
      label="Usuarios"
      columns={['Correo', 'Rol', 'Fecha de creación', 'Último acceso', 'Acciones']}
      empty={paginatedProfiles.length === 0}
    >
      {paginatedProfiles.map((item) => (
        <tr key={item.id} className="align-top hover:bg-[#fdfcf9]">
          <th scope="row" className="max-w-xs break-all px-5 py-4 font-medium">
            {item.email || 'Correo no disponible'}
          </th>
          <td className="px-5 py-4">
            <span
              className={
                item.rol === 'admin'
                  ? 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700'
              }
            >
              {item.rol === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
          </td>
          <td className="whitespace-nowrap px-5 py-4 text-[var(--muted)]">
            {formatUserDate(item.created_at, 'Fecha no disponible')}
          </td>
          <td className="whitespace-nowrap px-5 py-4 text-[var(--muted)]">
            {formatUserDate(item.last_sign_in_at, 'Sin accesos registrados')}
          </td>
          <td className="px-5 py-4">
            <button
              type="button"
              onClick={() => toggleProfileRole(item.id, item.rol ?? 'usuario')}
              className="min-h-10 whitespace-nowrap rounded-lg border border-[var(--line)] px-3 text-xs font-semibold"
            >
              {item.rol === 'admin' ? 'Quitar admin' : 'Dar admin'}
            </button>
          </td>
        </tr>
      ))}
    </CatalogTable>
  );

  const renderPlanes = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {paginatedPlans.map((item) => (
          <article
            key={item.id}
            className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--ink)]">{item.nombre}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {item.codigo} · {(item.precio_centimos ?? 0) / 100} € · {item.duracion_meses ?? 0}{' '}
                  meses · {item.moneda ?? 'EUR'} · Orden {item.orden ?? '—'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPlanId(item.id)}
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => toggleEntityActive('planes', item.id, Boolean(item.activo))}
                  className={[
                    'rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]',
                    item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700',
                  ].join(' ')}
                >
                  {item.activo ? 'Disponible' : 'No disponible'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <form
        key={`plan-${editingPlanId ?? 'new'}`}
        onSubmit={savePlan}
        className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5"
      >
        <p className="eyebrow">{editingPlan ? 'Editar plan' : 'Crear plan'}</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Código</span>
            <input
              name="codigo"
              required
              defaultValue={editingPlan?.codigo ?? ''}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
            <input
              name="nombre"
              required
              defaultValue={editingPlan?.nombre ?? ''}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
              Precio por periodo (EUR)
            </span>
            <input
              name="precio_euros"
              type="number"
              min="0.01"
              step="0.01"
              required
              defaultValue={
                editingPlan?.precio_centimos == null
                  ? ''
                  : (editingPlan.precio_centimos / 100).toFixed(2)
              }
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
              Duración (meses)
            </span>
            <select
              name="duracion_meses"
              defaultValue={editingPlan?.duracion_meses ?? 1}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            >
              <option value="1">1 mes</option>
              <option value="6">6 meses</option>
              <option value="12">12 meses</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">
              Orden de presentación
            </span>
            <input
              name="orden"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={
                editingPlan?.orden ?? Math.max(0, ...planes.map((plan) => plan.orden ?? 0)) + 1
              }
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Moneda fija por la configuración actual: EUR. Cambiar el catálogo no modifica los
            importes ya contratados.
          </p>
          <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
            <input type="checkbox" name="activo" defaultChecked={editingPlan?.activo ?? true} />
            Disponible para nuevas contrataciones
          </label>
          {editingPlan ? (
            <button
              type="button"
              onClick={() => setEditingPlanId(null)}
              className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
            >
              Cancelar edición
            </button>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white"
          >
            {editingPlan ? 'Guardar cambios' : 'Guardar plan'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderSuscripciones = () => (
    <div className="overflow-hidden rounded-2xl border border-[#e5e1d8] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-[#77756e]">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Correo del usuario
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Plan
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Estado
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Inicio del periodo
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Fin del periodo
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                <span className="sr-only">Detalle</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eeeae2]">
            {paginatedSubscriptions.map((item) => (
              <tr key={item.id} className="text-[#393833]">
                <td className="max-w-xs break-words px-5 py-4 font-medium">
                  {item.userEmail || 'Correo no disponible'}
                </td>
                <td className="px-5 py-4">{item.planes?.nombre ?? 'Sin plan'}</td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-[#f1eee9] px-2.5 py-1 text-xs font-semibold">
                    {item.estado ?? 'Sin estado'}
                  </span>
                </td>
                <td className="px-5 py-4 text-xs text-[#77756e]">
                  {item.periodo_inicio
                    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                        new Date(item.periodo_inicio),
                      )
                    : '—'}
                </td>
                <td className="px-5 py-4 text-xs text-[#77756e]">
                  {item.periodo_fin
                    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
                        new Date(item.periodo_fin),
                      )
                    : '—'}
                </td>
                <td className="px-5 py-4 text-right">
                  <details className="relative inline-block text-left">
                    <summary className="cursor-pointer list-none font-semibold text-[#bd3734] hover:underline">
                      Ver detalle
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-[#e5e1d8] bg-white p-4 text-left text-xs leading-5 shadow-xl">
                      <p>
                        <span className="text-[#77756e]">Precio contratado:</span>{' '}
                        {typeof item.precio_centimos === 'number'
                          ? `${(item.precio_centimos / 100).toFixed(2)} €`
                          : 'No disponible'}
                      </p>
                      <p>
                        <span className="text-[#77756e]">Duración:</span>{' '}
                        {item.duracion_meses ? `${item.duracion_meses} meses` : 'No disponible'}
                      </p>
                      <p>
                        <span className="text-[#77756e]">Renovación:</span>{' '}
                        {item.cancelar_al_final_del_periodo
                          ? 'No se renovará'
                          : 'Según las condiciones del plan'}
                      </p>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {filteredSubscriptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#77756e]">
                  No hay suscripciones que coincidan con los filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#e5e1d8] px-5 py-4 text-sm text-[#77756e]">
        {filteredSubscriptions.length} suscripciones · Consulta de solo lectura
      </p>
    </div>
  );

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'convocatorias':
        return renderConvocatorias();
      case 'temas':
        return renderTemas();
      case 'examenes':
        return renderExamenes();
      case 'preguntas':
        return renderPreguntas();
      case 'usuarios':
        return renderUsuarios();
      case 'suscripciones':
        return renderSuscripciones();
      case 'planes':
        return renderPlanes();
      case 'resumen':
      default:
        return renderResumen();
    }
  };

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage('No se pudo cerrar la sesión. Inténtalo de nuevo.');
      return;
    }

    router.push('/acceder');
    router.refresh();
  }

  const pageTitles: Record<SectionKey, string> = {
    resumen: 'Vista general',
    convocatorias: 'Convocatorias',
    temas: 'Temas',
    examenes: 'Exámenes',
    preguntas: 'Banco de preguntas',
    usuarios: 'Usuarios',
    suscripciones: 'Suscripciones',
    planes: 'Planes',
  };
  const pageDescriptions: Record<SectionKey, string> = {
    resumen: 'Organiza y gestiona el contenido de OposNavarra desde un único lugar.',
    convocatorias: 'Gestiona las convocatorias y su disponibilidad.',
    temas: 'Organiza los temas que forman parte del catálogo.',
    examenes: 'Consulta y administra los exámenes disponibles.',
    preguntas: 'Revisa y administra las preguntas del banco.',
    usuarios: 'Consulta las cuentas y gestiona los permisos administrativos.',
    suscripciones: 'Consulta el estado y los periodos de las suscripciones.',
    planes: 'Gestiona la disponibilidad de los planes de contratación.',
  };
  const initials = adminEmail.split('@')[0].slice(0, 2).toLocaleUpperCase('es') || 'AD';
  const navGroups: Array<{ title: string; items: SectionKey[] }> = [
    { title: 'Vista general', items: ['resumen'] },
    { title: 'Contenido', items: ['convocatorias', 'temas', 'examenes', 'preguntas'] },
    { title: 'Comunidad y ventas', items: ['usuarios', 'suscripciones', 'planes'] },
  ];
  const filterOptions: Record<SectionKey, Array<{ value: string; label: string }>> = {
    resumen: [],
    convocatorias: [
      { value: 'todos', label: 'Todos los estados' },
      { value: 'true', label: 'Activas' },
      { value: 'false', label: 'Inactivas' },
    ],
    temas: [
      { value: 'todos', label: 'Todos los estados' },
      { value: 'true', label: 'Activos' },
      { value: 'false', label: 'Inactivos' },
    ],
    examenes: [
      { value: 'todos', label: 'Todos los exámenes' },
      { value: 'true', label: 'Oficiales' },
      { value: 'false', label: 'No oficiales' },
    ],
    preguntas: [
      { value: 'todos', label: 'Todos los estados' },
      { value: 'revision', label: 'En revisión' },
      { value: 'publicada', label: 'Publicadas' },
      { value: 'desactivada', label: 'Desactivadas' },
    ],
    usuarios: [
      { value: 'todos', label: 'Todos los roles' },
      { value: 'usuario', label: 'Usuarios' },
      { value: 'admin', label: 'Administradores' },
    ],
    suscripciones: [
      { value: 'todos', label: 'Todos los estados' },
      { value: 'pendiente', label: 'Pendientes' },
      { value: 'activa', label: 'Activas' },
      { value: 'vencida', label: 'Vencidas' },
      { value: 'cancelada', label: 'Canceladas' },
    ],
    planes: [
      { value: 'todos', label: 'Todos los planes' },
      { value: 'true', label: 'Disponibles' },
      { value: 'false', label: 'No disponibles' },
    ],
  };

  return (
    <main className="admin-shell min-h-screen bg-[#f7f5ef] text-[#302f2b]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e5e1d8] bg-white px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileNavigationOpen((open) => !open)}
            aria-label={isMobileNavigationOpen ? 'Cerrar navegación' : 'Abrir navegación'}
            aria-expanded={isMobileNavigationOpen}
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#e5e1d8] text-lg lg:hidden"
          >
            {isMobileNavigationOpen ? '×' : '☰'}
          </button>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#bd3734] font-sans text-xs font-bold text-white">
            ON
          </span>
          <span className="font-sans text-base font-bold tracking-tight">
            opos<span className="text-[#bd3734]">navarra</span>
          </span>
          <span className="hidden border-l border-[#e5e1d8] pl-3 text-xs font-medium text-[#77756e] sm:inline">
            ADMINISTRACIÓN
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="/plataforma"
            className="hidden text-sm font-medium text-[#6d6a63] hover:text-[#bd3734] sm:inline"
          >
            Ver plataforma ↗
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              aria-expanded={isAccountMenuOpen}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f8f7f3]"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f8eeeb] text-xs font-semibold text-[#bd3734]">
                {initials}
              </span>
              <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                {adminEmail}
              </span>
              <span aria-hidden="true" className="text-xs">
                ⌄
              </span>
            </button>
            {isAccountMenuOpen ? (
              <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-[#e5e1d8] bg-white p-2 shadow-xl">
                <p className="truncate px-3 py-2 text-xs text-[#77756e]">{adminEmail}</p>
                <a
                  href="/plataforma"
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-[#f8f7f3]"
                >
                  Mi cuenta
                </a>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#bd3734] hover:bg-[#fbefec]"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1600px] lg:grid-cols-[248px_minmax(0,1fr)]">
        {isMobileNavigationOpen ? (
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setIsMobileNavigationOpen(false)}
            className="fixed inset-0 top-16 z-10 bg-black/25 lg:hidden"
          />
        ) : null}
        <aside
          className={[
            'z-20 border-r border-[#e5e1d8] bg-[#fbfaf7] p-4 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)]',
            isMobileNavigationOpen
              ? 'fixed inset-y-16 left-0 block w-[min(84vw,300px)] overflow-y-auto shadow-2xl'
              : 'hidden',
          ].join(' ')}
        >
          <nav aria-label="Navegación administrativa" className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#99958c]">
                  {group.title}
                </p>
                <div className="grid gap-1">
                  {group.items.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => changeSection(key)}
                      aria-current={activeSection === key ? 'page' : undefined}
                      className={[
                        'flex min-h-10 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                        activeSection === key
                          ? 'bg-[#f8eae7] font-semibold text-[#b83431]'
                          : 'text-[#67655f] hover:bg-white hover:text-[#302f2b]',
                      ].join(' ')}
                    >
                      <span aria-hidden="true" className="w-5 text-center text-base">
                        {key === 'resumen'
                          ? '⌂'
                          : key === 'convocatorias'
                            ? '▤'
                            : key === 'temas'
                              ? '☷'
                              : key === 'examenes'
                                ? '▣'
                                : key === 'preguntas'
                                  ? '?'
                                  : key === 'usuarios'
                                    ? '♙'
                                    : key === 'suscripciones'
                                      ? '↻'
                                      : '◇'}
                      </span>
                      {sectionLabels[key]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <p className="mt-10 border-t border-[#e5e1d8] px-3 pt-5 text-xs leading-5 text-[#8b887f]">
            Gestión segura del contenido y las cuentas de OposNavarra.
          </p>
        </aside>

        <section className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-9">
          <div className="mb-7 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="mb-2 text-xs text-[#8b887f]">
                Administración <span className="mx-2">/</span> {sectionLabels[activeSection]}
              </p>
              <h1
                ref={catalogHeadingRef}
                tabIndex={-1}
                className="outline-none font-serif text-3xl font-normal tracking-[-0.04em] text-[#302f2b] sm:text-4xl"
              >
                {isCatalogForm
                  ? `${isEditingCatalog ? 'Editar' : 'Crear'} ${catalogEntityLabel}`
                  : pageTitles[activeSection]}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#77756e]">
                {pageDescriptions[activeSection]}
              </p>
            </div>
            {isCatalogSection ? (
              <button
                type="button"
                onClick={() =>
                  isCatalogForm ? closeCatalogForm() : openCatalogForm(activeSection)
                }
                className="min-h-11 rounded-lg bg-[#bd3734] px-4 text-sm font-semibold text-white hover:bg-[#a82f2c]"
              >
                {isCatalogForm ? 'Volver al listado' : `+ Crear ${catalogEntityLabel}`}
              </button>
            ) : null}
            {activeSection === 'resumen' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openCatalogForm('convocatorias')}
                  className="min-h-11 rounded-lg bg-[#bd3734] px-4 font-sans text-sm font-semibold text-white hover:bg-[#a82f2c]"
                >
                  + Nueva convocatoria
                </button>
                <button
                  type="button"
                  onClick={() => openCatalogForm('examenes')}
                  className="min-h-11 rounded-lg border border-[#d8d2c8] bg-white px-4 font-sans text-sm font-semibold text-[#393833] hover:bg-[#f8f7f3]"
                >
                  Crear examen
                </button>
              </div>
            ) : null}
          </div>

          {activeSection !== 'resumen' && !isCatalogForm ? (
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e5e1d8] bg-white p-4 md:flex-row md:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">
                  Buscar en {pageTitles[activeSection].toLocaleLowerCase('es')}
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#99958c]"
                >
                  ⌕
                </span>
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={
                    activeSection === 'usuarios'
                      ? 'Buscar por ID de usuario...'
                      : `Buscar ${pageTitles[activeSection].toLocaleLowerCase('es')}...`
                  }
                  className="min-h-11 w-full rounded-lg border border-[#e5e1d8] bg-[#fdfcf9] pl-9 pr-3 text-sm"
                />
              </label>
              {filterOptions[activeSection].length > 0 ? (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <span className="sr-only">Filtrar por estado</span>
                  <select
                    value={activeFilter}
                    onChange={(event) => {
                      setActiveFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="min-h-11 w-full rounded-lg border border-[#e5e1d8] bg-white px-3 text-sm md:w-auto"
                  >
                    {filterOptions[activeSection].map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {activeSection === 'suscripciones' ? (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <span className="sr-only">Filtrar por plan</span>
                  <select
                    value={planFilter}
                    onChange={(event) => {
                      setPlanFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="min-h-11 w-full rounded-lg border border-[#e5e1d8] bg-white px-3 text-sm md:w-auto"
                  >
                    <option value="">Todos los planes</option>
                    {planes.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {!loading && errorMessage ? (
            <div
              role="alert"
              className="mb-5 flex flex-col gap-3 rounded-xl border border-[#e7c4c1] bg-[#fff5f4] px-4 py-3 text-sm text-[#8b2926] sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => void loadData()}
                className="font-semibold underline"
              >
                Reintentar
              </button>
            </div>
          ) : null}
          {listLoading ? (
            <p role="status" className="mb-4 text-sm text-[#77756e]">
              Actualizando resultados…
            </p>
          ) : null}
          {loading ? (
            <div
              role="status"
              className="rounded-2xl border border-[#e5e1d8] bg-white p-10 text-center text-sm text-[#77756e]"
            >
              Cargando panel administrativo…
            </div>
          ) : (
            <>
              {renderCurrentSection()}
              {activeSection !== 'resumen' && !isCatalogForm ? (
                <div className="mt-5 flex flex-col gap-3 text-sm text-[#77756e] sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {activeRowCount > 0
                      ? `Mostrando ${(activePage - 1) * PAGE_SIZE + 1}–${Math.min(activePage * PAGE_SIZE, activeRowCount)} de ${activeRowCount}`
                      : 'Sin registros'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={activePage <= 1}
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      className="min-h-10 rounded-lg border border-[#e5e1d8] bg-white px-3 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="min-w-16 text-center">
                      {activePage} / {activePageCount}
                    </span>
                    <button
                      type="button"
                      disabled={activePage >= activePageCount}
                      onClick={() => setCurrentPage((page) => Math.min(activePageCount, page + 1))}
                      className="min-h-10 rounded-lg border border-[#e5e1d8] bg-white px-3 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
