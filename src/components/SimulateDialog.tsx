import { useMutation } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelIcon } from "./ChannelIcon";

const CHANNELS = ["email", "whatsapp", "phone"] as const;

/** Sends a message through the same code path as the /inbound webhook. */
export function SimulateDialog({ onCreated }: { onCreated: (id: Id<"conversations">) => void }) {
  const simulate = useMutation(api.inbound.simulate);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("email");
  const [from, setFrom] = useState("anna.smith@example.com");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const id = await simulate({ channel, from, subject: subject || undefined, body });
      setBody("");
      setSubject("");
      setOpen(false);
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MessageSquarePlus /> Simulate inbound
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulate an incoming message</DialogTitle>
          <DialogDescription>Goes through the same logic as the /inbound webhook: matched to a tenant by email and threaded.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          {CHANNELS.map((c) => (
            <Button key={c} size="sm" variant={channel === c ? "default" : "outline"} onClick={() => setChannel(c)}>
              <ChannelIcon channel={c} className="size-3.5" /> {c}
            </Button>
          ))}
        </div>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From (email)" />
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message" rows={3} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={submit} disabled={!body.trim() || !from.trim()}>Send to inbox</Button>
      </DialogContent>
    </Dialog>
  );
}
