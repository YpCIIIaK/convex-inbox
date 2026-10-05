import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Bot } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

const COLUMNS = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

export function TicketsView({ onOpenConversation }: { onOpenConversation: (id: Id<"conversations">) => void }) {
  const board = useQuery(api.tickets.board);
  const setStatus = useMutation(api.tickets.setStatus);
  if (!board) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="grid h-full gap-3 overflow-auto p-4 md:grid-cols-3">
      {COLUMNS.map((col, i) => (
        <section key={col.key} className="flex min-h-0 flex-col rounded-lg bg-muted/50 p-2">
          <h2 className="px-1 pb-2 text-sm font-medium">
            {col.label} <span className="text-muted-foreground">{board[col.key].length}</span>
          </h2>
          <div className="space-y-2">
            {board[col.key].map((t) => (
              <article key={t._id} className="rounded-md border bg-background p-3 text-sm shadow-xs">
                <div className="flex items-start gap-2">
                  <span className="font-medium">{t.title}</span>
                  {t.createdBy === "ai" && <Badge variant="secondary" className="ml-auto"><Bot /> AI</Badge>}
                </div>
                {t.description && <p className="mt-1 text-muted-foreground">{t.description}</p>}
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="truncate">{t.tenantName ?? "No tenant"} · {timeAgo(t._creationTime)}</span>
                  <div className="ml-auto flex gap-1">
                    {i > 0 && (
                      <Button size="icon-xs" variant="ghost" aria-label="Move left" onClick={() => setStatus({ id: t._id, status: COLUMNS[i - 1].key as ColumnKey })}>
                        <ArrowLeft />
                      </Button>
                    )}
                    {i < COLUMNS.length - 1 && (
                      <Button size="icon-xs" variant="ghost" aria-label="Move right" onClick={() => setStatus({ id: t._id, status: COLUMNS[i + 1].key as ColumnKey })}>
                        <ArrowRight />
                      </Button>
                    )}
                  </div>
                </div>
                {t.conversationId && t.subject && (
                  <button className="mt-1 text-xs underline" onClick={() => onOpenConversation(t.conversationId!)}>
                    {t.subject}
                  </button>
                )}
              </article>
            ))}
            {board[col.key].length === 0 && <p className="px-1 text-xs text-muted-foreground">Empty</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
