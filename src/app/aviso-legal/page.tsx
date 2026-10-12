export const metadata = {
  title: 'Aviso legal',
  description: 'Aviso legal y condiciones generales de uso de OposNavarra.',
};

export default function LegalNoticePage() {
  return (
    <main className="page-shell py-10 md:py-14">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 md:p-8">
        <p className="eyebrow">Aviso legal</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-5xl">
          Condiciones generales
        </h1>
        <div className="mt-6 space-y-4 text-[var(--muted)]">
          <p>
            El sitio web de OposNavarra tiene como finalidad informar sobre la plataforma de práctica y
            la oferta comercial de suscripción, así como facilitar consultas generales.
          </p>
          <p>
            El contenido puede actualizarse en función de la evolución del catálogo, las modalidades y
            la disponibilidad de la plataforma. El acceso a los tests y la contratación efectiva de
            suscripciones quedan regulados por las especificaciones técnicas y contractuales vigentes.
          </p>
          <p>
            El texto legal definitivo se publicará cuando la documentación comercial y contractual esté
            cerrada y aprobada.
          </p>
        </div>
      </article>
    </main>
  );
}
