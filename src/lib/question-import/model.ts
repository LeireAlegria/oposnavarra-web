export const IMPORT_HEADERS = [
  'numero',
  'enunciado',
  'opcion_a',
  'opcion_b',
  'opcion_c',
  'opcion_d',
  'respuesta_correcta',
  'explicacion',
  'tema',
] as const;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;
export const normalizeImportText = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();
export type ImportIssue = { column: string; message: string };
export type ImportRow = {
  rowNumber: number;
  number: number | null;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
  issues: ImportIssue[];
};
export type TopicCandidate = { id: string; nombre: string; descripcion: string | null };
export type DuplicateCandidate = {
  id: string;
  version?: string;
  text: string;
  options: { text: string; correct: boolean }[];
  exact: boolean;
};
export type ImportCatalog = {
  topics: TopicCandidate[];
  duplicates: { rowNumber: number; candidates: DuplicateCandidate[] }[];
  occupiedNumbers: number[];
  examName: string | null;
  convocationNames: string[];
};
export type ImportDecision = {
  rowNumber: number;
  included: boolean;
  topicId: string | null;
  topicResolved: boolean;
  duplicateAccepted: boolean;
};
export type ImportSettings = {
  origin: 'examen_oficial' | 'generada_documentacion';
  reference: string;
  examId: string | null;
};
export type ImportPreview = { rows: ImportRow[]; catalog: ImportCatalog };

export function defaultDecisions(rows: ImportRow[]): ImportDecision[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    included: true,
    topicId: null,
    topicResolved: !row.topic,
    duplicateAccepted: false,
  }));
}
export function reviewRows(preview: ImportPreview, decisions: ImportDecision[], hasExam: boolean) {
  const included = preview.rows.filter(
    (row) => decisions.find((decision) => decision.rowNumber === row.rowNumber)?.included,
  );
  return preview.rows.map((row) => {
    const decision = decisions.find((item) => item.rowNumber === row.rowNumber);
    const issues = [...row.issues];
    if (
      hasExam &&
      row.number !== null &&
      (preview.catalog.occupiedNumbers.includes(row.number) ||
        included.some((other) => other.rowNumber !== row.rowNumber && other.number === row.number))
    )
      issues.push({
        column: 'numero',
        message:
          'El número está repetido entre las filas incluidas o ya está ocupado en el examen.',
      });
    const internalDuplicates = included.filter(
      (other) =>
        other.rowNumber !== row.rowNumber &&
        normalizeImportText(other.text) === normalizeImportText(row.text),
    );
    const candidates =
      preview.catalog.duplicates.find((item) => item.rowNumber === row.rowNumber)?.candidates ?? [];
    const duplicate = candidates.length > 0 || internalDuplicates.length > 0;
    return {
      row,
      decision,
      issues,
      internalDuplicates,
      candidates,
      duplicate,
      pendingTopic: !!decision?.included && !decision.topicResolved,
      pendingDuplicate: !!decision?.included && duplicate && !decision.duplicateAccepted,
    };
  });
}
