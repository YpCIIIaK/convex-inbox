/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("import", () => {
  test("CSV upload creates properties, units and tenants; re-import skips existing emails", async () => {
    const t = setup();
    const csv = "name,email,property,unit\nAnna,ANNA@example.com,Maple Court,2B\nJonas,jonas@example.com,Maple Court,2B\n,nobody@example.com,Maple Court,1\n";
    for (const round of [1, 2]) {
      const storageId = await t.run((ctx) => ctx.storage.store(new Blob([csv])));
      const importId = await t.mutation(api.imports.start, { storageId, fileName: "tenants.csv" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      const imp = await t.run((ctx) => ctx.db.get(importId));
      expect(imp).toMatchObject({ status: "done", total: 2, processed: 2, created: round === 1 ? 2 : 0, skipped: round === 1 ? 0 : 2 });
      expect(imp!.errors).toEqual(["Row 4: empty name"]);
    }
    const counts = await t.run(async (ctx) => ({
      properties: (await ctx.db.query("properties").collect()).length,
      units: (await ctx.db.query("units").collect()).length,
      tenants: await ctx.db.query("tenants").collect(),
    }));
    expect(counts.properties).toBe(1);
    expect(counts.units).toBe(1);
    expect(counts.tenants.map((x) => x.email).sort()).toEqual(["anna@example.com", "jonas@example.com"]);
  });
});

describe("inbound", () => {
  test("matches sender to tenant and threads follow-ups on the same channel", async () => {
    const t = setup();
    const tenantId = await t.run((ctx) => ctx.db.insert("tenants", { name: "Anna", email: "anna@example.com" }));
    const first = await t.mutation(internal.inbound.receive, { channel: "email", from: "Anna@Example.com", subject: "Heating", body: "Cold" });
    const second = await t.mutation(internal.inbound.receive, { channel: "email", from: "anna@example.com", body: "Still cold" });
    const other = await t.mutation(internal.inbound.receive, { channel: "whatsapp", from: "anna@example.com", body: "Hi" });
    expect(second).toBe(first);
    expect(other).not.toBe(first);
    const data = await t.query(api.conversations.get, { id: first });
    expect(data!.conversation.tenantId).toBe(tenantId);
    expect(data!.messages.map((m) => m.body)).toEqual(["Cold", "Still cold"]);
  });

  test("manager reply moves the thread to pending", async () => {
    const t = setup();
    const id = await t.mutation(internal.inbound.receive, { channel: "phone", from: "unknown", body: "Call me" });
    await t.mutation(api.conversations.send, { id, body: "  Calling you back today  " });
    const data = await t.query(api.conversations.get, { id });
    expect(data!.conversation.status).toBe("pending");
    expect(data!.messages.at(-1)).toMatchObject({ author: "manager", body: "Calling you back today" });
  });
});

describe("agent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("uses tools to link the tenant, open a ticket and set status, then saves the reply draft", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const t = setup();
    const tenantId = await t.run((ctx) => ctx.db.insert("tenants", { name: "Mira Patel", email: "mira@example.com" }));
    const id = await t.mutation(internal.inbound.receive, { channel: "email", from: "someone@example.org", body: "Mira here, water leak!" });

    const replies = [
      { tool_calls: [{ id: "1", function: { name: "find_tenant", arguments: '{"query":"Mira"}' } }] },
      { tool_calls: [
        { id: "2", function: { name: "link_tenant", arguments: JSON.stringify({ tenant_id: tenantId }) } },
        { id: "3", function: { name: "create_ticket", arguments: '{"title":"Water leak","description":"Bathroom ceiling"}' } },
        { id: "4", function: { name: "set_status", arguments: '{"status":"pending"}' } },
      ] },
      { content: "Hi Mira, a plumber is on the way." },
    ];
    const bodies: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ choices: [{ message: { role: "assistant", content: null, ...replies[bodies.length - 1] } }] });
    }));

    const runId = await t.mutation(api.agent.start, { conversationId: id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run!.status).toBe("done");
    expect(run!.steps.map((s) => s.tool)).toEqual(["find_tenant", "link_tenant", "create_ticket", "set_status"]);
    expect(JSON.parse(run!.steps[0].output)[0]).toMatchObject({ name: "Mira Patel" });
    const data = await t.query(api.conversations.get, { id });
    expect(data!.conversation).toMatchObject({ tenantId, status: "pending" });
    expect(data!.tickets).toHaveLength(1);
    expect(data!.tickets[0]).toMatchObject({ title: "Water leak", tenantId, createdBy: "ai" });
    expect(data!.messages.at(-1)).toMatchObject({ author: "ai", body: "Hi Mira, a plumber is on the way." });
    // tool results are fed back to the model
    expect(bodies[1].messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "1" });
  });

  test("bad tool input is reported to the model, not thrown", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test");
    const t = setup();
    const id = await t.mutation(internal.inbound.receive, { channel: "email", from: "x@example.org", body: "hi" });
    const replies = [
      { tool_calls: [{ id: "1", function: { name: "link_tenant", arguments: '{"tenant_id":"nope"}' } }] },
      { content: "Hello!" },
    ];
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { role: "assistant", content: null, ...replies[n++] } }] })));
    const runId = await t.mutation(api.agent.start, { conversationId: id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const run = await t.run((ctx) => ctx.db.get(runId));
    expect(run).toMatchObject({ status: "done", steps: [{ tool: "link_tenant", output: "Error: no tenant with this id" }] });
  });

  test("fails cleanly without an API key", async () => {
    const t = setup();
    const id = await t.mutation(internal.inbound.receive, { channel: "email", from: "x@example.org", body: "hi" });
    const runId = await t.mutation(api.agent.start, { conversationId: id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", error: expect.stringMatching(/OPENROUTER_API_KEY/) });
  });
});

describe("threads, tickets, tenants", () => {
  test("a message after the thread was closed starts a new thread", async () => {
    const t = setup();
    await t.run((ctx) => ctx.db.insert("tenants", { name: "Anna", email: "anna@example.com" }));
    const first = await t.mutation(api.inbound.simulate, { channel: "email", from: "anna@example.com", body: "Hi" });
    await t.mutation(api.conversations.setStatus, { id: first, status: "closed" });
    const second = await t.mutation(api.inbound.simulate, { channel: "email", from: "anna@example.com", body: "New issue" });
    expect(second).not.toBe(first);
    await expect(t.mutation(api.inbound.simulate, { channel: "email", from: "anna@example.com", body: "  " })).rejects.toThrow(/empty/);
  });

  test("manual ticket shows up on the board and moves between columns", async () => {
    const t = setup();
    const tenantId = await t.run((ctx) => ctx.db.insert("tenants", { name: "Anna", email: "anna@example.com" }));
    const conversationId = await t.mutation(api.inbound.simulate, { channel: "phone", from: "anna@example.com", subject: "Door", body: "Door is stuck" });
    const id = await t.mutation(api.tickets.create, { conversationId, title: " Fix front door " });
    let board = await t.query(api.tickets.board, {});
    expect(board.open[0]).toMatchObject({ _id: id, title: "Fix front door", tenantId, tenantName: "Anna", subject: "Door", createdBy: "manager" });
    await t.mutation(api.tickets.setStatus, { id, status: "in_progress" });
    board = await t.query(api.tickets.board, {});
    expect(board.open).toHaveLength(0);
    expect(board.in_progress.map((x) => x._id)).toEqual([id]);
  });

  test("tenant directory paginates and searches by name", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const p = await ctx.db.insert("properties", { name: "Maple Court", address: "" });
      const u = await ctx.db.insert("units", { propertyId: p, label: "2B" });
      for (const name of ["Anna Smith", "James Walker", "Mira Patel"]) await ctx.db.insert("tenants", { name, unitId: name === "Anna Smith" ? u : undefined });
    });
    const page1 = await t.query(api.tenants.list, { paginationOpts: { numItems: 2, cursor: null } });
    expect(page1.page).toHaveLength(2);
    expect(page1.isDone).toBe(false);
    const found = await t.query(api.tenants.list, { search: "anna", paginationOpts: { numItems: 10, cursor: null } });
    expect(found.page).toEqual([expect.objectContaining({ name: "Anna Smith", unit: "2B", property: "Maple Court" })]);
  });
});
