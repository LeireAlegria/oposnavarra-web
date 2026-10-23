'use client';

import { useId, useState } from 'react';

export function ImportTopicPicker({
  label,
  topics,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  topics: { id: string; nombre: string; descripcion: string | null }[];
  value: string;
  onChange: (value: string) => void;
  allowNone?: boolean;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const selected = topics.find((topic) => topic.id === value);
  const query = search.trim().toLocaleLowerCase('es');
  const filtered = topics.filter((topic) =>
    `${topic.nombre} ${topic.descripcion || ''}`.toLocaleLowerCase('es').includes(query),
  );
  return (
    <div className="min-w-0 space-y-2 text-sm text-[#302f2b]">
      <p id={`${id}-label`} className="font-medium">
        {label}
      </p>
      <button
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#d9d5cc] bg-white px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-[#bd3734]"
        onClick={() => setOpen(!open)}
      >
        <span id={`${id}-value`} className="min-w-0 whitespace-normal break-words">
          {selected?.nombre || (value === 'none' ? 'Sin tema' : 'Selecciona un tema…')}
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {selected && (
        <p className="whitespace-pre-wrap break-words leading-6 text-[#57544b]">
          {selected.descripcion || 'Sin descripción disponible.'}
        </p>
      )}
      {open && (
        <div
          id={`${id}-options`}
          className="space-y-3 rounded-lg border border-[#d9d5cc] bg-white p-3"
        >
          <label className="block font-medium">
            Buscar tema
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-[#d9d5cc] px-3 py-2 font-normal"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div role="group" aria-label={label} className="max-h-80 space-y-2 overflow-y-auto">
            {allowNone && (
              <button
                type="button"
                className="min-h-11 w-full rounded-lg border border-[#d9d5cc] p-3 text-left"
                onClick={() => {
                  onChange('none');
                  setOpen(false);
                }}
              >
                Dejar explícitamente sin tema
              </button>
            )}
            {filtered.map((topic) => (
              <button
                type="button"
                key={topic.id}
                aria-pressed={value === topic.id}
                className="block w-full whitespace-normal break-words rounded-lg border border-[#d9d5cc] p-3 text-left hover:bg-[#f7f5f0] focus-visible:outline-2 focus-visible:outline-[#bd3734] aria-pressed:border-[#bd3734] aria-pressed:bg-[#fff5f2]"
                onClick={() => {
                  onChange(topic.id);
                  setOpen(false);
                }}
              >
                <span className="block font-semibold leading-6">{topic.nombre}</span>
                <span className="mt-1 block whitespace-pre-wrap font-normal leading-6 text-[#57544b]">
                  {topic.descripcion || 'Sin descripción disponible.'}
                </span>
              </button>
            ))}
            {!filtered.length && (
              <p role="status">
                {topics.length
                  ? 'No hay temas que coincidan con la búsqueda.'
                  : 'No hay temas disponibles.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
