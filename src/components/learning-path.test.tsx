import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  map: vi.fn(),
  attempt: vi.fn(),
  start: vi.fn(),
  save: vi.fn(),
  finish: vi.fn(),
  abandon: vi.fn(),
}));
vi.mock('@/lib/learning-path', async (original) => ({
  ...(await original<typeof import('@/lib/learning-path')>()),
  getLearningPath: api.map,
  getPathAttempt: api.attempt,
  startPathChallenge: api.start,
  savePathAnswer: api.save,
  finishPathAttempt: api.finish,
  abandonPathAttempt: api.abandon,
}));
import { LearningPath } from './learning-path';
const challenge = {
  id: 'challenge-1',
  title: 'Primeros pasos',
  questionCount: 5,
  criterion: 'finalizacion',
  threshold: 0,
  minimum: 1,
  xp: 10,
  completed: false,
  best: null,
  lastAttemptId: null,
  available: true,
  activeAttemptId: null,
};
const locked = {
  ...challenge,
  id: 'challenge-2',
  title: 'Coge ritmo',
  criterion: 'porcentaje',
  minimum: 6,
  questionCount: 10,
  available: false,
};
const initialMap = {
  paths: [{ id: 'path-1', title: 'Mi camino', state: 'publicado', convocationName: 'Navarra' }],
  unavailableConvocations: [],
  canPractice: true,
  activity: { current: 2, best: 4, dailyDone: false },
  path: {
    id: 'path-1',
    title: 'Mi camino · Navarra',
    state: 'publicado',
    completedChallenges: 0,
    totalChallenges: 5,
    completedTopics: 0,
    totalTopics: 1,
    percentage: 0,
    xp: 0,
    stops: [
      {
        id: 'stop-1',
        title: 'Tema uno',
        type: 'tema',
        blockName: 'Bloque general',
        blockId: 'block-1',
        challenges: [challenge, locked],
      },
    ],
  },
};
const question = {
  id: 'question-1',
  order: 1,
  text: 'Pregunta real del banco',
  selectedAnswerId: null,
  status: null,
  topics: [],
  options: [1, 2, 3, 4].map((i) => ({ id: `option-${i}`, text: `Opción ${i}`, order: i })),
};
const ongoing = {
  id: 'attempt-1',
  pathId: 'path-1',
  pathChallengeId: 'challenge-1',
  pathState: 'en_curso',
  pathVersion: 0,
  pathTitle: 'Primeros pasos',
  pathEvaluation: { criterion: 'finalizacion', threshold: 0, minimum: 1, xp: 10 },
  pathPassed: null,
  pathXpEarned: null,
  canPractice: true,
  status: 'in_progress',
  questionCount: 5,
  result: null,
  questions: [question],
};
beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  api.map.mockResolvedValue(initialMap);
  api.start.mockResolvedValue(ongoing);
  api.attempt.mockResolvedValue(ongoing);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);
describe('learning path experience', () => {
  it('shows server progress, the next action and an explanation for locked steps', async () => {
    render(<LearningPath />);
    await screen.findByText('Tema uno');
    expect(screen.getByText('Racha: 2 días · Mejor: 4')).toBeInTheDocument();
    expect(screen.getByText('🔒 Bloqueado')).toBeInTheDocument();
    expect(
      screen.getByText('Supera el reto o repaso anterior para abrir este paso.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar · Primeros pasos' }));
    await screen.findByText('Pregunta real del banco');
    expect(api.start).toHaveBeenCalledWith('challenge-1');
    expect(screen.queryByText('Respuesta correcta')).not.toBeInTheDocument();
  });
  it('keeps unsynchronized selection and requires review before resolving a tab conflict', async () => {
    api.save
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockResolvedValueOnce({ ...ongoing, pathVersion: 1, conflict: true })
      .mockResolvedValueOnce({
        ...ongoing,
        pathVersion: 2,
        questions: [{ ...question, selectedAnswerId: 'option-1' }],
      });
    render(<LearningPath initialAttemptId="attempt-1" />);
    await screen.findByText('Pregunta real del banco');
    fireEvent.click(screen.getByRole('button', { name: 'A Opción 1' }));
    await screen.findByText('Sin conexión');
    expect(screen.getByRole('button', { name: 'Entregar test' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardado' }));
    await screen.findByText(
      'Conflicto entre pestañas: la selección pendiente aún no se ha aplicado.',
    );
    expect(api.save).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar mi selección tras revisar' }));
    await screen.findByText('Respuesta guardada en el servidor');
    expect(api.save.mock.calls[2][0].pathVersion).toBe(1);
  });
  it('asks about blanks and shows rewards only after server finalization', async () => {
    const result = {
      ...ongoing,
      pathState: 'finalizado',
      pathPassed: true,
      pathXpEarned: 10,
      status: 'finalized',
      result: {
        aciertos: 1,
        fallos: 0,
        enBlanco: 4,
        porcentajeAciertos: 20,
        tiempoEmpleadoSegundos: 60,
      },
      questions: [
        {
          ...question,
          selectedAnswerId: 'option-1',
          status: 'correcta',
          explanation: 'Explicación del banco',
          options: question.options.map((o, i) => ({ ...o, isCorrect: i === 0 })),
        },
      ],
    };
    api.finish.mockResolvedValue(result);
    render(<LearningPath initialAttemptId="attempt-1" />);
    await screen.findByText('Pregunta real del banco');
    fireEvent.click(screen.getByRole('button', { name: 'Entregar test' }));
    expect(api.finish).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('preguntas sin contestar');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await screen.findByText('¡Reto superado!');
    expect(screen.getByText(/XP obtenida en este intento: 10/)).toBeInTheDocument();
    expect(screen.getByText('Explicación del banco')).toBeInTheDocument();
  });
  it('retains map and previous results after access expires and prevents practicing', async () => {
    api.map.mockResolvedValue({ ...initialMap, canPractice: false });
    render(<LearningPath />);
    await screen.findByText('Tema uno');
    expect(screen.getByRole('button', { name: 'Continuar · Primeros pasos' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Ver planes' })).toHaveAttribute('href', '/planes');
    expect(api.start).not.toHaveBeenCalled();
  });
  it('explains unavailable content and lets a failed initial load be retried', async () => {
    api.map
      .mockRejectedValueOnce(new Error('No se pudo conectar'))
      .mockResolvedValueOnce({
        ...initialMap,
        path: null,
        paths: [],
        unavailableConvocations: ['Navarra'],
      });
    render(<LearningPath />);
    await screen.findByText('No se pudo conectar');
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar estado confirmado' }));
    await waitFor(() => expect(screen.getByText(/Navarra: el recorrido/)).toBeInTheDocument());
  });
});
