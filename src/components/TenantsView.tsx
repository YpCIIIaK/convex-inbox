import { usePaginatedQuery } from "convex/react";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TenantsView() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const { results, status, loadMore } = usePaginatedQuery(
    api.tenants.list,
    { search: deferred || undefined },
    { initialNumItems: 25 },
  );

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-3 p-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tenants by name…" className="pl-8" />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background text-left text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Property · unit</th>
            </tr>
          </thead>
          <tbody>
            {results.map((t) => (
              <tr key={t._id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{[t.email, t.phone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.property ? `${t.property} · ${t.unit ?? "—"}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {status === "LoadingFirstPage" && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
        {status === "Exhausted" && results.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">No tenants{deferred ? ` matching “${deferred}”` : " yet — import a CSV"}.</p>
        )}
      </div>
      {status === "CanLoadMore" && (
        <Button variant="outline" size="sm" className="self-center" onClick={() => loadMore(25)}>Load more</Button>
      )}
    </div>
  );
}
