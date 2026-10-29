'use client';
import type { TestAttemptQuestion } from '@/lib/test-platform-api';
export function TestAnswerOptions({
  question,
  showCorrection,
  disabled,
  onAnswer,
}: {
  question: TestAttemptQuestion;
  showCorrection: boolean;
  disabled: boolean;
  onAnswer: (id: string) => void;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">
        {showCorrection ? 'Respuestas y corrección' : 'Selecciona una respuesta'}
      </legend>
      {question.options.map((option, optionIndex) => {
        const selected = question.selectedAnswerId === option.id;
        const isCorrectAnswer = showCorrection && option.isCorrect === true;
        const isSelectedIncorrect = showCorrection && selected && option.isCorrect === false;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled || showCorrection}
            onClick={() => onAnswer(option.id)}
            className={[
              'flex min-h-[68px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bd3734] disabled:cursor-default sm:px-5',
              isCorrectAnswer
                ? 'border-2 border-emerald-700 bg-emerald-50 text-[#302f2b]'
                : isSelectedIncorrect
                  ? 'border-2 border-[#bd3734] bg-[#fbefec] text-[#302f2b]'
                  : selected
                    ? 'border-2 border-[#c43b38] bg-[#fbefec] text-[#302f2b]'
                    : 'border-[var(--line)] bg-white text-[#302f2b] hover:border-[#c43b38]',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-sans text-sm font-semibold',
                isCorrectAnswer
                  ? 'bg-emerald-700 text-white'
                  : selected
                    ? 'bg-[#bd3734] text-white'
                    : 'bg-[#f6f5f0] text-[var(--muted)]',
              ].join(' ')}
            >
              {String.fromCharCode(65 + optionIndex)}
            </span>
            <span className="min-w-0 flex-1 break-words text-sm leading-6 sm:text-base">
              {option.text}
            </span>
            {showCorrection && isCorrectAnswer ? (
              <span className="text-xs font-semibold text-emerald-800">Correcta</span>
            ) : null}
            {showCorrection && isSelectedIncorrect ? (
              <span className="text-xs font-semibold text-[#a82f2c]">Tu respuesta</span>
            ) : null}
            <span
              aria-hidden="true"
              className={[
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                isCorrectAnswer
                  ? 'border-emerald-700'
                  : selected
                    ? 'border-[#bd3734]'
                    : 'border-[#deded7]',
              ].join(' ')}
            >
              {selected || isCorrectAnswer ? (
                <span
                  className={[
                    'h-2.5 w-2.5 rounded-full',
                    isCorrectAnswer ? 'bg-emerald-700' : 'bg-[#bd3734]',
                  ].join(' ')}
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
