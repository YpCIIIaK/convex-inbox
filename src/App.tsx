import { useMutation, useQuery } from "convex/react";
import { Inbox, Ticket, Users } from "lucide-react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { ConversationList, type Status } from "@/components/ConversationList";
import { ImportDialog } from "@/components/ImportDialog";
import { SimulateDialog } from "@/components/SimulateDialog";
import { TenantsView } from "@/components/TenantsView";
import { Thread } from "@/components/Thread";
import { TicketsView } from "@/components/TicketsView";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type View = "inbox" | "tenants" | "tickets";

const VIEWS = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "tenants", label: "Tenants", icon: Users },
  { key: "tickets", label: "Tickets", icon: Ticket },
] as const;

const TABS: Array<{ label: string; value: Status | undefined }> = [
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
  { label: "All", value: undefined },
];

export default function App() {
  const [view, setView] = useState<View>("inbox");
  const [status, setStatus] = useState<Status | undefined>("open");
  const [selected, setSelected] = useState<Id<"conversations"> | null>(null);
  const counts = useQuery(api.conversations.counts);
  const seed = useMutation(api.seed.run);
  const empty = counts && counts.open + counts.pending + counts.closed === 0;

  const openConversation = (id: Id<"conversations">) => {
    setView("inbox");
    setStatus(undefined);
    setSelected(id);
  };

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <h1 className="mr-2 font-semibold">Property Inbox</h1>
        <nav className="flex gap-1">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <Button key={key} size="sm" variant={view === key ? "secondary" : "ghost"} onClick={() => setView(key)}>
              <Icon /> {label}
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex gap-2">
          {empty && <Button size="sm" variant="secondary" onClick={() => seed({})}>Load demo data</Button>}
          <SimulateDialog onCreated={openConversation} />
          <ImportDialog />
        </div>
      </header>

      {view === "tenants" && <div className="min-h-0 flex-1"><TenantsView /></div>}
      {view === "tickets" && <div className="min-h-0 flex-1"><TicketsView onOpenConversation={openConversation} /></div>}
      {view === "inbox" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside className={cn("flex min-h-0 flex-col border-r", selected && "hidden md:flex")}>
            <nav className="flex gap-1 border-b p-2">
              {TABS.map((t) => (
                <Button key={t.label} size="sm" variant={status === t.value ? "secondary" : "ghost"} onClick={() => setStatus(t.value)}>
                  {t.label}
                  {t.value && counts ? <span className="text-muted-foreground">{counts[t.value]}</span> : null}
                </Button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationList status={status} selected={selected} onSelect={setSelected} />
            </div>
          </aside>
          <main className={cn("min-h-0", !selected && "hidden md:block")}>
            {selected ? (
              <div className="flex h-full flex-col">
                <Button size="sm" variant="ghost" className="m-2 self-start md:hidden" onClick={() => setSelected(null)}>← Back</Button>
                <div className="min-h-0 flex-1"><Thread key={selected} id={selected} /></div>
              </div>
            ) : (
              <p className="grid h-full place-items-center text-sm text-muted-foreground">Select a conversation</p>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
