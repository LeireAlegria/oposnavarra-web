import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomePage from './page';

describe('HomePage', () => {
  it('shows the bootstrap status using the shared Button component', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: 'OposNavarra' })).toBeInTheDocument();
    expect(screen.getByText('La aplicación está en desarrollo.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximamente' })).toBeDisabled();
  });
});
