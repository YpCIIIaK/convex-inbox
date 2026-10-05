import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

/** Webhook for inbound messages (e.g. an email provider or WhatsApp bridge). Protected by INBOUND_SECRET. */
http.route({
  path: "/inbound",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.INBOUND_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const channel = body?.channel;
    if (!body || typeof body.from !== "string" || typeof body.body !== "string" ||
        (channel !== "email" && channel !== "whatsapp" && channel !== "phone")) {
      return new Response("Expected JSON { channel: email|whatsapp|phone, from, subject?, body }", { status: 400 });
    }
    const id = await ctx.runMutation(internal.inbound.receive, {
      channel, from: body.from, body: body.body, subject: typeof body.subject === "string" ? body.subject : undefined,
    });
    return Response.json({ conversationId: id });
  }),
});

export default http;
