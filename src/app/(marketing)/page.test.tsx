import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));
vi.mock('@/lib/free-demo-server', () => ({
  getDemoAvailable: vi.fn(async () => null),
  getPublicCatalog: vi.fn(async () => [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Administrativo de Navarra',
      topics: [{ name: 'Tema publicado', number: 1, count: 12 }],
    },
  ]),
}));
vi.mock('@/lib/subscriptions', () => ({ getPublicPlans: vi.fn(async () => []) }));
import HomePage from './page';
afterEach(cleanup);
describe('HomePage', () => {
  it('puts the complete origin story before the commercial sections and uses real catalog data', async () => {
    render(await HomePage());
    const heading = screen.getByRole('heading', {
      name: 'Prepara Administrativo de Navarra, pregunta a pregunta.',
    });
    expect(heading).toBeInTheDocument();
    const origin = screen.getByRole('heading', {
      name: 'Una plataforma que nace de la experiencia de una opositora',
    });
    expect(
      origin.compareDocumentPosition(screen.getByRole('heading', { name: 'Cómo funciona' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText(/Elisa, una de nuestras socias/)).toBeVisible();
    expect(screen.getByText(/Incorporaremos nuevos tests/)).toBeVisible();
    expect(screen.getByText(/Tema publicado/)).toHaveTextContent('12 preguntas publicadas');
    expect(screen.getByRole('link', { name: 'Probar 5 preguntas gratis' })).toHaveAttribute(
      'href',
      '/prueba-gratis',
    );
    expect(
      screen.queryByText(/MVP|Vista ilustrativa|plataforma está en preparación/),
    ).not.toBeInTheDocument();
  });
});
