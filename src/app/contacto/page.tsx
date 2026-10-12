import { ContactForm } from '@/components/contact-form';

export const metadata = {
  title: 'Contacto',
  description: 'Envíanos tu consulta sobre OposNavarra, las convocatorias o las modalidades de suscripción.',
};

export default function ContactPage() {
  return (
    <main className="page-shell py-10 md:py-14">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="eyebrow">Contacto</p>
          <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-6xl">
            Envíanos tu consulta
          </h1>
          <p className="mt-5 max-w-lg text-lg text-[var(--muted)]">
            Si tienes dudas sobre la plataforma, las convocatorias o la suscripción, te responderemos a la dirección que indiques.
          </p>
          <div className="mt-8 rounded-[2rem] border border-[var(--line)] bg-[rgba(22,31,29,0.03)] p-6 text-sm text-[var(--muted)]">
            <p className="font-sans font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Importante</p>
            <p className="mt-3">
              Este formulario no contrata una suscripción ni activa acceso. Se utiliza para consultas generales sobre el producto y la plataforma.
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 shadow-[0_26px_70px_rgba(23,60,58,0.04)] md:p-8">
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
