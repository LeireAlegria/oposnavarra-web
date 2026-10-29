import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useState } from 'react';
import { TestTopicSelection } from './test-topic-selection';

afterEach(cleanup);

it('selects each block independently and keeps individual topic selection', () => {
  function Example() {
    const [ids, setIds] = useState(['a', 'b', 'c']);
    return (
      <TestTopicSelection
        selectedIds={ids}
        onChange={setIds}
        topics={[
          {
            id: 'a',
            name: 'Constitución',
            number: 1,
            order: 1,
            blockId: 'one',
            blockName: 'Parte general',
            blockOrder: 1,
            availableQuestions: 10,
          },
          {
            id: 'b',
            name: 'Administración',
            number: 2,
            order: 2,
            blockId: 'one',
            blockName: 'Parte general',
            blockOrder: 1,
            availableQuestions: 10,
          },
          {
            id: 'c',
            name: 'Procedimientos',
            number: 3,
            order: 1,
            blockId: 'two',
            blockName: 'Parte específica',
            blockOrder: 2,
            availableQuestions: 10,
          },
        ]}
      />
    );
  }
  render(<Example />);
  const general = within(screen.getByRole('group', { name: 'Parte general' }));
  const specific = within(screen.getByRole('group', { name: 'Parte específica' }));
  fireEvent.click(general.getByRole('button', { name: 'Desmarcar bloque: Parte general' }));
  expect(general.getByText('0 de 2 temas seleccionados')).toBeInTheDocument();
  expect(specific.getByRole('checkbox')).toBeChecked();
  fireEvent.click(general.getByRole('checkbox', { name: '1. Constitución' }));
  expect(general.getByText('1 de 2 temas seleccionados')).toBeInTheDocument();
  fireEvent.click(general.getByRole('button', { name: 'Seleccionar bloque: Parte general' }));
  expect(
    general.getAllByRole('checkbox').every((input) => (input as HTMLInputElement).checked),
  ).toBe(true);
  const toggle = general.getByRole('button', { name: 'Contraer bloque: Parte general' });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(general.queryAllByRole('checkbox')).toHaveLength(0);
  expect(specific.getByRole('checkbox')).toBeVisible();
  expect(general.getByText('2 de 2 temas seleccionados')).toBeVisible();
  fireEvent.click(general.getByRole('button', { name: 'Desmarcar bloque: Parte general' }));
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(
    general.getAllByRole('checkbox').every((input) => !(input as HTMLInputElement).checked),
  ).toBe(true);
  expect(specific.getByRole('checkbox')).toBeChecked();
});

it('explains when no topics are available', () => {
  render(<TestTopicSelection topics={[]} selectedIds={[]} onChange={() => {}} />);
  expect(screen.getByText('No hay temas disponibles en esta convocatoria.')).toBeInTheDocument();
});

