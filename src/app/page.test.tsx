import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('shows the sales landing content and the two primary calls to action', async () => {
    render(await HomePage());

    const testsLinks = screen.getAllByRole('link', { name: /oposición|convocatoria/i });
    const plansLinks = screen.getAllByRole('link', { name: 'Ver planes' });

    expect(screen.getByRole('heading', { name: /estudia con foco/i })).toBeInTheDocument();
    expect(testsLinks.some((link) => link.getAttribute('href') === '/tests')).toBe(true);
    expect(plansLinks.some((link) => link.getAttribute('href') === '/planes')).toBe(true);
    expect(screen.getByText('En preparación')).toBeInTheDocument();
    expect(screen.getByText(/una suscripción global/i)).toBeInTheDocument();
  });
});
