import { ExternalLink } from "lucide-react";

export default function WebsiteChip({
  url,
  variant = "default",
  className,
}: {
  url: string;
  variant?: "default" | "subtle";
  className?: string;
}) {
  if (variant === "subtle") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className ?? ""}`}
        title={url}
      >
        <ExternalLink className="h-3 w-3" />
        View
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-fit items-center gap-1 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 ${className ?? ""}`}
    >
      <ExternalLink className="h-3 w-3" />
      Website
    </a>
  );
}
