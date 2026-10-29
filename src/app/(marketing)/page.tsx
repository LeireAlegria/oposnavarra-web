import Link from 'next/link';
import { FreeDemo } from '@/components/free-demo';
import { PublicCatalogContent } from '@/components/public-catalog';
import { formatPrice } from '@/lib/public-content';
import { getPublicPlans } from '@/lib/subscriptions';
import { getDemoAvailable, getPublicCatalog } from '@/lib/free-demo-server';
import { createClient } from '@/lib/supabase/server';
import { DemoTrackedLink, LandingMeasurement } from '@/components/demo-measurement';
const primaryClass =
  'inline-flex min-h-12 items-center justify-center rounded-lg bg-[#b94235] px-6 py-3 font-semibold text-white';
export default async function HomePage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const [available, catalog, plans] = await Promise.all([
    getDemoAvailable(),
    getPublicCatalog(),
    getPublicPlans().catch(() => null),
  ]);
  const single = catalog?.length === 1 ? catalog[0] : null;
  return (
    <main>
      <LandingMeasurement />
      <div className="page-shell grid gap-x-12 gap-y-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
        <section className="max-w-3xl">
          <p className="eyebrow !text-[#a8392f]">
            Tests para {single?.name ?? 'oposiciones de Navarra'}
          </p>
          <h1 className="text-4xl leading-tight sm:text-5xl lg:text-6xl">
            Prepara {single?.name ?? 'tu oposición en Navarra'}, pregunta a pregunta.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Practica por temas, revisa tus respuestas y consulta tus resultados. Empieza con cinco
            preguntas gratis.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-5">
            <DemoTrackedLink className={primaryClass} href="/prueba-gratis" location="hero">
              Probar 5 preguntas gratis
            </DemoTrackedLink>
            <Link href="#que-incluye" className="underline underline-offset-4">
              Ver qué incluye
            </Link>
          </div>
          <p className="mt-3 text-sm">Sin registro · Sin tarjeta</p>
        </section>
        <section
          aria-labelledby="origin-heading"
          className="max-w-3xl space-y-5 text-base leading-7 lg:col-start-1"
        >
          <div className="h-px w-12 bg-[#b94235]" aria-hidden="true" />
          <h2 id="origin-heading" className="text-2xl sm:text-3xl">
            Una plataforma que nace de la experiencia de una opositora
          </h2>
          <p>
            OposNavarra es una plataforma creada para preparar online oposiciones que incluyen, al
            menos, un examen tipo test. Está diseñada pensando en los opositores y en mejorar sus
            condiciones de estudio y aprendizaje.
          </p>
          <p>
            OposNavarra nace de la iniciativa de{' '}
            <strong>Elisa, una de nuestras socias y opositora a Administrativo</strong>. Su
            experiencia de estudio, unida al conocimiento de un equipo de informáticos, nos llevó a
            crear una solución a muchos de los problemas que encontró al preparar sus oposiciones:
          </p>
          <ul className="list-disc space-y-3 pl-5">
            <li>Plataformas de preguntas tipo test con poca calidad y difíciles de utilizar.</li>
            <li>
              Plataformas de pago con un número insuficiente de preguntas, en ocasiones con errores
              y con explicaciones escasas.
            </li>
            <li>Procesos de compra confusos, con añadidos a un paquete base.</li>
            <li>Un exceso de correos electrónicos que no aportan valor al estudio.</li>
            <li>
              La necesidad de instalar una aplicación para estudiar desde el móvil. Con OposNavarra
              puedes acceder directamente desde el navegador de tu smartphone.
            </li>
          </ul>
          <p>
            Por eso hemos creado OposNavarra: una plataforma para el opositor, centrada en la{' '}
            <strong>calidad</strong> y en la <strong>facilidad de uso</strong>.
          </p>
          <p>
            OposNavarra acaba de ver la luz. Incorporaremos nuevos tests de forma continua para
            ampliar el contenido y dar cabida a la mayoría de las oposiciones tipo test de Navarra.
          </p>
        </section>
        <div className="min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <FreeDemo available={available} authenticated={Boolean(user)} />
        </div>
      </div>
      <section id="como-funciona" className="scroll-mt-28 bg-[#173c3a] py-12 text-white">
        <div className="page-shell">
          <h2 className="text-3xl">Cómo funciona</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              [
                '01',
                'Elige un tema y practica.',
                'Configura tu práctica por temas con una suscripción activa.',
              ],
              [
                '02',
                'Revisa tus respuestas y aprende de las correcciones.',
                'Prueba ahora una pregunta real y consulta su explicación al comprobarla.',
              ],
              [
                '03',
                'Consulta tus resultados y continúa preparando tu oposición.',
                'Vuelve al historial de tus tests desde tu área personal.',
              ],
            ].map(([number, title, description]) => (
              <li key={number} className="space-y-3 border-t border-white/30 pt-5">
                <p className="text-[#ffa99b]">{number}</p>
                <h3 className="text-xl">{title}</h3>
                <p className="text-white/85">{description}</p>
              </li>
            ))}
          </ol>
          <DemoTrackedLink
            className="mt-8 inline-block underline"
            href="/prueba-gratis"
            location="inline"
          >
            Ver la práctica y sus correcciones
          </DemoTrackedLink>
        </div>
      </section>
      <section id="temario" className="page-shell scroll-mt-28 space-y-6 py-12">
        <h2 className="text-3xl">Contenido disponible</h2>
        <p>
          El catálogo muestra únicamente convocatorias activas y sus temas. Las preguntas se cuentan
          por tema; una misma pregunta puede pertenecer a varios temas.
        </p>
        <PublicCatalogContent catalog={catalog} />
      </section>
      <section
        id="que-incluye"
        className="page-shell scroll-mt-28 space-y-6 border-t border-[var(--line)] py-12"
      >
        <h2 className="text-3xl">Prueba, cuenta y suscripción: cada paso está claro</h2>
        <dl className="grid gap-6 md:grid-cols-3">
          <div>
            <dt className="text-xl font-semibold">La demostración</dt>
            <dd className="mt-3 leading-7">
              Cinco preguntas, resultado y explicaciones sin cuenta ni tarjeta. Al repetir verás las
              mismas preguntas.
            </dd>
          </div>
          <div>
            <dt className="text-xl font-semibold">Tu cuenta gratuita</dt>
            <dd className="mt-3 leading-7">
              Permite guardar el resultado de la prueba. No activa una suscripción ni da acceso al
              banco completo.
            </dd>
          </div>
          <div>
            <dt className="text-xl font-semibold">La suscripción</dt>
            <dd className="mt-3 leading-7">
              Da acceso al contenido publicado para configurar tests por temas, revisar respuestas y
              consultar el historial.
            </dd>
          </div>
        </dl>
      </section>
      <section className="page-shell space-y-6 py-12">
        <h2 className="text-3xl">Planes para continuar practicando</h2>
        {plans === null ? (
          <p role="alert">
            No se pudieron cargar los planes.{' '}
            <Link className="underline" href="/planes">
              Volver a intentarlo
            </Link>
            .
          </p>
        ) : plans.length === 0 ? (
          <p>No hay planes disponibles en este momento.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.id}
                className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-6"
              >
                <h3 className="text-xl">{plan.name}</h3>
                <p className="text-3xl">{formatPrice(plan.priceCents)}</p>
                <p>
                  Total cobrado por {plan.durationMonths}{' '}
                  {plan.durationMonths === 1 ? 'mes' : 'meses'}.
                </p>
                {plan.durationMonths > 1 && (
                  <p className="text-sm">
                    Equivale a {formatPrice(Math.round(plan.priceCents / plan.durationMonths))}/mes.
                  </p>
                )}
                <p>Renovación {plan.renewal.toLowerCase()}.</p>
              </article>
            ))}
          </div>
        )}
        <p>Si cancelas la renovación, el acceso continúa hasta el final del periodo pagado.</p>
        <Link className="inline-block underline" href="/planes">
          Ver planes y condiciones
        </Link>
      </section>
      <section className="page-shell space-y-5 border-t border-[var(--line)] py-12">
        <h2 className="text-3xl">Preguntas frecuentes</h2>
        {[
          [
            '¿Qué oposición y temas puedo preparar?',
            'Consulta el contenido disponible en esta página. Cada tema indica sus preguntas publicadas y su disponibilidad actual.',
          ],
          [
            '¿Qué incluye la prueba gratuita?',
            'Cinco preguntas fijas de una misma convocatoria, sus correcciones y tu resultado. No tiene cronómetro, penalización ni requisito de registro.',
          ],
          [
            '¿Para qué sirve registrarse?',
            'Puedes guardar esta prueba durante las 24 horas siguientes a su inicio. Crear cuenta no contrata una suscripción.',
          ],
          [
            '¿Qué contenido es de pago?',
            'El acceso al banco completo publicado y la práctica ordinaria requieren una suscripción activa.',
          ],
          [
            '¿Cómo funcionan la renovación y la cancelación?',
            'La renovación es automática con la periodicidad del plan. Puedes cancelarla desde tu cuenta; conservarás el acceso hasta el final del periodo pagado.',
          ],
          [
            '¿Cómo comunico una incidencia?',
            'Utiliza el formulario de contacto e indica la pregunta y la incidencia. No incluyas datos de acceso a tu cuenta.',
          ],
        ].map(([question, answer]) => (
          <details key={question} className="border-b border-[var(--line)] pb-4">
            <summary className="cursor-pointer py-2 font-semibold">{question}</summary>
            <p className="mt-3 max-w-3xl leading-7">{answer}</p>
          </details>
        ))}
        <Link className="inline-block underline" href="/contacto">
          Contactar con OposNavarra
        </Link>
      </section>
      <section className="bg-[#e9ede6] py-12">
        <div className="page-shell space-y-5">
          <h2 className="text-3xl">Empieza con cinco preguntas</h2>
          <p>Una primera experiencia de práctica, sin registro ni tarjeta.</p>
          <DemoTrackedLink href="/prueba-gratis" className={primaryClass} location="closing">
            Probar gratis
          </DemoTrackedLink>
        </div>
      </section>
    </main>
  );
}
