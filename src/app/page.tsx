import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-3xl flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">OposNavarra</h1>
      <p className="text-lg text-neutral-600">La aplicación está en desarrollo.</p>
      <Button disabled>Próximamente</Button>
    </main>
  );
}
