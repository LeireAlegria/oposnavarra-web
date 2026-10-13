'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type SectionKey =
  | 'resumen'
  | 'convocatorias'
  | 'temas'
  | 'examenes'
  | 'preguntas'
  | 'usuarios'
  | 'planes';

type Convocatoria = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  created_at?: string;
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
  descripcion?: string | null;
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
  estado?: string;
  origen?: string;
  situacion?: string;
  examen_id?: string | null;
  created_at?: string;
  respuestas?: Respuesta[];
};

type Perfil = {
  id: string;
  rol?: string | null;
  created_at?: string;
  updated_at?: string;
};

type Plan = {
  id: string;
  codigo: string;
  nombre: string;
  activo?: boolean;
  precio_centimos?: number;
  duracion_meses?: number;
};

type Suscripcion = {
  id: string;
  usuario_id: string;
  estado?: string;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  plan_id?: string | null;
  planes?: { nombre?: string | null } | null;
};

type QuestionForm = {
  enunciado: string;
  estado: 'revision' | 'publicada' | 'desactivada';
  origen: 'propia' | 'oficial';
  situacion: 'ordinaria' | 'reserva' | 'anulada';
  examen_id: string;
  answers: Respuesta[];
  topicIds: string[];
};

const emptyQuestionForm: QuestionForm = {
  enunciado: '',
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
  resumen: 'Resumen',
  convocatorias: 'Convocatorias',
  temas: 'Temas',
  examenes: 'Exámenes',
  preguntas: 'Preguntas',
  usuarios: 'Usuarios',
  planes: 'Planes y suscripciones',
};

export function AdminConsole() {
  const [activeSection, setActiveSection] = useState<SectionKey>('resumen');
  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [convocatoriasResult, temasResult, examenesResult, preguntasResult, perfilesResult, planesResult, suscripcionesResult] =
        await Promise.all([
          supabase.from('convocatorias').select('*').order('created_at', { ascending: false }),
          supabase.from('temas').select('*').order('created_at', { ascending: false }),
          supabase.from('examenes').select('*').order('created_at', { ascending: false }),
          supabase.from('preguntas').select('*, respuestas(*)').order('created_at', { ascending: false }),
          supabase.from('perfiles').select('*').order('created_at', { ascending: false }),
          supabase.from('planes').select('*').order('orden', { ascending: true }),
          supabase.from('suscripciones').select('*, planes(nombre)').order('created_at', { ascending: false }),
        ]);

      if (convocatoriasResult.error) throw convocatoriasResult.error;
      if (temasResult.error) throw temasResult.error;
      if (examenesResult.error) throw examenesResult.error;
      if (preguntasResult.error) throw preguntasResult.error;
      if (perfilesResult.error) throw perfilesResult.error;
      if (planesResult.error) throw planesResult.error;
      if (suscripcionesResult.error) throw suscripcionesResult.error;

      setConvocatorias((convocatoriasResult.data ?? []) as Convocatoria[]);
      setTemas((temasResult.data ?? []) as Tema[]);
      setExamenes((examenesResult.data ?? []) as Examen[]);
      setPreguntas((preguntasResult.data ?? []) as Pregunta[]);
      setPerfiles((perfilesResult.data ?? []) as Perfil[]);
      setPlanes((planesResult.data ?? []) as Plan[]);
      setSuscripciones((suscripcionesResult.data ?? []) as Suscripcion[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el panel de administración.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleEntityActive(table: 'convocatorias' | 'temas' | 'planes', id: string, currentValue: boolean) {
    const nextValue = !currentValue;
    const { error } = await supabase.from(table).update({ activo: nextValue }).eq('id', id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (table === 'convocatorias') {
      setConvocatorias((current) => current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)));
    }
    if (table === 'temas') {
      setTemas((current) => current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)));
    }
    if (table === 'planes') {
      setPlanes((current) => current.map((item) => (item.id === id ? { ...item, activo: nextValue } : item)));
    }
  }

  async function saveConvocatoria(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      activo: String(formData.get('activo') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre de la convocatoria es obligatorio.');
      return;
    }

    const { error } = await supabase.from('convocatorias').insert(payload);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    await loadData();
  }

  async function saveTema(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      activo: String(formData.get('activo') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre del tema es obligatorio.');
      return;
    }

    const { error } = await supabase.from('temas').insert(payload);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    await loadData();
  }

  async function saveExamen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      nombre: String(formData.get('nombre') ?? '').trim(),
      descripcion: String(formData.get('descripcion') ?? '').trim() || null,
      es_oficial: String(formData.get('es_oficial') ?? 'true') === 'true',
    };

    if (!payload.nombre) {
      setErrorMessage('El nombre del examen es obligatorio.');
      return;
    }

    const { error } = await supabase.from('examenes').insert(payload);
    if (error) {
      setErrorMessage(error.message);
      return;
    }

    event.currentTarget.reset();
    await loadData();
  }

  async function saveQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!questionForm.enunciado.trim()) {
      setErrorMessage('El enunciado de la pregunta es obligatorio.');
      return;
    }

    const validAnswers = questionForm.answers.filter((answer) => answer.texto.trim());
    if (validAnswers.length !== 4) {
      setErrorMessage('Cada pregunta debe tener exactamente cuatro opciones con texto.');
      return;
    }
    if (validAnswers.filter((answer) => answer.es_correcta).length !== 1) {
      setErrorMessage('Cada pregunta debe tener exactamente una respuesta correcta.');
      return;
    }

    try {
      const insertion = await supabase
        .from('preguntas')
        .insert({
          enunciado: questionForm.enunciado,
          estado: questionForm.estado,
          origen: questionForm.origen,
          situacion: questionForm.situacion,
          examen_id: questionForm.examen_id || null,
        })
        .select('id')
        .single();

      if (insertion.error) {
        throw insertion.error;
      }

      const questionId = insertion.data.id;

      const answerRows = validAnswers.map((answer, index) => ({
        pregunta_id: questionId,
        orden: index + 1,
        texto: answer.texto.trim(),
        es_correcta: answer.es_correcta,
      }));

      const { error } = await supabase.from('respuestas').insert(answerRows);
      if (error) {
        throw error;
      }

      if (questionForm.topicIds.length > 0) {
        const topicRows = questionForm.topicIds.map((topicId) => ({
          pregunta_id: questionId,
          tema_id: topicId,
        }));

        const { error: topicError } = await supabase.from('pregunta_tema').insert(topicRows);
        if (topicError) {
          throw topicError;
        }
      }

      setQuestionForm(emptyQuestionForm);
      event.currentTarget.reset();
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

    setPerfiles((current) => current.map((item) => (item.id === profileId ? { ...item, rol: nextRole } : item)));
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Convocatorias', value: convocatorias.length },
      { label: 'Temas', value: temas.length },
      { label: 'Exámenes', value: examenes.length },
      { label: 'Preguntas', value: preguntas.length },
      { label: 'Usuarios', value: perfiles.length },
      { label: 'Planes', value: planes.length },
      { label: 'Suscripciones', value: suscripciones.length },
    ],
    [convocatorias.length, examenes.length, perfiles.length, planes.length, preguntas.length, suscripciones.length, temas.length],
  );

  const renderResumen = () => (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article key={card.label} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5 shadow-[0_26px_70px_rgba(23,60,58,0.04)]">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold text-[var(--ink)]">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-6 md:p-8">
        <p className="eyebrow">Checklist</p>
        <ul className="mt-4 space-y-3 text-[var(--muted)]">
          <li>• Gestión del catálogo de convocatorias, temas y exámenes.</li>
          <li>• Alta, edición y revisión de preguntas con validación editorial.</li>
          <li>• Control del rol de usuarios desde public.perfiles.rol.</li>
          <li>• Consulta de planes y suscripciones sin permitir escrituras de pago.</li>
        </ul>
      </section>
    </div>
  );

  const renderConvocatorias = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {convocatorias.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--ink)]">{item.nombre}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.descripcion ?? 'Sin descripción'}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleEntityActive('convocatorias', item.id, Boolean(item.activo))}
                className={['rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]', item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'].join(' ')}
              >
                {item.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={saveConvocatoria} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
        <p className="eyebrow">Crear convocatoria</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
            <input name="nombre" className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Descripción</span>
            <textarea name="descripcion" className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
            <input type="checkbox" name="activo" defaultChecked />
            Activa
          </label>
          <button type="submit" className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white">
            Guardar convocatoria
          </button>
        </div>
      </form>
    </div>
  );

  const renderTemas = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {temas.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--ink)]">{item.nombre}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.descripcion ?? 'Sin descripción'}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleEntityActive('temas', item.id, Boolean(item.activo))}
                className={['rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]', item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'].join(' ')}
              >
                {item.activo ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <form onSubmit={saveTema} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
        <p className="eyebrow">Crear tema</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
            <input name="nombre" className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Descripción</span>
            <textarea name="descripcion" className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
            <input type="checkbox" name="activo" defaultChecked />
            Activo
          </label>
          <button type="submit" className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white">
            Guardar tema
          </button>
        </div>
      </form>
    </div>
  );

  const renderExamenes = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {examenes.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <h3 className="text-xl font-semibold text-[var(--ink)]">{item.nombre}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.descripcion ?? 'Sin descripción'}</p>
          </article>
        ))}
      </div>

      <form onSubmit={saveExamen} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
        <p className="eyebrow">Crear examen</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Nombre</span>
            <input name="nombre" className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Descripción</span>
            <textarea name="descripcion" className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5" />
          </label>
          <label className="flex items-center gap-3 text-sm text-[var(--ink)]">
            <input type="checkbox" name="es_oficial" defaultChecked />
            Examen oficial
          </label>
          <button type="submit" className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white">
            Guardar examen
          </button>
        </div>
      </form>
    </div>
  );

  const renderPreguntas = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {preguntas.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">{item.estado}</p>
            <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.enunciado}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Origen: {item.origen} · Situación: {item.situacion}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">{item.respuestas?.length ?? 0} respuestas</p>
          </article>
        ))}
      </div>

      <form onSubmit={saveQuestion} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
        <p className="eyebrow">Nueva pregunta</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Enunciado</span>
            <textarea
              value={questionForm.enunciado}
              onChange={(event) => setQuestionForm((current) => ({ ...current, enunciado: event.target.value }))}
              className="min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Estado</span>
              <select
                value={questionForm.estado}
                onChange={(event) => setQuestionForm((current) => ({ ...current, estado: event.target.value as QuestionForm['estado'] }))}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="revision">Revisión</option>
                <option value="publicada">Publicada</option>
                <option value="desactivada">Desactivada</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Origen</span>
              <select
                value={questionForm.origen}
                onChange={(event) => setQuestionForm((current) => ({ ...current, origen: event.target.value as QuestionForm['origen'] }))}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="propia">Propia</option>
                <option value="oficial">Oficial</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Situación</span>
              <select
                value={questionForm.situacion}
                onChange={(event) => setQuestionForm((current) => ({ ...current, situacion: event.target.value as QuestionForm['situacion'] }))}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5"
              >
                <option value="ordinaria">Ordinaria</option>
                <option value="reserva">Reserva</option>
                <option value="anulada">Anulada</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-[var(--ink)]">Examen</span>
            <select
              value={questionForm.examen_id}
              onChange={(event) => setQuestionForm((current) => ({ ...current, examen_id: event.target.value }))}
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
                        topicIds: selected ? current.topicIds.filter((id) => id !== tema.id) : [...current.topicIds, tema.id],
                      }))
                    }
                    className={['rounded-full border px-3 py-2 text-xs font-semibold', selected ? 'border-[var(--coral)] bg-[rgba(243,111,94,0.08)] text-[var(--coral)]' : 'border-[var(--line)] bg-white text-[var(--ink)]'].join(' ')}
                  >
                    {tema.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {questionForm.answers.map((answer, index) => (
              <div key={index} className="rounded-xl border border-[var(--line)] bg-[rgba(22,31,29,0.02)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[var(--ink)]">Opción {index + 1}</span>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={answer.es_correcta}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          answers: current.answers.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, es_correcta: event.target.checked } : item,
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

          <button type="submit" className="w-full rounded-full bg-[var(--coral)] px-5 py-3 font-sans text-sm font-semibold text-white">
            Guardar pregunta
          </button>
        </div>
      </form>
    </div>
  );

  const renderUsuarios = () => (
    <div className="space-y-4">
      {perfiles.map((item) => (
        <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-[0.18em] text-[var(--coral)]">{item.rol ?? 'usuario'}</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--ink)]">{item.id}</h3>
            </div>
            <button
              type="button"
              onClick={() => toggleProfileRole(item.id, item.rol ?? 'usuario')}
              className={['rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]', item.rol === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'].join(' ')}
            >
              {item.rol === 'admin' ? 'Quitar admin' : 'Dar admin'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );

  const renderPlanes = () => (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-4">
        {planes.map((item) => (
          <article key={item.id} className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--ink)]">{item.nombre}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.codigo} · {(item.precio_centimos ?? 0) / 100} € · {item.duracion_meses ?? 0} meses</p>
              </div>
              <button
                type="button"
                onClick={() => toggleEntityActive('planes', item.id, Boolean(item.activo))}
                className={['rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.12em]', item.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'].join(' ')}
              >
                {item.activo ? 'Disponible' : 'No disponible'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
        <p className="eyebrow">Suscripciones</p>
        <div className="mt-4 space-y-3">
          {suscripciones.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-3">
              <p className="text-sm font-semibold text-[var(--ink)]">{item.estado}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Usuario: {item.usuario_id}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Plan: {item.planes?.nombre ?? 'Sin plan'}</p>
            </div>
          ))}
        </div>
      </div>
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
      case 'planes':
        return renderPlanes();
      case 'resumen':
      default:
        return renderResumen();
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap gap-2">
        {(Object.keys(sectionLabels) as SectionKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={[
              'rounded-full px-4 py-2 font-sans text-sm font-semibold transition-colors',
              activeSection === key ? 'bg-[var(--coral)] text-white' : 'border border-[var(--line)] bg-white text-[var(--ink)]',
            ].join(' ')}
          >
            {sectionLabels[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-10 text-center text-[var(--muted)]">
          Cargando panel administrativo...
        </div>
      ) : null}

      {!loading && errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      {!loading ? renderCurrentSection() : null}
    </div>
  );
}
