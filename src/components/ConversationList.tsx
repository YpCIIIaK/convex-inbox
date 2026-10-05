import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { ChannelIcon } from "./ChannelIcon";

export type Status = "open" | "pending" | "closed";

export function ConversationList({
  status, selected, onSelect,
}: { status: Status | undefined; selected: Id<"conversations"> | null; onSelect: (id: Id<"conversations">) => void }) {
  const rows = useQuery(api.conversations.list, { status });
  if (rows === undefined) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">Nothing here.</p>;
  return (
    <ul className="divide-y">
      {rows.map((c) => (
        <li key={c._id}>
          <button
            onClick={() => onSelect(c._id)}
            className={cn("w-full px-4 py-3 text-left hover:bg-muted/60", selected === c._id && "bg-muted")}
          >
            <div className="flex items-center gap-2 text-sm">
              <ChannelIcon channel={c.channel} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{c.tenant?.name ?? "Unknown sender"}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(c.lastMessageAt)}</span>
            </div>
            <div className="mt-0.5 truncate text-sm">{c.subject}</div>
            <div className="truncate text-xs text-muted-foreground">{c.preview}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}
