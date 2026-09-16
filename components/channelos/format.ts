import type { ChannelStatus, HealthStatus } from "@/types/domain";
import { t } from "@/lib/i18n";

export const statusLabels: Record<ChannelStatus, string> = {
  purchased: t("status.purchased"), setup: t("status.setup"), warm_up: t("status.warm_up"), active: t("status.active"),
  paused: t("status.paused"), warning: t("status.warning"), suspended: t("status.suspended"), dead: t("status.dead"),
};
export const healthLabels: Record<HealthStatus, string> = {
  healthy: t("health.healthy"), attention: t("health.attention"), critical: t("health.critical"), unknown: t("health.unknown"),
};
export function compactNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
export function relativeDate(value: string | null) {
  if (!value) return "Chưa có";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "Hôm nay";
  if (days === 1) return "Hôm qua";
  if (days < 30) return `${days} ngày trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
