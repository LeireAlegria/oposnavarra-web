'use client';
import { useEffect, useRef } from 'react';
export function PathConfirmation({
  title,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
    return () => dialog?.close?.();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="path-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-[var(--line)] bg-white p-6 text-[var(--ink)] shadow-xl backdrop:bg-black/40"
    >
      <h2 id="path-confirm-title" className="text-2xl">
        {title}
      </h2>
      <div className="my-5 leading-7">{children}</div>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className="min-h-11 rounded-lg border px-4" onClick={onCancel}>
          Cancelar
        </button>
        <button className="min-h-11 rounded-lg bg-[#b83b34] px-4 text-white" onClick={onConfirm}>
          Confirmar
        </button>
      </div>
    </dialog>
  );
}
