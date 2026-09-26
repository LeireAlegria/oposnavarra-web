import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OpponentAreaPage from './page';

describe('OpponentAreaPage', () => {
  it('communicates that the area is not available yet', () => {
    render(<OpponentAreaPage />);
    expect(screen.getByRole('heading', { name: 'Área del opositor' })).toBeInTheDocument();
    expect(screen.getByText(/Próximamente/)).toBeInTheDocument();
  });
});
