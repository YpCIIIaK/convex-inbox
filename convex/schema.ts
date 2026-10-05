import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const channel = v.union(v.literal("email"), v.literal("whatsapp"), v.literal("phone"));
export const conversationStatus = v.union(v.literal("open"), v.literal("pending"), v.literal("closed"));
export const ticketStatus = v.union(v.literal("open"), v.literal("in_progress"), v.literal("done"));

export default defineSchema({
  properties: defineTable({
    name: v.string(),
    address: v.string(),
  }).index("by_name", ["name"]),

  units: defineTable({
    propertyId: v.id("properties"),
    label: v.string(),
  }).index("by_property_label", ["propertyId", "label"]),

  tenants: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    unitId: v.optional(v.id("units")),
    importId: v.optional(v.id("imports")),
  })
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" }),

  conversations: defineTable({
    tenantId: v.optional(v.id("tenants")),
    channel,
    subject: v.string(),
    status: conversationStatus,
    lastMessageAt: v.number(),
    preview: v.string(),
  })
    .index("by_status_last", ["status", "lastMessageAt"])
    .index("by_last", ["lastMessageAt"])
    .index("by_tenant_channel", ["tenantId", "channel", "lastMessageAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    author: v.union(v.literal("tenant"), v.literal("manager"), v.literal("ai")),
    body: v.string(),
  }).index("by_conversation", ["conversationId"]),

  tickets: defineTable({
    title: v.string(),
    description: v.string(),
    status: ticketStatus,
    tenantId: v.optional(v.id("tenants")),
    conversationId: v.optional(v.id("conversations")),
    createdBy: v.union(v.literal("ai"), v.literal("manager")),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_status", ["status"]),

  imports: defineTable({
    fileName: v.string(),
    total: v.number(),
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    errors: v.array(v.string()),
  }),

  agentRuns: defineTable({
    conversationId: v.id("conversations"),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    steps: v.array(v.object({ tool: v.string(), input: v.string(), output: v.string() })),
    error: v.optional(v.string()),
  }).index("by_conversation", ["conversationId"]),
});
