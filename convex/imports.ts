import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { parseCsv, toTenantRows } from "./lib/csv";

const BATCH = 200;
const MAX_ERRORS = 50;

export const generateUploadUrl = mutation({
  args: {},
  handler: (ctx) => ctx.storage.generateUploadUrl(),
});

/** Registers an uploaded CSV and processes it in the background; the client follows progress via `latest`. */
export const start = mutation({
  args: { storageId: v.id("_storage"), fileName: v.string() },
  handler: async (ctx, { storageId, fileName }) => {
    const importId = await ctx.db.insert("imports", {
      fileName, total: 0, processed: 0, created: 0, skipped: 0, status: "running", errors: [],
    });
    await ctx.scheduler.runAfter(0, internal.imports.run, { importId, storageId });
    return importId;
  },
});

export const latest = query({
  args: {},
  handler: (ctx) => ctx.db.query("imports").order("desc").take(5),
});

export const run = internalAction({
  args: { importId: v.id("imports"), storageId: v.id("_storage") },
  handler: async (ctx, { importId, storageId }) => {
    try {
      const blob = await ctx.storage.get(storageId);
      if (!blob) throw new Error("Uploaded file not found");
      const { rows, errors } = toTenantRows(parseCsv(await blob.text()));
      await ctx.runMutation(internal.imports.update, { importId, total: rows.length, errors: errors.slice(0, MAX_ERRORS) });
      // One transaction per batch: a failure mid-way keeps earlier batches, and a re-run skips them by email.
      for (let i = 0; i < rows.length; i += BATCH) {
        await ctx.runMutation(internal.tenants.insertBatch, { importId, rows: rows.slice(i, i + BATCH) });
      }
      await ctx.runMutation(internal.imports.update, { importId, status: "done" });
    } catch (e) {
      await ctx.runMutation(internal.imports.update, { importId, status: "failed", errors: [String(e)] });
    } finally {
      await ctx.storage.delete(storageId);
    }
  },
});

export const update = internalMutation({
  args: {
    importId: v.id("imports"),
    total: v.optional(v.number()),
    status: v.optional(v.union(v.literal("done"), v.literal("failed"))),
    errors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { importId, errors, ...rest }) => {
    const imp = await ctx.db.get(importId);
    if (!imp) return;
    await ctx.db.patch(importId, {
      ...Object.fromEntries(Object.entries(rest).filter(([, x]) => x !== undefined)),
      ...(errors ? { errors: [...imp.errors, ...errors].slice(0, MAX_ERRORS) } : {}),
    });
  },
});
