import { unzipSync } from "fflate";
import type { ChannelStatus } from "@/types/domain";
import type { YoutubeWorkbookPreview, YoutubeWorkbookRow } from "@/types/workbook-import";

const TARGET_SHEET = "Quản lý kênh";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const decoder = new TextDecoder("utf-8");

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

function normalizeHeader(value: CellValue): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: CellValue): string | null {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function cleanSecret(value: CellValue): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function cleanEmail(value: CellValue, row: number, label: string, warnings: string[]): string | null {
  const email = cleanText(value)?.toLowerCase() ?? null;
  if (!email) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  warnings.push(`Dòng ${row}: ${label} không đúng định dạng nên đã bỏ qua.`);
  return null;
}

function normalizeYouTubeUrl(value: CellValue, row: number, label: string, warnings: string[]): string | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase())) throw new Error();
    url.protocol = "https:";
    return url.toString();
  } catch {
    warnings.push(`Dòng ${row}: ${label} không phải URL YouTube hợp lệ nên đã bỏ qua.`);
    return null;
  }
}

function excelDate(value: CellValue, row: number, warnings: string[]): string | null {
  if (value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(String(value));
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  warnings.push(`Dòng ${row}: ngày mua không hợp lệ nên đã bỏ qua.`);
  return null;
}

function mapStatus(value: CellValue): ChannelStatus {
  const status = normalizeHeader(value).replace(/[_-]/g, " ");
  if (["dang hoat dong", "active", "hoat dong"].includes(status)) return "active";
  if (["ngam", "warm up", "warmup"].includes(status)) return "warm_up";
  if (["da chet", "chet", "dead"].includes(status)) return "dead";
  if (["tam dung", "paused", "pause"].includes(status)) return "paused";
  if (["canh bao", "warning"].includes(status)) return "warning";
  if (["dinh chi", "suspended"].includes(status)) return "suspended";
  if (["da mua", "purchased"].includes(status)) return "purchased";
  return "setup";
}

function parseSharedStrings(entries: Record<string, Uint8Array>): string[] {
  const bytes = entries["xl/sharedStrings.xml"];
  if (!bytes) return [];
  const document = parseXml(bytes, "xl/sharedStrings.xml");
  return elementsByLocalName(document, "si").map(textOf);
}

function parseRows(entries: Record<string, Uint8Array>, worksheetPath: string, sharedStrings: string[]): Map<number, CellValue[]> {
  const document = parseXml(requireEntry(entries, worksheetPath), worksheetPath);
  const result = new Map<number, CellValue[]>();
  for (const rowElement of elementsByLocalName(document, "row")) {
    const rowNumber = Number(rowElement.getAttribute("r") || 0);
    if (!rowNumber || rowNumber > 500) continue;
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
      else if (valueElement?.textContent != null) {
        const number = Number(valueElement.textContent);
        value = Number.isFinite(number) ? number : valueElement.textContent;
      }
      row[columnIndex(reference)] = value;
    }
    result.set(rowNumber, row);
  }
  return result;
}

function worksheetPath(entries: Record<string, Uint8Array>, sheetName: string): string {
  const workbook = parseXml(requireEntry(entries, "xl/workbook.xml"), "xl/workbook.xml");
  const sheet = elementsByLocalName(workbook, "sheet").find((item) => item.getAttribute("name") === sheetName);
  if (!sheet) throw new Error(`Không tìm thấy sheet “${sheetName}”.`);
  const relationshipId = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
  const relationships = parseXml(requireEntry(entries, "xl/_rels/workbook.xml.rels"), "xl/_rels/workbook.xml.rels");
  const relationship = elementsByLocalName(relationships, "Relationship").find((item) => item.getAttribute("Id") === relationshipId);
  const target = relationship?.getAttribute("Target")?.replace(/\\/g, "/");
  if (!target) throw new Error(`Không thể xác định dữ liệu của sheet “${sheetName}”.`);
  return target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`;
}

export async function parseYoutubeWorkbook(file: File): Promise<YoutubeWorkbookPreview> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file Excel .xlsx.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File Excel vượt quá giới hạn 10 MB.");

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("Không thể mở file Excel. Hãy kiểm tra file có đúng định dạng .xlsx hay không.");
  }

  const rows = parseRows(entries, worksheetPath(entries, TARGET_SHEET), parseSharedStrings(entries));
  const headers = rows.get(1) ?? [];
  const indexes = new Map(Array.from(headers.entries(), ([index, value]) => [normalizeHeader(value), index]));
  for (const required of ["username", "tinh trang", "chu de", "link kenh"]) {
    if (!indexes.has(required)) throw new Error(`Sheet “${TARGET_SHEET}” thiếu cột bắt buộc “${required}”.`);
  }

  const warnings: string[] = [];
  const parsedRows: YoutubeWorkbookRow[] = [];
  const at = (row: CellValue[], header: string) => row[indexes.get(header) ?? -1] ?? null;

  for (let rowNumber = 2; rowNumber <= 500; rowNumber += 1) {
    const row = rows.get(rowNumber) ?? [];
    const isBlank = ["username", "email 2", "sdt", "ngay mua", "tinh trang", "chu de", "link kenh", "kenh tham khao"]
      .every((header) => !cleanText(at(row, header)));
    if (isBlank) break;

    const email = cleanEmail(at(row, "username"), rowNumber, "email tài khoản", warnings);
    const channelUrl = normalizeYouTubeUrl(at(row, "link kenh"), rowNumber, "link kênh", warnings);
    const referenceUrl = normalizeYouTubeUrl(at(row, "kenh tham khao"), rowNumber, "kênh tham khảo", warnings);
    if (!email && !channelUrl && !referenceUrl) {
      warnings.push(`Dòng ${rowNumber}: không có email hoặc link kênh hợp lệ nên đã bỏ qua.`);
      continue;
    }

    parsedRows.push({
      sourceRow: rowNumber,
      email,
      password: cleanSecret(at(row, "mat khau")),
      recoveryEmail: cleanEmail(at(row, "email 2"), rowNumber, "email khôi phục", warnings),
      phone: cleanText(at(row, "sdt")),
      hasTwoFactor: Boolean(cleanText(at(row, "2fa"))),
      twoFactorSecret: cleanSecret(at(row, "2fa")),
      purchasedAt: excelDate(at(row, "ngay mua"), rowNumber, warnings),
      status: mapStatus(at(row, "tinh trang")),
      nicheName: cleanText(at(row, "chu de")),
      channelUrl,
      referenceUrl,
    });
  }

  if (!parsedRows.length) throw new Error(`Sheet “${TARGET_SHEET}” không có dòng dữ liệu hợp lệ.`);
  return { sheetName: TARGET_SHEET, rows: parsedRows, warnings };
}
