"use client";

import { unzipSync } from "fflate";
import type { PromptWorkbookPreview, PromptWorkbookRow } from "@/types/prompt-import";

const decoder = new TextDecoder("utf-8");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
type CellValue = string | number | boolean | null;

function elementsByLocalName(parent: Document | Element, name: string): Element[] {
  return Array.from(parent.getElementsByTagName("*")).filter((element) => element.localName === name);
}

function parseXml(bytes: Uint8Array, path: string): Document {
  const document = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
  if (document.querySelector("parsererror")) throw new Error(`Không thể đọc ${path} trong file Excel.`);
  return document;
}

function requireEntry(entries: Record<string, Uint8Array>, path: string): Uint8Array {
  const entry = entries[path];
  if (!entry) throw new Error(`File Excel thiếu thành phần ${path}.`);
  return entry;
}

function textOf(element: Element): string {
  return elementsByLocalName(element, "t").map((item) => item.textContent ?? "").join("");
}

function columnIndex(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + value % 26) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function clean(value: CellValue): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function normalize(value: CellValue): string {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ");
}

function parseSharedStrings(entries: Record<string, Uint8Array>): string[] {
  const bytes = entries["xl/sharedStrings.xml"];
  if (!bytes) return [];
  return elementsByLocalName(parseXml(bytes, "xl/sharedStrings.xml"), "si").map(textOf);
}

function parseRows(entries: Record<string, Uint8Array>, path: string, sharedStrings: string[]): Map<number, CellValue[]> {
  const document = parseXml(requireEntry(entries, path), path);
  const result = new Map<number, CellValue[]>();
  for (const rowElement of elementsByLocalName(document, "row")) {
    const rowNumber = Number(rowElement.getAttribute("r") || 0);
    if (!rowNumber || rowNumber > 2000) continue;
    const row: CellValue[] = [];
    for (const cell of elementsByLocalName(rowElement, "c")) {
      const reference = cell.getAttribute("r") ?? "A1";
      const type = cell.getAttribute("t");
      const valueElement = elementsByLocalName(cell, "v")[0];
      let value: CellValue = null;
      if (type === "s") value = sharedStrings[Number(valueElement?.textContent ?? -1)] ?? null;
      else if (type === "inlineStr") value = textOf(cell);
      else if (type === "b") value = valueElement?.textContent === "1";
      else if (type === "str") value = valueElement?.textContent ?? null;
      else if (valueElement?.textContent != null) value = valueElement.textContent;
      row[columnIndex(reference)] = value;
    }
    result.set(rowNumber, row);
  }
  return result;
}

function listWorksheets(entries: Record<string, Uint8Array>): Array<{ name: string; path: string }> {
  const workbook = parseXml(requireEntry(entries, "xl/workbook.xml"), "xl/workbook.xml");
  const relationships = parseXml(requireEntry(entries, "xl/_rels/workbook.xml.rels"), "xl/_rels/workbook.xml.rels");
  return elementsByLocalName(workbook, "sheet").flatMap((sheet) => {
    const relationshipId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const relationship = elementsByLocalName(relationships, "Relationship").find((item) => item.getAttribute("Id") === relationshipId);
    const target = relationship?.getAttribute("Target")?.replace(/\\/g, "/");
    if (!target) return [];
    return [{ name: sheet.getAttribute("name") ?? "Sheet", path: target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}` }];
  });
}

function safeRow(row: PromptWorkbookRow, warnings: string[]): PromptWorkbookRow | null {
  const nicheName = row.nicheName.slice(0, 100).trim();
  let content = row.content.trim();
  if (!nicheName || !content) return null;
  if (row.nicheName.length > 100) warnings.push(`${row.sourceCell}: tên chủ đề dài hơn 100 ký tự nên đã rút gọn.`);
  if (content.length > 20000) {
    warnings.push(`${row.sourceCell}: prompt dài hơn 20.000 ký tự nên đã rút gọn.`);
    content = content.slice(0, 20000);
  }
  return { ...row, nicheName, title: row.title?.slice(0, 200).trim() || null, content };
}

function parseTableLayout(rows: Map<number, CellValue[]>, warnings: string[]): PromptWorkbookRow[] | null {
  const topicNames = new Set(["chu de", "topic", "niche"]);
  const contentNames = new Set(["prompt", "noi dung", "content", "noi dung prompt"]);
  const titleNames = new Set(["tieu de", "title", "ten prompt"]);
  for (let headerRow = 1; headerRow <= 20; headerRow += 1) {
    const headers = rows.get(headerRow) ?? [];
    const topicIndex = headers.findIndex((value) => topicNames.has(normalize(value)));
    const contentIndex = headers.findIndex((value) => contentNames.has(normalize(value)));
    const titleIndex = headers.findIndex((value) => titleNames.has(normalize(value)));
    if (topicIndex < 0 || contentIndex < 0) continue;
    const parsed: PromptWorkbookRow[] = [];
    const lastRow = Math.max(...rows.keys(), headerRow);
    for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
      const row = rows.get(rowNumber) ?? [];
      const prompt = safeRow({ sourceCell: `${columnName(contentIndex)}${rowNumber}`, nicheName: clean(row[topicIndex]), title: titleIndex >= 0 ? clean(row[titleIndex]) || null : null, content: clean(row[contentIndex]) }, warnings);
      if (prompt) parsed.push(prompt);
    }
    return parsed;
  }
  return null;
}

function looksLikePrompt(value: string): boolean {
  return value.length >= 24 && value.split(/\s+/).length >= 4 && /[\p{L}]/u.test(value);
}

function parseWideLayout(rows: Map<number, CellValue[]>): { rows: PromptWorkbookRow[]; score: number; warnings: string[] } | null {
  let best: { rows: PromptWorkbookRow[]; score: number; warnings: string[] } | null = null;
  const lastRow = Math.max(...rows.keys(), 1);
  for (let headerRow = 1; headerRow <= Math.min(20, lastRow); headerRow += 1) {
    const headers = rows.get(headerRow) ?? [];
    const columns = headers.map((value, index) => ({ index, name: clean(value) })).filter((item) => item.name);
    if (columns.length < 2 || columns.some((item) => item.name.length > 100)) continue;
    const parsed: PromptWorkbookRow[] = [];
    const warnings: string[] = [];
    for (const column of columns) {
      for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
        const content = clean((rows.get(rowNumber) ?? [])[column.index]);
        const prompt = safeRow({ sourceCell: `${columnName(column.index)}${rowNumber}`, nicheName: column.name, title: null, content }, warnings);
        if (prompt) parsed.push(prompt);
      }
    }
    const promptLikeCount = parsed.filter((row) => looksLikePrompt(row.content)).length;
    const promptLikeRatio = parsed.length ? promptLikeCount / parsed.length : 0;
    if (parsed.length < 2 || promptLikeRatio < 0.55) continue;
    const score = promptLikeCount * 10 + parsed.length + (headerRow === 1 ? 20 : 0);
    if (!best || score > best.score) best = { rows: parsed, score, warnings };
  }
  return best;
}

export async function parsePromptWorkbook(file: File): Promise<PromptWorkbookPreview> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file Excel .xlsx.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File Excel vượt quá giới hạn 10 MB.");
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch { throw new Error("Không thể mở file Excel. Hãy kiểm tra file có đúng định dạng .xlsx hay không."); }
  const sharedStrings = parseSharedStrings(entries);
  let best: (PromptWorkbookPreview & { score: number }) | null = null;
  for (const sheet of listWorksheets(entries)) {
    const rows = parseRows(entries, sheet.path, sharedStrings);
    const tableWarnings: string[] = [];
    const tableRows = parseTableLayout(rows, tableWarnings);
    if (tableRows?.length) {
      const score = 100000 + tableRows.length;
      if (!best || score > best.score) best = { sheetName: sheet.name, layout: "table", rows: tableRows, warnings: tableWarnings, score };
      continue;
    }
    const wide = parseWideLayout(rows);
    const sheetBonus = normalize(sheet.name).includes("prompt") ? 10000 : 0;
    const score = (wide?.score ?? 0) + sheetBonus;
    if (wide && (!best || score > best.score)) best = { sheetName: sheet.name, layout: "wide", rows: wide.rows, warnings: wide.warnings, score };
  }
  if (!best?.rows.length) throw new Error("Không tìm thấy dữ liệu prompt. Hãy dùng các cột chủ đề như ảnh hoặc bảng Chủ đề | Tiêu đề | Prompt.");
  const seen = new Set<string>();
  const uniqueRows = best.rows.filter((row) => {
    const key = `${normalize(row.nicheName)}\u0000${normalize(row.content)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 1000);
  if (best.rows.length > uniqueRows.length) best.warnings.push(`Đã bỏ qua ${best.rows.length - uniqueRows.length} prompt trùng hoặc vượt giới hạn 1.000 prompt.`);
  return { sheetName: best.sheetName, layout: best.layout, warnings: best.warnings, rows: uniqueRows };
}
