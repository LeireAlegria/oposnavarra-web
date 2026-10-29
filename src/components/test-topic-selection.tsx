'use client';

import { useId, useState } from 'react';
import type { TestCatalogTopic } from '@/lib/test-platform-api';

export function TestTopicSelection({
  topics,
  selectedIds,
  onChange,
}: {
  topics: TestCatalogTopic[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const sectionId = useId();
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const blocks = new Map<string, { name: string; topics: TestCatalogTopic[] }>();
  for (const topic of topics) {
    const key = topic.blockId ?? topic.blockName ?? 'General';
    const block = blocks.get(key) ?? { name: topic.blockName || 'General', topics: [] };
    block.topics.push(topic);
    blocks.set(key, block);
  }
  return (
    <div className="space-y-4">
      {Array.from(blocks, ([key, block]) => {
        const selectedCount = block.topics.filter((topic) => selectedIds.includes(topic.id)).length;
        const allSelected = selectedCount === block.topics.length;
        const isExpanded = !collapsedBlocks.has(key);
        const contentId = `${sectionId}-${encodeURIComponent(key)}`;
        return (
          <fieldset
            key={key}
            className="min-w-0 rounded-xl border border-[var(--line)] bg-[#faf9f6] p-3 sm:p-4"
          >
            <legend className="max-w-full px-2 text-base font-bold text-[var(--ink)] break-words">
              {block.name}
            </legend>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={() =>
                  setCollapsedBlocks((current) => {
                    const next = new Set(current);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                aria-label={`${isExpanded ? 'Contraer' : 'Desplegar'} bloque: ${block.name}`}
                className="flex min-h-11 flex-1 items-center gap-2 rounded-lg text-left text-xs text-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734]"
              >
                <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                <span aria-live="polite">
                  {selectedCount} de {block.topics.length} temas seleccionados
                </span>
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#a82f2c] hover:underline focus-visible:outline-2 focus-visible:outline-[#bd3734]"
                aria-label={
                  (allSelected ? 'Desmarcar bloque: ' : 'Seleccionar bloque: ') + block.name
                }
                onClick={() =>
                  onChange(
                    allSelected
                      ? selectedIds.filter((id) => !block.topics.some((topic) => topic.id === id))
                      : [...new Set([...selectedIds, ...block.topics.map((topic) => topic.id)])],
                  )
                }
              >
                {allSelected ? 'Desmarcar bloque' : 'Seleccionar bloque'}
              </button>
            </div>
            <div id={contentId} hidden={!isExpanded} className="space-y-2">
              {block.topics.map((topic) => (
                <label
                  key={topic.id}
                  className={[
                    'flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6 transition-colors',
                    selectedIds.includes(topic.id)
                      ? 'border-[#bd3734] bg-[#fbefec] text-[#302f2b]'
                      : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[#bd3734]',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(topic.id)}
                    onChange={() =>
                      onChange(
                        selectedIds.includes(topic.id)
                          ? selectedIds.filter((id) => id !== topic.id)
                          : [...selectedIds, topic.id],
                      )
                    }
                    className="mt-1 h-4 w-4 shrink-0 accent-[#bd3734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734]"
                  />
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{topic.number}.</span> {topic.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
      {!topics.length && (
        <p className="rounded-xl border border-[var(--line)] p-4 text-sm text-[var(--muted)]">
          No hay temas disponibles en esta convocatoria.
        </p>
      )}
    </div>
  );
}
