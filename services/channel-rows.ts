import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ChannelRowOrderItem = { id: string; kind: "channel" | "account" };

export async function reorderChannelRows(items: ChannelRowOrderItem[], actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  for (const [sortOrder, item] of items.entries()) {
    const table = item.kind === "channel" ? "channels" : "accounts";
    const { error } = await admin.from(table).update({ sort_order: sortOrder }).eq("id", item.id);
    if (error) throw error;
  }
  await admin.from("activity_logs").insert({
    user_id: actorId,
    action: "channel_rows.reordered",
    entity_type: "channel_board",
    new_data: { count: items.length },
  });
}
