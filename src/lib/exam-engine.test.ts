import { describe, expect, it } from 'vitest';

import {
  finalizeAttempt,
  generateAttempt,
  getExamAvailableQuestionCount,
  updateAttemptAnswer,
} from './exam-engine';

describe('exam engine', () => {
  it('generates a valid attempt for a selected set of topics', () => {
    const result = generateAttempt({
      topicIds: ['administracion-general', 'informatica'],
      questionCount: 10,
      timeLimitSeconds: 600,
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.attempt.status).toBe('in_progress');
    expect(result.attempt.selectedTopicIds).toEqual(['administracion-general', 'informatica']);
    expect(result.attempt.questions).toHaveLength(10);
    expect(new Set(result.attempt.questions.map((question) => question.id)).size).toBe(10);
    expect(result.attempt.expiresAt).not.toBeNull();
    expect(getExamAvailableQuestionCount(['administracion-general', 'informatica'])).toBeGreaterThanOrEqual(10);
  });

  it('updates a selected answer without mutating the question ordering', () => {
    const result = generateAttempt({
      topicIds: ['administracion-general', 'derecho-administrativo', 'informatica', 'navarra'],
      questionCount: 5,
      timeLimitSeconds: 0,
    });

    if (!result.ok) {
      throw new Error('La generación del intento falló.');
    }

    const questionId = result.attempt.questions[0].id;
    const updated = updateAttemptAnswer(result.attempt, questionId, result.attempt.questions[0].options[0].id);

    expect(updated.questions[0].selectedAnswerId).toBe(result.attempt.questions[0].options[0].id);
    expect(updated.questions.map((question) => question.order)).toEqual(result.attempt.questions.map((question) => question.order));
  });

  it('applies the una-tercera de penalización rule when finalizing', () => {
    const result = generateAttempt({
      topicIds: ['administracion-general', 'derecho-administrativo', 'informatica', 'navarra'],
      questionCount: 3,
      timeLimitSeconds: 0,
    });

    if (!result.ok) {
      throw new Error('La generación del intento falló.');
    }

    const attempt = {
      ...result.attempt,
      questions: result.attempt.questions.map((question, index) => ({
        ...question,
        selectedAnswerId:
          index === 0
            ? question.options.find((option) => option.isCorrect)?.id ?? null
            : index === 1
              ? question.options.find((option) => !option.isCorrect)?.id ?? null
              : null,
      })),
    };

    const finalized = finalizeAttempt(attempt);

    expect(finalized.resultado).toBeDefined();
    expect(finalized.resultado?.aciertos).toBe(1);
    expect(finalized.resultado?.fallos).toBe(1);
    expect(finalized.resultado?.enBlanco).toBe(1);
    expect(finalized.resultado?.puntuacionNeta).toBeCloseTo(0.67, 2);
    expect(finalized.resultado?.nota).toBeGreaterThanOrEqual(0);
    expect(finalized.resultado?.nota).toBeLessThanOrEqual(10);
  });
});
