import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { channel } from "./schema";

type Inbound = { channel: "email" | "whatsapp" | "phone"; from: string; subject?: string; body: string };

/**
 * A message arriving from email / WhatsApp / phone transcription.
 * Matches the sender to a tenant by email and appends to their latest non-closed thread on that channel.
 */
export const receive = internalMutation({
  args: { channel, from: v.string(), subject: v.optional(v.string()), body: v.string() },
  handler: (ctx, args) => receiveMessage(ctx, args),
});

/** Same as the webhook, callable from the UI so the demo works without curl. */
export const simulate = mutation({
  args: { channel, from: v.string(), subject: v.optional(v.string()), body: v.string() },
  handler: (ctx, args) => {
    if (!args.body.trim()) throw new Error("Message is empty");
    return receiveMessage(ctx, args);
  },
});

async function receiveMessage(ctx: MutationCtx, { channel, from, subject, body }: Inbound) {
  const email = from.trim().toLowerCase();
  const tenant = await ctx.db.query("tenants").withIndex("by_email", (q) => q.eq("email", email)).first();
  const now = Date.now();
  // Latest thread of this tenant on this channel; a new message reopens it unless it was closed.
  const latest = tenant
    ? await ctx.db
        .query("conversations")
        .withIndex("by_tenant_channel", (q) => q.eq("tenantId", tenant._id).eq("channel", channel))
        .order("desc")
        .first()
    : null;
  const conversation = latest && latest.status !== "closed" ? latest : null;
  const id =
    conversation?._id ??
    (await ctx.db.insert("conversations", {
      tenantId: tenant?._id, channel, subject: subject || `Message from ${from}`, status: "open", lastMessageAt: now, preview: "",
    }));
  await ctx.db.insert("messages", { conversationId: id, author: "tenant", body });
  await ctx.db.patch(id, { lastMessageAt: now, preview: body.slice(0, 140), status: "open" });
  return id;
}
