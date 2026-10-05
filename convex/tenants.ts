import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/** Tenant directory: paginated, optional full-text search by name, with unit and property resolved. */
export const list = query({
  args: { search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { search, paginationOpts }) => {
    const q = search?.trim();
    const page = q
      ? await ctx.db.query("tenants").withSearchIndex("search_name", (s) => s.search("name", q)).paginate(paginationOpts)
      : await ctx.db.query("tenants").order("desc").paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (t) => {
          const unit = t.unitId ? await ctx.db.get(t.unitId) : null;
          const property = unit ? await ctx.db.get(unit.propertyId) : null;
          return { ...t, unit: unit?.label ?? null, property: property?.name ?? null };
        }),
      ),
    };
  },
});

/** Look up tenants by name (full-text) or exact email. Used by the agent's `find_tenant` tool. */
export const search = internalQuery({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const q = query.trim();
    const byEmail = q.includes("@")
      ? await ctx.db.query("tenants").withIndex("by_email", (i) => i.eq("email", q.toLowerCase())).take(5)
      : [];
    const byName = await ctx.db.query("tenants").withSearchIndex("search_name", (s) => s.search("name", q)).take(5);
    const seen = new Set<string>();
    const rows = [...byEmail, ...byName].filter((t) => !seen.has(t._id) && seen.add(t._id));
    return Promise.all(
      rows.map(async (t) => {
        const unit = t.unitId ? await ctx.db.get(t.unitId) : null;
        const property = unit ? await ctx.db.get(unit.propertyId) : null;
        return { id: t._id, name: t.name, email: t.email, phone: t.phone, unit: unit?.label, property: property?.name };
      }),
    );
  },
});

export const row = v.object({
  name: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  property: v.optional(v.string()),
  address: v.optional(v.string()),
  unit: v.optional(v.string()),
});

/**
 * Inserts one batch of imported rows. Properties and units are created on first sight;
 * tenants with an email that already exists are skipped, so re-running an import is safe.
 */
export const insertBatch = internalMutation({
  args: { importId: v.id("imports"), rows: v.array(row) },
  handler: async (ctx, { importId, rows }) => {
    let created = 0;
    let skipped = 0;
    for (const r of rows) {
      const email = r.email?.trim().toLowerCase() || undefined;
      if (email && (await ctx.db.query("tenants").withIndex("by_email", (q) => q.eq("email", email)).first())) {
        skipped++;
        continue;
      }
      let unitId = undefined;
      if (r.property) {
        const property =
          (await ctx.db.query("properties").withIndex("by_name", (q) => q.eq("name", r.property!)).first()) ??
          (await ctx.db.get(await ctx.db.insert("properties", { name: r.property, address: r.address ?? "" })));
        if (property && r.unit) {
          const unit = await ctx.db
            .query("units")
            .withIndex("by_property_label", (q) => q.eq("propertyId", property._id).eq("label", r.unit!))
            .first();
          unitId = unit?._id ?? (await ctx.db.insert("units", { propertyId: property._id, label: r.unit }));
        }
      }
      await ctx.db.insert("tenants", { name: r.name, email, phone: r.phone || undefined, unitId, importId });
      created++;
    }
    const imp = await ctx.db.get(importId);
    if (imp) {
      await ctx.db.patch(importId, {
        processed: imp.processed + rows.length,
        created: imp.created + created,
        skipped: imp.skipped + skipped,
      });
    }
    return { created, skipped };
  },
});
