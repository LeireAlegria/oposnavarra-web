// @vitest-environment node
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createQuestionTemplate, parseQuestionWorkbook, validateXlsxArchive } from './workbook';
import {
  defaultDecisions,
  IMPORT_HEADERS,
  MAX_IMPORT_BYTES,
  reviewRows,
  type ImportCatalog,
} from './model';

const valid = [
  1,
  '  Pregunta\ncompleta  ',
  'Uno',
  'Dos',
  'Tres',
  'Cuatro',
  'b',
  'Explicación\ncompleta',
  'Tema uno',
];
async function make(
  rows: unknown[][] = [valid],
  headers: unknown[] = [...IMPORT_HEADERS],
  name = 'Preguntas',
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
const catalog: ImportCatalog = {
  topics: [],
  duplicates: [],
  occupiedNumbers: [],
  examName: null,
  convocationNames: [],
};

describe('question Excel contract', () => {
  it('produces an editable template with the required sheets and headers, without importing examples', async () => {
    const buffer = new Uint8Array(await createQuestionTemplate());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Preguntas', 'Instrucciones']);
    expect(workbook.getWorksheet('Preguntas')?.getRow(1).values).toEqual([
      undefined,
      ...IMPORT_HEADERS,
    ]);
    await expect(parseQuestionWorkbook(buffer, false)).rejects.toThrow('no contiene filas');
  });
  it('preserves content/newlines, trims edges, normalizes headers and answers, and keeps original row numbers', async () => {
    const rows = await parseQuestionWorkbook(
      await make(
        [[], valid],
        IMPORT_HEADERS.map((header) => ` ${header.toUpperCase()} `),
      ),
      true,
    );
    expect(rows[0]).toMatchObject({
      rowNumber: 3,
      number: 1,
      text: 'Pregunta\ncompleta',
      correctAnswer: 'B',
      explanation: 'Explicación\ncompleta',
      issues: [],
    });
    expect(defaultDecisions(rows)[0].topicResolved).toBe(false);
  });
  it('supports questions without exam or topic and validates numbers when present', async () => {
    const row = [...valid];
    row[0] = '';
    row[8] = '';
    const parsed = await parseQuestionWorkbook(await make([row]), false);
    expect(parsed[0].issues).toEqual([]);
    expect(parsed[0].number).toBeNull();
    expect(defaultDecisions(parsed)[0].topicResolved).toBe(true);
    expect((await parseQuestionWorkbook(await make([row]), true))[0].issues).toContainEqual(
      expect.objectContaining({ column: 'numero' }),
    );
    for (const invalid of [-1, 1.5, 2147483648, 'abc']) {
      row[0] = invalid;
      expect((await parseQuestionWorkbook(await make([row]), false))[0].issues).toContainEqual(
        expect.objectContaining({ column: 'numero' }),
      );
    }
  });
  it('reports missing cells, duplicate options, invalid correct answers and formulas with columns', async () => {
    const rows = await parseQuestionWorkbook(
      await make([
        [1, '', ' Opción  uno ', 'opción UNO', { formula: '2+2', result: 4 }, 'D', 'AB', '', ''],
      ]),
      true,
    );
    expect(rows[0].issues.map((issue) => issue.column)).toEqual(
      expect.arrayContaining(['enunciado', 'opcion_c', 'opcion_a–opcion_d', 'respuesta_correcta']),
    );
    expect(rows[0].issues.some((issue) => issue.message.includes('fórmulas'))).toBe(true);
  });
  it('rejects missing, unknown or repeated headers and a missing worksheet', async () => {
    await expect(
      parseQuestionWorkbook(await make([valid], IMPORT_HEADERS.slice(1)), false),
    ).rejects.toThrow('Faltan encabezados');
    await expect(
      parseQuestionWorkbook(await make([valid], [...IMPORT_HEADERS, 'extra']), false),
    ).rejects.toThrow('Encabezado desconocido');
    await expect(
      parseQuestionWorkbook(await make([valid], [...IMPORT_HEADERS, 'TEMA']), false),
    ).rejects.toThrow('Encabezado repetido');
    await expect(
      parseQuestionWorkbook(await make([valid], [...IMPORT_HEADERS], 'Otra'), false),
    ).rejects.toThrow('Falta la hoja Preguntas');
  });
  it('ignores other sheets and rejects protected sheets, corrupt archives and size/row limits', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Preguntas');
    sheet.addRow([...IMPORT_HEADERS]);
    sheet.addRow(valid);
    workbook.addWorksheet('Otra').addRow(['No importar']);
    expect(
      await parseQuestionWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()), false),
    ).toHaveLength(1);
    await sheet.protect('password', { spinCount: 1 });
    await expect(
      parseQuestionWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()), false),
    ).rejects.toThrow('protegida');
    expect(() => validateXlsxArchive(new Uint8Array(MAX_IMPORT_BYTES + 1))).toThrow('5 MiB');
    await expect(parseQuestionWorkbook(new Uint8Array([1, 2, 3]), false)).rejects.toThrow('válido');
    await expect(
      parseQuestionWorkbook(await make(Array.from({ length: 1001 }, () => valid)), false),
    ).rejects.toThrow('1.000');
  });
  it('recalculates number conflicts and duplicate decisions using only included rows', async () => {
    const rows = await parseQuestionWorkbook(await make([valid, valid]), true);
    const decisions = defaultDecisions(rows);
    decisions.forEach((decision) => {
      decision.topicResolved = true;
    });
    let review = reviewRows({ rows, catalog }, decisions, true);
    expect(review[0].issues).toHaveLength(1);
    expect(review[0].pendingDuplicate).toBe(true);
    decisions[1].included = false;
    review = reviewRows({ rows, catalog }, decisions, true);
    expect(review[0].issues).toEqual([]);
    expect(review[0].pendingDuplicate).toBe(false);
    const existing: ImportCatalog = {
      ...catalog,
      duplicates: [
        {
          rowNumber: 2,
          candidates: [{ id: 'existing', text: rows[0].text, options: [], exact: false }],
        },
      ],
    };
    expect(reviewRows({ rows, catalog: existing }, decisions, true)[0].pendingDuplicate).toBe(true);
    decisions[0].duplicateAccepted = true;
    expect(reviewRows({ rows, catalog: existing }, decisions, true)[0].pendingDuplicate).toBe(
      false,
    );
  });
});
