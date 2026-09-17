import type { Niche, Prompt } from "@/types/domain";

export interface PromptWorkbookRow {
  sourceCell: string;
  nicheName: string;
  title: string | null;
  content: string;
}

export interface PromptWorkbookPreview {
  sheetName: string;
  layout: "wide" | "table";
  rows: PromptWorkbookRow[];
  warnings: string[];
}

export interface PromptWorkbookImportResult {
  processed: number;
  created: number;
  skipped: number;
  nichesCreated: number;
  prompts: Prompt[];
  niches: Niche[];
}
