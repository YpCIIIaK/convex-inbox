import { useMutation, useQuery } from "convex/react";
import { Bot, Loader2, Plus, Send, Ticket } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChannelIcon } from "./ChannelIcon";
import type { Status } from "./ConversationList";

const STATUSES: Status[] = ["open", "pending", "closed"];

export function Thread({ id }: { id: Id<"conversations"> }) {
  const data = useQuery(api.conversations.get, { id });
  // Optimistic update: the reply appears in the thread instantly and is replaced by the server version when it commits.
  const send = useMutation(api.conversations.send).withOptimisticUpdate((store, { id: cid, body }) => {
    const current = store.getQuery(api.conversations.get, { id: cid });
    if (!current) return;
    const optimistic = {
      _id: `optimistic-${Date.now()}` as Id<"messages">, _creationTime: Date.now(), conversationId: cid, author: "manager" as const, body: body.trim(),
    };
    store.setQuery(api.conversations.get, { id: cid }, {
      ...current,
      conversation: { ...current.conversation, status: "pending" },
      messages: [...current.messages, optimistic],
    });
  });
  const createTicket = useMutation(api.tickets.create);
  const [ticketTitle, setTicketTitle] = useState("");
  const setStatus = useMutation(api.conversations.setStatus);
  const runAgent = useMutation(api.agent.start);
  const [draft, setDraft] = useState("");

  if (data === undefined) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (data === null) return <p className="p-6 text-sm text-muted-foreground">Conversation not found.</p>;
  const { conversation, tenant, unit, property, messages, tickets, lastRun } = data;
  const agentBusy = lastRun?.status === "running";

  async function submit() {
    if (!draft.trim()) return;
    await send({ id, body: draft });
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-start gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <ChannelIcon channel={conversation.channel} className="size-4 text-muted-foreground" />
            <span className="truncate">{conversation.subject}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {tenant ? `${tenant.name}${tenant.email ? ` · ${tenant.email}` : ""}` : "Sender not linked to a tenant"}
            {unit && property ? ` · ${property.name}, unit ${unit.label}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant={conversation.status === s ? "default" : "outline"} onClick={() => setStatus({ id, status: s })}>
              {s}
            </Button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m._id} className={cn("flex", m.author === "tenant" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                m.author === "tenant" && "bg-muted",
                m.author === "manager" && "bg-primary text-primary-foreground",
                m.author === "ai" && "border border-dashed bg-background",
              )}
            >
              {m.author === "ai" && (
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Bot className="size-3.5" /> AI draft
                  <button className="ml-auto underline" onClick={() => setDraft(m.body)}>use as reply</button>
                </div>
              )}
              {m.body}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t px-4 py-3 text-sm">
          {tickets.map((t) => (
            <div key={t._id} className="flex items-center gap-2">
              <Ticket className="size-4 text-muted-foreground" />
              <span className="font-medium">{t.title}</span>
              <span className="truncate text-muted-foreground">{t.description}</span>
              <Badge variant="outline" className="ml-auto">{t.createdBy === "ai" ? "AI" : "manual"} · {t.status}</Badge>
            </div>
          ))}
          {lastRun && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="size-3.5" /> Agent {lastRun.status}
              {lastRun.steps.map((s, i) => <Badge key={i} variant="secondary" title={`${s.input}\n→ ${s.output}`}>{s.tool}</Badge>)}
              {lastRun.error && <span className="text-destructive">{lastRun.error}</span>}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!ticketTitle.trim()) return;
              await createTicket({ conversationId: id, title: ticketTitle });
              setTicketTitle("");
            }}
          >
            <Input value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} placeholder="New ticket title…" className="h-8" />
            <Button type="submit" size="sm" variant="outline" disabled={!ticketTitle.trim()}><Plus /> Ticket</Button>
          </form>
        </div>

      <footer className="space-y-2 border-t p-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
          placeholder="Reply to the tenant… (Ctrl+Enter to send)"
          rows={3}
        />
        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" disabled={agentBusy} onClick={() => runAgent({ conversationId: id })}>
            {agentBusy ? <Loader2 className="animate-spin" /> : <Bot />} Let the agent handle it
          </Button>
          <Button size="sm" disabled={!draft.trim()} onClick={submit}>
            <Send /> Send
          </Button>
        </div>
      </footer>
    </div>
  );
}
