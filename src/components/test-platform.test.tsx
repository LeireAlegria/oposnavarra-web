import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  countAvailableTestQuestions: vi.fn(),
  createOfficialTestAttempt: vi.fn(),
  createTestAttempt: vi.fn(),
  finalizeTestAttempt: vi.fn(),
  getTestAttempt: vi.fn(),
  getTestCatalog: vi.fn(),
  getOfficialExamCatalog: vi.fn(),
  getTestHistory: vi.fn(),
  listInProgressTestAttempts: vi.fn(),
  saveTestAnswer: vi.fn(),
  QUESTION_COUNT_OPTIONS: [10, 20, 30, 40, 50],
  TIME_LIMIT_OPTIONS: [0, 600, 1200, 1800, 2700, 3600],
}));

vi.mock('@/lib/test-platform-api', () => api);

import { TestPlatform } from './test-platform';

const topicId = '00000000-0000-4000-8000-000000000001';
const convocationId = '00000000-0000-4000-8000-000000000002';
const attemptId = '00000000-0000-4000-8000-000000000003';
const examId = '00000000-0000-4000-8000-000000000009';
const questionId = '00000000-0000-4000-8000-000000000004';
const answerIds = [
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000008',
];
const topic = { id: topicId, name: 'Tema 1', number: 1, order: 1 };

const inProgressAttempt = {
  id: attemptId,
  status: 'in_progress' as const,
  convocationId,
  convocationName: 'Convocatoria de prueba',
  officialExamId: null,
  officialExamName: null,
  selectedTopics: [topic],
  questionCount: 10,
  timeLimitSeconds: null,
  startedAt: '2026-10-15T10:00:00.000Z',
  expiresAt: null,
  finishedAt: null,
  result: null,
  questions: [
    {
      id: questionId,
      order: 1,
      text: '¿Cuál es la respuesta correcta?',
      selectedAnswerId: null,
      status: null,
      topics: [topic],
      options: answerIds.map((id, index) => ({
        id,
        text: `Respuesta ${index + 1}`,
        order: index + 1,
      })),
    },
  ],
};

const finalizedAttempt = {
  ...inProgressAttempt,
  status: 'finalized' as const,
  finishedAt: '2026-10-15T10:05:00.000Z',
  result: {
    totalQuestions: 10,
    aciertos: 1,
    fallos: 0,
    enBlanco: 9,
    puntuacionNeta: 1,
    nota: 1,
    porcentajeAciertos: 10,
    tiempoEmpleadoSegundos: 300,
    penalizacionAplicada: 0.33,
    byTopic: [
      {
        topicId,
        topicName: 'Tema 1',
        topicNumber: 1,
        questionCount: 10,
        aciertos: 1,
        fallos: 0,
        enBlanco: 9,
        porcentajeAciertos: 10,
      },
    ],
  },
  questions: inProgressAttempt.questions.map((question) => ({
    ...question,
    selectedAnswerId: answerIds[0],
    status: 'correcta' as const,
    options: question.options.map((option, index) => ({
      ...option,
      isCorrect: index === 0,
    })),
  })),
};

const attemptSummary = {
  id: attemptId,
  status: 'finalized' as const,
  convocationId,
  convocationName: 'Convocatoria de prueba',
  officialExamId: null,
  officialExamName: null,
  selectedTopics: [topic],
  questionCount: 10,
  timeLimitSeconds: null,
  startedAt: '2026-10-15T10:00:00.000Z',
  expiresAt: null,
  finishedAt: '2026-10-15T10:05:00.000Z',
  result: finalizedAttempt.result,
};
const secondAttemptSummary = {
  ...attemptSummary,
  id: '00000000-0000-4000-8000-000000000009',
};

const accountProps = {
  accountEmail: 'estudiante@example.com',
  accountPanel: <button type="button">Cerrar sesión</button>,
  canPractice: true,
};

let wasFinalized = false;

beforeEach(() => {
  wasFinalized = false;
  vi.clearAllMocks();
  api.getTestCatalog.mockResolvedValue([
    {
      id: convocationId,
      name: 'Convocatoria de prueba',
      topics: [{ ...topic, availableQuestions: 20 }],
    },
  ]);
  api.getOfficialExamCatalog.mockResolvedValue([
    {
      id: examId,
      name: 'Examen oficial de prueba',
      date: '2026-05-01',
      convocationId,
      convocationName: 'Convocatoria de prueba',
      questionCount: 50,
    },
  ]);
  api.countAvailableTestQuestions.mockResolvedValue(20);
  api.listInProgressTestAttempts.mockResolvedValue([]);
  api.getTestHistory.mockImplementation(() =>
    Promise.resolve({
      items: wasFinalized ? [attemptSummary] : [],
      hasMore: false,
    }),
  );
  api.createTestAttempt.mockResolvedValue(attemptId);
  api.createOfficialTestAttempt.mockResolvedValue(attemptId);
  api.getTestAttempt.mockImplementation(() =>
    Promise.resolve(wasFinalized ? finalizedAttempt : inProgressAttempt),
  );
  api.saveTestAnswer.mockResolvedValue(true);
  api.finalizeTestAttempt.mockImplementation(() => {
    wasFinalized = true;
    return Promise.resolve(attemptSummary);
  });
});

afterEach(() => {
  cleanup();
});

describe('TestPlatform', () => {
  it('saves answers and only reveals corrections after server finalization', async () => {
    render(<TestPlatform {...accountProps} />);

    expect(await screen.findByRole('heading', { name: 'Configura tu test' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Convocatoria' })).toHaveValue(convocationId);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Comenzar test' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar test' }));

    expect(await screen.findByRole('heading', { name: 'Test en curso' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );

    const questionGroup = screen.getByRole('group', { name: 'Selecciona una respuesta' });
    const firstAnswer = within(questionGroup).getAllByRole('button')[0];
    fireEvent.click(firstAnswer);
    await waitFor(() => expect(api.saveTestAnswer).toHaveBeenCalled());
    expect(firstAnswer).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('progressbar', { name: 'Progreso del test' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.queryByText('Correcta')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar y ver resultados' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar y finalizar' }));
    expect(await screen.findByRole('heading', { name: 'Historial de tests' })).toBeInTheDocument();
    expect(screen.getByText(/Nota .* \/ 10/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Historial de tests' }));
    expect((await screen.findAllByText('Convocatoria de prueba')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar test' }));
    expect(await screen.findByText('Correcta')).toBeInTheDocument();
    expect(api.getTestAttempt).toHaveBeenCalledWith(attemptId);
  });

  it('keeps history available without an active subscription and does not load practice data', async () => {
    render(<TestPlatform {...accountProps} canPractice={false} />);

    expect(await screen.findByRole('heading', { name: 'Historial de tests' })).toBeInTheDocument();
    expect(screen.getByText('Historial vacío')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test por temas' })).toBeDisabled();
    expect(api.getTestCatalog).not.toHaveBeenCalled();
    expect(api.getOfficialExamCatalog).not.toHaveBeenCalled();
    expect(api.listInProgressTestAttempts).not.toHaveBeenCalled();
  });

  it('starts the selected official exam with the chosen time limit', async () => {
    api.getTestAttempt.mockResolvedValueOnce({
      ...inProgressAttempt,
      officialExamId: examId,
      officialExamName: 'Examen oficial de prueba',
    });
    render(<TestPlatform {...accountProps} />);

    await screen.findByRole('heading', { name: 'Configura tu test' });
    fireEvent.click(screen.getByRole('button', { name: 'Test oficiales' }));

    expect(await screen.findByRole('heading', { name: 'Test oficiales' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Tiempo' }), {
      target: { value: '1800' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comenzar test oficial' }));

    await screen.findByText('Examen oficial: Examen oficial de prueba');
    expect(api.createOfficialTestAttempt).toHaveBeenCalledWith({
      convocationId,
      examId,
      timeLimitSeconds: 1800,
    });
  });

  it('shows a recoverable error instead of an empty-history state when loading fails', async () => {
    api.getTestHistory.mockRejectedValueOnce(new Error('Error de conexión'));
    render(<TestPlatform {...accountProps} canPractice={false} />);

    expect(await screen.findByText('Error de conexión')).toBeInTheDocument();
    expect(screen.queryByText('Historial vacío')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Historial vacío')).toBeInTheDocument();
  });

  it('loads additional history pages from the server', async () => {
    api.getTestHistory
      .mockResolvedValueOnce({ items: [attemptSummary], hasMore: true })
      .mockResolvedValueOnce({ items: [secondAttemptSummary], hasMore: false });
    render(<TestPlatform {...accountProps} canPractice={false} />);

    expect(await screen.findAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más tests' }));
    await waitFor(() => expect(api.getTestHistory).toHaveBeenLastCalledWith(10, 10));
    expect(await screen.findAllByRole('article')).toHaveLength(2);
  });
});
