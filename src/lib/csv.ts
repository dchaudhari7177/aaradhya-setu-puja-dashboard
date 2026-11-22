/** RFC 4180 CSV with a UTF-8 BOM so Excel shows ₹ and Devanagari correctly. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => cells.map(cell).join(",");
  return "﻿" + [line(header), ...rows.map(line)].join("\r\n") + "\r\n";
}

function cell(value: string | number): string {
  let s = String(value);
  // Neutralise spreadsheet formula injection: =, @, or +/- not followed by a plain number (phones stay readable).
  if (typeof value === "string" && (/^[=@\t\r]/.test(s) || /^[+-](?!\d+$)/.test(s))) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
