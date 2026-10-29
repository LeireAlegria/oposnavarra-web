'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ContactMessage = {
  id: string;
  nombre: string;
  email: string;
  mensaje: string;
  created_at: string;
  leido: boolean;
};
const dateFormat = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});
export function ContactMessages() {
  const [client] = useState(createClient);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        let query = client.from('mensajes_contacto').select('*', { count: 'exact' });
        if (filter !== 'all') query = query.eq('leido', filter === 'read');
        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(page * 25, page * 25 + 24);
        if (result.error) throw result.error;
        if (current) {
          if (page > 0 && page * 25 >= (result.count ?? 0)) {
            setPage(Math.max(0, Math.ceil((result.count ?? 0) / 25) - 1));
            return;
          }
          setItems(result.data ?? []);
          setTotal(result.count ?? 0);
        }
      } catch {
        if (current) {
          setItems([]);
          setError('No se pudieron cargar los mensajes. Vuelve a intentarlo.');
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [client, filter, page, revision]);
  async function toggleRead() {
    if (!selected || saving) return;
    setSaving(true);
    setError('');
    try {
      const { data, error } = await client
        .from('mensajes_contacto')
        .update({ leido: !selected.leido })
        .eq('id', selected.id)
        .select()
        .single();
      if (error || !data) throw error;
      setSelected(data);
      setRevision((value) => value + 1);
    } catch {
      setError('No se pudo cambiar el estado. Vuelve a intentarlo.');
    } finally {
      setSaving(false);
    }
  }
  const buttonClass = 'rounded-lg border px-4 py-2 disabled:opacity-50';
  return (
    <div className="space-y-5">
      <label className="block">
        Estado del mensaje{' '}
        <select
          className="ml-2 rounded border p-2"
          value={filter}
          disabled={saving}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
            setSelected(null);
          }}
        >
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="read">Leídos</option>
        </select>
      </label>
      {error && (
        <div role="alert">
          {error}{' '}
          <button className={buttonClass} onClick={() => setRevision((value) => value + 1)}>
            Reintentar carga
          </button>
        </div>
      )}
      {selected && (
        <section
          aria-label="Detalle del mensaje"
          className="space-y-3 rounded-xl border bg-white p-5"
        >
          <h2 className="break-words text-xl">{selected.nombre}</h2>
          <p className="break-all">{selected.email}</p>
          <p>{dateFormat.format(new Date(selected.created_at))}</p>
          <p>{selected.leido ? 'Leído' : 'Pendiente'}</p>
          <p className="whitespace-pre-wrap break-words">{selected.mensaje}</p>
          <div className="flex flex-wrap gap-3">
            <button className={buttonClass} disabled={saving} onClick={toggleRead}>
              {saving
                ? 'Guardando…'
                : selected.leido
                  ? 'Marcar como pendiente'
                  : 'Marcar como leído'}
            </button>
            <button className={buttonClass} disabled={saving} onClick={() => setSelected(null)}>
              Cerrar mensaje
            </button>
          </div>
        </section>
      )}
      {loading ? (
        <p role="status">Cargando mensajes…</p>
      ) : !error && items.length === 0 ? (
        <p>No hay mensajes para esta selección.</p>
      ) : (
        <ul className="space-y-3" aria-label="Mensajes de contacto">
          {items.map((item) => (
            <li
              key={item.id}
              className={`space-y-2 rounded-xl border p-4 ${item.leido ? 'bg-white' : 'border-orange-300 bg-orange-50 font-semibold'}`}
            >
              <p className="break-words">{item.nombre}</p>
              <p className="break-all">{item.email}</p>
              <p>
                {dateFormat.format(new Date(item.created_at))} ·{' '}
                {item.leido ? 'Leído' : 'Pendiente'}
              </p>
              <button
                disabled={saving}
                className={buttonClass}
                onClick={() => {
                  setSelected(item);
                  setError('');
                }}
              >
                Abrir mensaje de {item.nombre}
              </button>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Paginación de mensajes" className="flex flex-wrap items-center gap-3">
        <button
          className={buttonClass}
          disabled={loading || saving || page === 0}
          onClick={() => setPage((value) => value - 1)}
        >
          Anterior
        </button>
        <span>Página {page + 1}</span>
        <button
          className={buttonClass}
          disabled={loading || saving || (page + 1) * 25 >= total}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente
        </button>
      </nav>
    </div>
  );
}
