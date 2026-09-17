import type { ChannelStatus } from "@/types/domain";

export interface YoutubeWorkbookRow {
  sourceRow: number;
  email: string | null;
  password: string | null;
  recoveryEmail: string | null;
  phone: string | null;
  hasTwoFactor: boolean;
  twoFactorSecret: string | null;
  purchasedAt: string | null;
  status: ChannelStatus;
  nicheName: string | null;
  channelUrl: string | null;
  referenceUrl: string | null;
}

export interface YoutubeWorkbookPreview {
  sheetName: string;
  rows: YoutubeWorkbookRow[];
  warnings: string[];
}

export interface YoutubeWorkbookImportResult {
  processedRows: number;
  failedRows: number;
  accountsImported: number;
  nichesCreated: number;
  channelsCreated: number;
  channelsUpdated: number;
  referencesCreated: number;
  referencesUpdated: number;
  errors: Array<{ row: number; message: string }>;
}
