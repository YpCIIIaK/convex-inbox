import { Mail, MessageCircle, Phone } from "lucide-react";

const ICONS = { email: Mail, whatsapp: MessageCircle, phone: Phone } as const;

export function ChannelIcon({ channel, className }: { channel: keyof typeof ICONS; className?: string }) {
  const Icon = ICONS[channel];
  return <Icon className={className ?? "size-4"} aria-label={channel} />;
}
