import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { conversationStatus } from "./schema";

export const list = query({
  args: { status: v.optional(conversationStatus) },
  handler: async (ctx, { status }) => {
    const rows = status
      ? await ctx.db.query("conversations").withIndex("by_status_last", (q) => q.eq("status", status)).order("desc").take(100)
      : await ctx.db.query("conversations").withIndex("by_last").order("desc").take(100);
    return Promise.all(
      rows.map(async (c) => ({ ...c, tenant: c.tenantId ? await ctx.db.get(c.tenantId) : null })),
    );
  },
});

export const get = query({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const conversation = await ctx.db.get(id);
    if (!conversation) return null;
    const tenant = conversation.tenantId ? await ctx.db.get(conversation.tenantId) : null;
    const unit = tenant?.unitId ? await ctx.db.get(tenant.unitId) : null;
    const property = unit ? await ctx.db.get(unit.propertyId) : null;
    const messages = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", id)).collect();
    const tickets = await ctx.db.query("tickets").withIndex("by_conversation", (q) => q.eq("conversationId", id)).collect();
    const lastRun = await ctx.db.query("agentRuns").withIndex("by_conversation", (q) => q.eq("conversationId", id)).order("desc").first();
    return { conversation, tenant, unit, property, messages, tickets, lastRun };
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    const out = { open: 0, pending: 0, closed: 0 };
    for (const s of ["open", "pending", "closed"] as const) {
      out[s] = (await ctx.db.query("conversations").withIndex("by_status_last", (q) => q.eq("status", s)).take(1000)).length;
    }
    return out;
  },
});

export const setStatus = mutation({
  args: { id: v.id("conversations"), status: conversationStatus },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

export const send = mutation({
  args: { id: v.id("conversations"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const text = body.trim();
    if (!text) throw new Error("Empty message");
    await ctx.db.insert("messages", { conversationId: id, author: "manager", body: text });
    await ctx.db.patch(id, { lastMessageAt: Date.now(), preview: text.slice(0, 140), status: "pending" });
  },
});

/** Context for the agent: conversation, tenant and full message history. */
export const forAgent = internalQuery({
  args: { id: v.id("conversations") },
  handler: async (ctx, { id }) => {
    const conversation = await ctx.db.get(id);
    if (!conversation) throw new Error("Conversation not found");
    const tenant = conversation.tenantId ? await ctx.db.get(conversation.tenantId) : null;
    const messages = await ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", id)).collect();
    return { conversation, tenant, messages };
  },
});
