/**
 * Builds CSV text safely:
 * - quotes cells containing commas, quotes or line breaks (and doubles embedded quotes);
 * - neutralises spreadsheet formula injection: a cell starting with = + - @ (or tab/CR) gets a leading apostrophe,
 *   so a resident named "=HYPERLINK(...)" cannot run anything when the admin opens the file in Excel.
 */
export const csvCell = (value: string | number): string => {
  let text = typeof value === 'number' ? String(value) : value;
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (rows: (string | number)[][]): string => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

/** Triggers a browser download of the CSV (UTF-8 with BOM so Excel shows names correctly). */
export const downloadCsv = (filename: string, rows: (string | number)[][]): void => {
  const blob = new Blob(['\uFEFF', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
