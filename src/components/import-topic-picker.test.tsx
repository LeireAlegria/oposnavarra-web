import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ImportTopicPicker } from './import-topic-picker';

afterEach(cleanup);

it('shows complete descriptions and lets an administrator search and distinguish equally named topics', () => {
  const onChange = vi.fn();
  const description = 'Contenido completo del tema. '.repeat(20);
  render(
    <ImportTopicPicker
      label="Tema de destino"
      value=""
      onChange={onChange}
      topics={[
        { id: 'one', nombre: 'Legislación', descripcion: description },
        { id: 'two', nombre: 'Legislación', descripcion: 'Procedimiento administrativo' },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Tema de destino/ }));
  expect(screen.getByText(description.trim())).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Buscar tema'), { target: { value: 'procedimiento' } });
  expect(screen.queryByText(description.trim())).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Legislación Procedimiento administrativo' }));
  expect(onChange).toHaveBeenCalledWith('two');
  expect(screen.queryByLabelText('Buscar tema')).not.toBeInTheDocument();
});
