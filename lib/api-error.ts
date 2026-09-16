export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}

export function publicError(error: unknown): { error: string; code: string } {
  if (error instanceof AppError) return { error: error.message, code: error.code };
  console.error("Lỗi máy chủ ChannelOS", error);
  return { error: "Đã xảy ra lỗi. Vui lòng thử lại.", code: "INTERNAL_ERROR" };
}

export function statusOf(error: unknown, fallback = 500): number {
  return error instanceof AppError ? error.status : fallback;
}
