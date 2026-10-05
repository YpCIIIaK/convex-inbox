import { useMutation, useQuery } from "convex/react";
import { Upload } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

/** Uploads a CSV to Convex storage; the import runs server-side in batches and progress streams back live. */
export function ImportDialog() {
  const generateUploadUrl = useMutation(api.imports.generateUploadUrl);
  const start = useMutation(api.imports.start);
  const imports = useQuery(api.imports.latest);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(await generateUploadUrl(), { method: "POST", headers: { "Content-Type": file.type || "text/csv" }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = await res.json();
      await start({ storageId, fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload /> Import tenants
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import tenants from CSV</DialogTitle>
          <DialogDescription>
            Columns: name (required), email, phone, property, address, unit. Existing emails are skipped, so re-running is safe.
          </DialogDescription>
        </DialogHeader>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={uploading}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-3">
          {imports?.map((imp) => (
            <div key={imp._id} className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{imp.fileName}</span>
                <span className="shrink-0 text-muted-foreground">
                  {imp.status === "running" ? `${imp.processed}/${imp.total}` : imp.status}
                </span>
              </div>
              <Progress value={imp.total ? Math.round((imp.processed / imp.total) * 100) : imp.status === "done" ? 100 : 0} />
              <p className="text-xs text-muted-foreground">
                {imp.created} created · {imp.skipped} skipped{imp.errors.length ? ` · ${imp.errors.length} issues` : ""}
              </p>
              {imp.errors.length > 0 && (
                <ul className="max-h-20 overflow-auto text-xs text-destructive">
                  {imp.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
