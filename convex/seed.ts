import { mutation } from "./_generated/server";

/** Demo data: two buildings, a few tenants and conversations. No-op if data already exists. */
export const run = mutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("conversations").first()) return "already seeded";
    const now = Date.now();
    const p1 = await ctx.db.insert("properties", { name: "Maple Court", address: "12 Maple Street, Springfield" });
    const p2 = await ctx.db.insert("properties", { name: "Riverside Lofts", address: "3 River Road, Springfield" });
    const unit = (propertyId: typeof p1, label: string) => ctx.db.insert("units", { propertyId, label });
    const anna = await ctx.db.insert("tenants", { name: "Anna Smith", email: "anna.smith@example.com", phone: "+1 555 0142", unitId: await unit(p1, "2B") });
    const jonas = await ctx.db.insert("tenants", { name: "James Walker", email: "james.walker@example.com", unitId: await unit(p1, "3A") });
    await ctx.db.insert("tenants", { name: "Mira Patel", email: "mira.patel@example.com", unitId: await unit(p2, "112") });

    const threads: Array<{ tenantId?: typeof anna; channel: "email" | "whatsapp" | "phone"; subject: string; minutesAgo: number; msgs: string[] }> = [
      { tenantId: anna, channel: "email", subject: "No heating", minutesAgo: 12, msgs: ["Hi, the heating in the living room has been cold since yesterday. Could you send someone?"] },
      { tenantId: jonas, channel: "whatsapp", subject: "Utility bill", minutesAgo: 90, msgs: ["Hi, could you send me the utility bill for 2025 again? I can't find it."] },
      { channel: "email", subject: "Water leak in bathroom", minutesAgo: 240, msgs: ["Hello, this is Mira from Riverside Lofts, apartment 112. There is water dripping from the bathroom ceiling.", "It is getting worse, please help."] },
      { channel: "phone", subject: "Call transcript: parking spot", minutesAgo: 1500, msgs: ["Caller asks whether a parking spot in the Maple Court courtyard is available to rent."] },
    ];
    for (const t of threads) {
      const at = now - t.minutesAgo * 60_000;
      const id = await ctx.db.insert("conversations", {
        tenantId: t.tenantId, channel: t.channel, subject: t.subject, status: "open", lastMessageAt: at, preview: t.msgs.at(-1)!.slice(0, 140),
      });
      for (const body of t.msgs) await ctx.db.insert("messages", { conversationId: id, author: "tenant", body });
    }
    return "seeded";
  },
});
