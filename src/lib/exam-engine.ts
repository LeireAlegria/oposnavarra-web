export type ExamTopic = {
  id: string;
  name: string;
  number: number;
};

export type ExamQuestion = {
  id: string;
  topicId: string;
  text: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
};

export type ExamDefinition = {
  id: string;
  name: string;
  topics: ExamTopic[];
  questions: ExamQuestion[];
};

export type AttemptQuestion = ExamQuestion & {
  selectedAnswerId?: string | null;
  status?: 'correcta' | 'incorrecta' | 'en_blanco';
  order: number;
};

export type AttemptRecord = {
  id: string;
  examId: string;
  status: 'in_progress' | 'finalizado';
  selectedTopicIds: string[];
  questionCount: number;
  timeLimitSeconds: number;
  startedAt: string;
  expiresAt: string | null;
  questions: AttemptQuestion[];
  resultado?: AttemptResult;
};

export type AttemptResult = {
  aciertos: number;
  fallos: number;
  enBlanco: number;
  puntuacionNeta: number;
  nota: number;
  porcentajeAciertos: number;
  tiempoEmpleadoSegundos: number;
  penalizacionAplicada: number;
  byTopic: Array<{
    topicId: string;
    topicName: string;
    questionCount: number;
    aciertos: number;
    fallos: number;
    enBlanco: number;
    porcentajeAciertos: number;
  }>;
};

export const demoExam: ExamDefinition = {
  id: 'administrativo-navarra',
  name: 'Administrativo de Navarra',
  topics: [
    { id: 'administracion-general', name: 'Administración general', number: 1 },
    { id: 'derecho-administrativo', name: 'Derecho administrativo', number: 2 },
    { id: 'informatica', name: 'Informática', number: 3 },
    { id: 'navarra', name: 'Navarra y servicio público', number: 4 },
  ],
  questions: [
    {
      id: 'q-01',
      topicId: 'administracion-general',
      text: '¿Qué principio básico rige la actuación administrativa en España?',
      options: [
        { id: 'a', text: 'Legalidad y eficacia', isCorrect: true },
        { id: 'b', text: 'Rápidez sin procedimiento', isCorrect: false },
        { id: 'c', text: 'Discrecionalidad plena', isCorrect: false },
        { id: 'd', text: 'Exclusividad del arbitrio político', isCorrect: false },
      ],
    },
    {
      id: 'q-02',
      topicId: 'administracion-general',
      text: '¿Cuál es la finalidad principal de una convocatoria de empleo público?',
      options: [
        { id: 'a', text: 'Seleccionar personas mediante un proceso objetivo', isCorrect: true },
        { id: 'b', text: 'Asignar puestos por afinidad política', isCorrect: false },
        { id: 'c', text: 'Reducir la plantilla sin criterios', isCorrect: false },
        { id: 'd', text: 'Evitar la publicidad de las plazas', isCorrect: false },
      ],
    },
    {
      id: 'q-03',
      topicId: 'derecho-administrativo',
      text: '¿Qué característica define la potestad reglada?',
      options: [
        { id: 'a', text: 'Se ejerce según la norma aplicable y sin margen de apreciación', isCorrect: true },
        { id: 'b', text: 'Es exclusiva del poder legislativo', isCorrect: false },
        { id: 'c', text: 'Se aplica solo a actos tributarios', isCorrect: false },
        { id: 'd', text: 'Se basa solo en la conveniencia del órgano', isCorrect: false },
      ],
    },
    {
      id: 'q-04',
      topicId: 'derecho-administrativo',
      text: '¿Qué requisito es necesario para que un acto administrativo sea válido?',
      options: [
        { id: 'a', text: 'Motivación y competencia', isCorrect: true },
        { id: 'b', text: 'Solo firma del superior jerárquico', isCorrect: false },
        { id: 'c', text: 'Consentimiento del sindicato', isCorrect: false },
        { id: 'd', text: 'Autorización de la oposición', isCorrect: false },
      ],
    },
    {
      id: 'q-05',
      topicId: 'informatica',
      text: '¿Cuál de estas opciones es un tipo de dato primitivo en JavaScript?',
      options: [
        { id: 'a', text: 'string', isCorrect: true },
        { id: 'b', text: 'object', isCorrect: false },
        { id: 'c', text: 'function', isCorrect: false },
        { id: 'd', text: 'array', isCorrect: false },
      ],
    },
    {
      id: 'q-06',
      topicId: 'informatica',
      text: '¿Qué significa HTTPS?',
      options: [
        { id: 'a', text: 'HyperText Transfer Protocol Secure', isCorrect: true },
        { id: 'b', text: 'High Transfer Transfer Encrypted Secure', isCorrect: false },
        { id: 'c', text: 'Hyper Transfer Text Secure', isCorrect: false },
        { id: 'd', text: 'Hosting Transfer Protocol Service', isCorrect: false },
      ],
    },
    {
      id: 'q-07',
      topicId: 'navarra',
      text: '¿Qué institución tiene competencia para la administración del territorio en Navarra?',
      options: [
        { id: 'a', text: 'El Gobierno de Navarra', isCorrect: true },
        { id: 'b', text: 'El Congreso de los Diputados', isCorrect: false },
        { id: 'c', text: 'El Consejo General del Poder Judicial', isCorrect: false },
        { id: 'd', text: 'La UE', isCorrect: false },
      ],
    },
    {
      id: 'q-08',
      topicId: 'navarra',
      text: '¿Qué principio caracteriza la administración del servicio público en Navarra?',
      options: [
        { id: 'a', text: 'Objetividad y continuidad en la prestación', isCorrect: true },
        { id: 'b', text: 'Total libertad de acceso sin normas', isCorrect: false },
        { id: 'c', text: 'Prioridad electoral sobre la legalidad', isCorrect: false },
        { id: 'd', text: 'Desvinculación de las personas usuarias', isCorrect: false },
      ],
    },
    {
      id: 'q-09',
      topicId: 'administracion-general',
      text: '¿Qué documento se utiliza para fijar una política de servicio público en una administración?',
      options: [
        { id: 'a', text: 'Un plan o procedimiento interno', isCorrect: true },
        { id: 'b', text: 'Una declaración privada sin efecto', isCorrect: false },
        { id: 'c', text: 'Un simple mensaje informal', isCorrect: false },
        { id: 'd', text: 'Una recomendación sin respaldo legal', isCorrect: false },
      ],
    },
    {
      id: 'q-10',
      topicId: 'informatica',
      text: '¿Qué función tiene un navegador web?',
      options: [
        { id: 'a', text: 'Mostrar contenido web y ejecutar páginas', isCorrect: true },
        { id: 'b', text: 'Guardar documentos en un disco físico', isCorrect: false },
        { id: 'c', text: 'Compilar código del servidor', isCorrect: false },
        { id: 'd', text: 'Diseñar bases de datos', isCorrect: false },
      ],
    },
    {
      id: 'q-11',
      topicId: 'derecho-administrativo',
      text: '¿Qué elemento es básico en la motivación de un acto administrativo?',
      options: [
        { id: 'a', text: 'La exposición de los hechos y fundamentos jurídicos', isCorrect: true },
        { id: 'b', text: 'La necesidad de consensuarlo con la prensa', isCorrect: false },
        { id: 'c', text: 'La firma del concejal más antiguo', isCorrect: false },
        { id: 'd', text: 'La ausencia de resolución escrita', isCorrect: false },
      ],
    },
    {
      id: 'q-12',
      topicId: 'navarra',
      text: '¿Cuál es uno de los objetivos del servicio público en Navarra?',
      options: [
        { id: 'a', text: 'Garantizar una atención eficaz y cercana a la ciudadanía', isCorrect: true },
        { id: 'b', text: 'Limitar el acceso a la administración', isCorrect: false },
        { id: 'c', text: 'Eliminar la tramitación administrativa', isCorrect: false },
        { id: 'd', text: 'Priorizar solo a quienes tienen mayor nivel económico', isCorrect: false },
      ],
    },
    {
      id: 'q-13',
      topicId: 'administracion-general',
      text: '¿Qué principio evita el abuso de poder en la administración?',
      options: [
        { id: 'a', text: 'Proporcionalidad', isCorrect: true },
        { id: 'b', text: 'Aleatoriedad', isCorrect: false },
        { id: 'c', text: 'Escasez de documentación', isCorrect: false },
        { id: 'd', text: 'Reticencia administrativa', isCorrect: false },
      ],
    },
    {
      id: 'q-14',
      topicId: 'informatica',
      text: '¿Qué es un archivo comprimido?',
      options: [
        { id: 'a', text: 'Un archivo que reduce su tamaño mediante compresión', isCorrect: true },
        { id: 'b', text: 'Un tipo de hoja de cálculo', isCorrect: false },
        { id: 'c', text: 'Una base de datos abierta', isCorrect: false },
        { id: 'd', text: 'Un documento sin extensión', isCorrect: false },
      ],
    },
    {
      id: 'q-15',
      topicId: 'derecho-administrativo',
      text: '¿Qué significa que una resolución administrativa es recurrible?',
      options: [
        { id: 'a', text: 'Puede ser impugnada mediante los recursos previstos', isCorrect: true },
        { id: 'b', text: 'Debe ser firmada por todos los empleados', isCorrect: false },
        { id: 'c', text: 'No requiere motivación', isCorrect: false },
        { id: 'd', text: 'Se anula automáticamente al día siguiente', isCorrect: false },
      ],
    },
    {
      id: 'q-16',
      topicId: 'navarra',
      text: '¿Cuál es la finalidad de la administración pública en una comunidad autónoma?',
      options: [
        { id: 'a', text: 'Atender los servicios públicos y la ciudadanía', isCorrect: true },
        { id: 'b', text: 'Evitar toda intervención legislativa', isCorrect: false },
        { id: 'c', text: 'Actuar únicamente por vía judicial', isCorrect: false },
        { id: 'd', text: 'Eliminar la competencia del Estado', isCorrect: false },
      ],
    },
    {
      id: 'q-17',
      topicId: 'administracion-general',
      text: '¿Qué se entiende por procedimiento administrativo?',
      options: [
        { id: 'a', text: 'El conjunto de trámites para resolver una actuación administrativa', isCorrect: true },
        { id: 'b', text: 'La redacción de un informe sin efecto', isCorrect: false },
        { id: 'c', text: 'Un documento interno no vinculante', isCorrect: false },
        { id: 'd', text: 'La relación informal entre empleados', isCorrect: false },
      ],
    },
    {
      id: 'q-18',
      topicId: 'informatica',
      text: '¿Cuál es la función principal de una hoja de cálculo?',
      options: [
        { id: 'a', text: 'Organizar y analizar datos en tablas', isCorrect: true },
        { id: 'b', text: 'Almacenar únicamente textos literarios', isCorrect: false },
        { id: 'c', text: 'Ejecutar scripts de red', isCorrect: false },
        { id: 'd', text: 'Generar archivos PDF automáticamente', isCorrect: false },
      ],
    },
    {
      id: 'q-19',
      topicId: 'derecho-administrativo',
      text: '¿Qué tipo de acto se emite para resolver un expediente administrativo?',
      options: [
        { id: 'a', text: 'Resolución', isCorrect: true },
        { id: 'b', text: 'Contrato de confidencialidad', isCorrect: false },
        { id: 'c', text: 'Manual de uso', isCorrect: false },
        { id: 'd', text: 'Acuerdo privado', isCorrect: false },
      ],
    },
    {
      id: 'q-20',
      topicId: 'navarra',
      text: '¿Qué elemento es clave para la prestación de un servicio público eficaz?',
      options: [
        { id: 'a', text: 'La calidad y la continuidad del servicio', isCorrect: true },
        { id: 'b', text: 'La ausencia de regulación', isCorrect: false },
        { id: 'c', text: 'La prioridad del criterio personal', isCorrect: false },
        { id: 'd', text: 'La improvisación en cada trámite', isCorrect: false },
      ],
    },
  ],
};

export const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50];
export const TIME_LIMIT_OPTIONS = [0, 600, 1200, 1800, 2700, 3600];

export function getExamAvailableQuestionCount(topicIds: string[]) {
  const selected = new Set(topicIds);
  const availableQuestions = demoExam.questions.filter((question) => selected.has(question.topicId));
  return availableQuestions.length;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

export function generateAttempt({
  topicIds,
  questionCount,
  timeLimitSeconds,
}: {
  topicIds: string[];
  questionCount: number;
  timeLimitSeconds: number;
}): { ok: true; attempt: AttemptRecord } | { ok: false; message: string } {
  const validTopics = demoExam.topics
    .filter((topic) => topicIds.includes(topic.id))
    .map((topic) => topic.id);

  if (validTopics.length === 0) {
    return { ok: false, message: 'Selecciona al menos un tema para empezar.' };
  }

  const availableQuestionCount = getExamAvailableQuestionCount(validTopics);

  if (availableQuestionCount < 10) {
    return { ok: false, message: 'No hay suficientes preguntas para crear un test con la configuración actual.' };
  }

  if (questionCount > availableQuestionCount || questionCount < 1) {
    return { ok: false, message: 'El número de preguntas seleccionado no es válido para los temas elegidos.' };
  }

  const selectedQuestions = shuffle(
    demoExam.questions.filter((question) => validTopics.includes(question.topicId)),
  ).slice(0, questionCount);

  const now = new Date();
  const startedAt = now.toISOString();
  const expiresAt = timeLimitSeconds > 0 ? new Date(now.getTime() + timeLimitSeconds * 1000).toISOString() : null;

  const attempt: AttemptRecord = {
    id: globalThis.crypto && 'randomUUID' in globalThis.crypto ? globalThis.crypto.randomUUID() : `attempt-${Date.now()}`,
    examId: demoExam.id,
    status: 'in_progress',
    selectedTopicIds: validTopics,
    questionCount,
    timeLimitSeconds,
    startedAt,
    expiresAt,
    questions: selectedQuestions.map((question, index) => ({
      ...question,
      order: index + 1,
      selectedAnswerId: null,
      status: 'en_blanco',
    })),
  };

  return { ok: true, attempt };
}

export function updateAttemptAnswer(attempt: AttemptRecord, questionId: string, selectedAnswerId: string | null): AttemptRecord {
  const current = attempt.questions.map((question) => {
    if (question.id !== questionId) {
      return question;
    }

    return {
      ...question,
      selectedAnswerId,
    };
  });

  return { ...attempt, questions: current };
}

export function calculateAttemptResult(attempt: AttemptRecord): AttemptResult {
  const questionCount = attempt.questions.length;
  let aciertos = 0;
  let fallos = 0;
  let enBlanco = 0;

  const resultsByTopic = new Map<
    string,
    { topicId: string; topicName: string; questionCount: number; aciertos: number; fallos: number; enBlanco: number }
  >();

  for (const question of attempt.questions) {
    const topicMeta = demoExam.topics.find((topic) => topic.id === question.topicId);
    const current = resultsByTopic.get(question.topicId) ?? {
      topicId: question.topicId,
      topicName: topicMeta?.name ?? 'Tema',
      questionCount: 0,
      aciertos: 0,
      fallos: 0,
      enBlanco: 0,
    };

    current.questionCount += 1;

    const selectedAnswer = question.options.find((option) => option.id === question.selectedAnswerId);

    if (!selectedAnswer) {
      current.enBlanco += 1;
      enBlanco += 1;
    } else if (selectedAnswer.isCorrect) {
      current.aciertos += 1;
      aciertos += 1;
    } else {
      current.fallos += 1;
      fallos += 1;
    }

    resultsByTopic.set(question.topicId, current);
  }

  const puntuacionNeta = aciertos - fallos / 3;
  const notaRaw = (puntuacionNeta / questionCount) * 10;
  const nota = Math.min(10, Math.max(0, Number(notaRaw.toFixed(2))));
  const porcentajeAciertos = (aciertos / questionCount) * 100;
  const penalizacionAplicada = 1 / 3;
  const tiempoEmpleadoSegundos = attempt.timeLimitSeconds > 0
    ? Math.max(0, Math.ceil((new Date(attempt.expiresAt ?? new Date().toISOString()).getTime() - new Date(attempt.startedAt).getTime()) / 1000) * -1)
    : Math.max(0, Math.ceil((Date.now() - new Date(attempt.startedAt).getTime()) / 1000));

  return {
    aciertos,
    fallos,
    enBlanco,
    puntuacionNeta: Number(puntuacionNeta.toFixed(2)),
    nota,
    porcentajeAciertos: Number(porcentajeAciertos.toFixed(2)),
    tiempoEmpleadoSegundos: tiempoEmpleadoSegundos,
    penalizacionAplicada: penalizacionAplicada,
    byTopic: Array.from(resultsByTopic.values()).map((entry) => ({
      ...entry,
      porcentajeAciertos: entry.questionCount > 0 ? Number(((entry.aciertos / entry.questionCount) * 100).toFixed(2)) : 0,
    })),
  };
}

export function finalizeAttempt(attempt: AttemptRecord): AttemptRecord {
  const completed = {
    ...attempt,
    status: 'finalizado' as const,
    resultado: calculateAttemptResult(attempt),
  };

  return {
    ...completed,
    questions: completed.questions.map((question) => ({
      ...question,
      status: question.selectedAnswerId == null
        ? 'en_blanco'
        : question.options.find((option) => option.id === question.selectedAnswerId)?.isCorrect
          ? 'correcta'
          : 'incorrecta',
    })),
  };
}
