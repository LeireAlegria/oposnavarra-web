import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import {
  IMPORT_HEADERS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  normalizeImportText,
  type ImportRow,
} from './model';

// Check the archive before parsing XML, including its expanded size and encryption flags.
export function validateXlsxArchive(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES)
    throw new Error('El archivo debe contener datos y no superar 5 MiB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50)
    throw new Error(
      'El archivo no es un .xlsx válido o está cifrado. Guarda una copia sin contraseña.',
    );
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--)
    if (
      view.getUint32(index, true) === 0x06054b50 &&
      index + 22 + view.getUint16(index + 20, true) === bytes.length
    ) {
      end = index;
      break;
    }
  if (end < 0) throw new Error('El archivo Excel está dañado. Vuelve a guardarlo como .xlsx.');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let expanded = 0;
  if (!count || count > 500 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true))
    throw new Error('La estructura del Excel no es compatible.');
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('El archivo Excel está dañado.');
    if (view.getUint16(offset + 8, true) & 1)
      throw new Error('No se admiten archivos protegidos o cifrados.');
    const size = view.getUint32(offset + 24, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const localOffset = view.getUint32(offset + 42, true);
    if (localOffset + 30 > bytes.length || view.getUint32(localOffset, true) !== 0x04034b50)
      throw new Error('El archivo Excel está dañado.');
    const start =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    if (start + compressedSize > bytes.length) throw new Error('El archivo Excel está dañado.');
    expanded += size;
    if (expanded > 32 * 1024 * 1024)
      throw new Error(
        'El Excel contiene demasiados datos descomprimidos. Usa solo la plantilla de preguntas.',
      );
    const method = view.getUint16(offset + 10, true);
    const compressed = bytes.subarray(start, start + compressedSize);
    let entry: Uint8Array;
    try {
      entry =
        method === 8
          ? inflateRawSync(compressed, { maxOutputLength: Math.max(1, size) })
          : method === 0
            ? compressed
            : new Uint8Array();
    } catch {
      throw new Error('El archivo está dañado o supera el límite de descompresión.');
    }
    if (![0, 8].includes(method) || entry.length !== size)
      throw new Error('La compresión del Excel no es compatible.');
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + view.getUint16(offset + 28, true)),
    );
    if (name.endsWith('.xml')) {
      const xml = new TextDecoder().decode(entry);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml))
        throw new Error('El Excel contiene XML no compatible. Guarda una copia con la plantilla.');
      if (name === 'xl/workbook.xml' && /<(?:\w+:)?workbookProtection\b/i.test(xml))
        throw new Error('El libro está protegido. Guarda una copia sin protección.');
    }
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  if (offset !== end) throw new Error('La estructura del Excel no es compatible.');
}

export async function parseQuestionWorkbook(
  bytes: Uint8Array,
  hasExam: boolean,
): Promise<ImportRow[]> {
  validateXlsxArchive(bytes);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error('No se puede leer el Excel. Comprueba que no esté dañado ni protegido.');
  }
  const sheet = workbook.getWorksheet('Preguntas');
  if (!sheet) throw new Error('Falta la hoja Preguntas. Utiliza la plantilla descargable.');
  const protection = (
    sheet.model as typeof sheet.model & { sheetProtection?: Record<string, unknown> }
  ).sheetProtection;
  if (protection && Object.keys(protection).length)
    throw new Error('La hoja Preguntas está protegida. Guarda una copia sin protección.');
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    if (typeof cell.value !== 'string')
      throw new Error('Los encabezados deben ser texto, sin fórmulas ni celdas vacías.');
    const header = normalizeImportText(cell.value);
    headers.push(header);
    if (!IMPORT_HEADERS.includes(header as (typeof IMPORT_HEADERS)[number]))
      throw new Error(`Encabezado desconocido: ${header || '(vacío)'}.`);
    if (headers.filter((item) => item === header).length > 1)
      throw new Error(`Encabezado repetido: ${header}.`);
  });
  const missing = IMPORT_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Faltan encabezados: ${missing.join(', ')}.`);
  const rows: ImportRow[] = [];
  sheet.eachRow((excelRow, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string | number | null> = {};
    const issues: ImportRow['issues'] = [];
    let nonempty = false;
    excelRow.eachCell((cell) => {
      if (cell.value !== null && cell.value !== '') nonempty = true;
    });
    if (!nonempty) return;
    if (rows.length >= MAX_IMPORT_ROWS)
      throw new Error('El archivo supera el límite de 1.000 filas de preguntas.');
    headers.forEach((header, index) => {
      const value = excelRow.getCell(index + 1).value;
      if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
        issues.push({
          column: header,
          message:
            value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)
              ? 'No se admiten fórmulas. Sustituye la fórmula por texto o un número.'
              : 'Solo se admiten valores de texto y números; elimina formatos de fecha, enlaces u objetos.',
        });
        values[header] = null;
      } else values[header] = typeof value === 'string' ? value.trim() : value;
    });
    const textValue = (key: string) =>
      values[key] === null ? '' : String(values[key] ?? '').trim();
    for (const key of ['enunciado', 'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'])
      if (!textValue(key))
        issues.push({ column: key, message: `Falta ${key}. Completa la celda en el Excel.` });
    const rawNumber = textValue('numero');
    const number = rawNumber ? Number(rawNumber) : null;
    if (
      (hasExam && number === null) ||
      (number !== null &&
        (!/^\d+$/.test(rawNumber) ||
          !Number.isInteger(number) ||
          number <= 0 ||
          number > 2147483647))
    )
      issues.push({
        column: 'numero',
        message:
          hasExam && number === null
            ? 'Indica el número original de la pregunta del examen.'
            : 'El número debe ser un entero positivo de hasta 2147483647.',
      });
    const options = ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'].map(textValue);
    if (new Set(options.map(normalizeImportText)).size !== 4)
      issues.push({
        column: 'opcion_a–opcion_d',
        message: 'Las cuatro opciones deben tener textos diferentes.',
      });
    const correctAnswer = textValue('respuesta_correcta').toUpperCase();
    if (!/^[ABCD]$/.test(correctAnswer))
      issues.push({
        column: 'respuesta_correcta',
        message: 'respuesta_correcta debe ser A, B, C o D.',
      });
    rows.push({
      rowNumber,
      number: number !== null && Number.isFinite(number) ? number : null,
      text: textValue('enunciado'),
      options,
      correctAnswer,
      explanation: textValue('explicacion'),
      topic: textValue('tema'),
      issues,
    });
  });
  if (!rows.length) throw new Error('La hoja Preguntas no contiene filas de preguntas.');
  return rows;
}

export async function createQuestionTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Preguntas');
  sheet.addRow([...IMPORT_HEADERS]);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column, index) => {
    column.width = [12, 65, 38, 38, 38, 38, 23, 55, 40][index];
  });
  sheet.getRow(1).height = 28;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBD3734' } };
  sheet.autoFilter = 'A1:I1';
  const instructions = workbook.addWorksheet('Instrucciones');
  instructions.getColumn(1).width = 110;
  [
    'OposNavarra · Importación de preguntas',
    'Rellena la hoja Preguntas desde la fila 2. Mantén todos los encabezados.',
    'Un archivo .xlsx de hasta 5 MiB y 1.000 preguntas. Sin fórmulas, imágenes ni protección.',
    'Cada fila requiere enunciado, cuatro opciones distintas y respuesta_correcta A, B, C o D.',
    'numero: obligatorio si eliges examen; entero positivo que conserva el número original.',
    'explicacion y tema: opcionales. tema es el nombre de un tema existente y se resuelve en la revisión.',
    'No se crean temas ni exámenes. Las preguntas se guardan en revisión, sin publicar.',
    'Corrige el contenido en Excel y vuelve a subirlo. La revisión académica corresponde al administrador.',
    'Las filas completamente vacías se ignoran. Solo se procesa la hoja Preguntas.',
  ].forEach((text) => instructions.addRow([text]));
  instructions.getRow(1).font = { bold: true, size: 16 };
  return workbook.xlsx.writeBuffer();
}
