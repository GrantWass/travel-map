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
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-all duration-200 hover:bg-secondary hover:shadow-xs hover:text-foreground ${className ?? ""}`}
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
      className={`inline-flex w-fit items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/10 hover:shadow-xs hover:border-primary/20 ${className ?? ""}`}
    >
      <ExternalLink className="h-3 w-3" />
      Website
    </a>
  );
}
