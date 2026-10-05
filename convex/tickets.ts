import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ticketStatus } from "./schema";

/** All tickets grouped for the board, newest first, with tenant and conversation subject. */
export const board = query({
  args: {},
  handler: async (ctx) => {
    const column = async (status: "open" | "in_progress" | "done") => {
      const rows = await ctx.db.query("tickets").withIndex("by_status", (q) => q.eq("status", status)).order("desc").take(100);
      return Promise.all(
        rows.map(async (t) => ({
          ...t,
          tenantName: t.tenantId ? (await ctx.db.get(t.tenantId))?.name ?? null : null,
          subject: t.conversationId ? (await ctx.db.get(t.conversationId))?.subject ?? null : null,
        })),
      );
    };
    return { open: await column("open"), in_progress: await column("in_progress"), done: await column("done") };
  },
});

export const setStatus = mutation({
  args: { id: v.id("tickets"), status: ticketStatus },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

/** Manual ticket from a conversation. */
export const create = mutation({
  args: { conversationId: v.id("conversations"), title: v.string(), description: v.optional(v.string()) },
  handler: async (ctx, { conversationId, title, description }) => {
    if (!title.trim()) throw new Error("Title is required");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    return ctx.db.insert("tickets", {
      title: title.trim(), description: description?.trim() ?? "", status: "open",
      conversationId, tenantId: conversation.tenantId, createdBy: "manager",
    });
  },
});
