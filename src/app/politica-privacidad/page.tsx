export const metadata = {
  title: 'Política de privacidad',
  description: 'Información sobre el tratamiento de los datos y la privacidad de OposNavarra.',
};

export default function PrivacyPage() {
  return (
    <main className="page-shell py-10 md:py-14">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--line)] bg-white/80 p-6 md:p-8">
        <p className="eyebrow">Política de privacidad</p>
        <h1 className="text-4xl font-normal tracking-[-0.06em] text-[var(--ink)] md:text-5xl">
          Protección de datos
        </h1>
        <div className="mt-6 space-y-4 text-[var(--muted)]">
          <p>
            OposNavarra trata la información necesaria para gestionar la cuenta del usuario, la
            prestación de la plataforma y la atención a consultas y suscripciones.
          </p>
          <p>
            Los datos se utilizan únicamente para los fines previstos por la plataforma y se limitan al
            mínimo necesario para ofrecer el servicio. La información de contacto se emplea para
            responder consultas y comunicar actualizaciones relevantes del servicio.
          </p>
          <p>
            Cuando la documentación legal final esté publicada, este apartado se actualizará para
            reflejar el texto definitivo y los derechos de la persona interesada.
          </p>
        </div>
      </article>
    </main>
  );
}
