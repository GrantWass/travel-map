import { formatStopCost } from "@/components/stop-item-card";

export default function CostBadge({
  cost,
  variant = "default",
  className,
}: {
  cost: number | string | null | undefined;
  variant?: "default" | "light";
  className?: string;
}) {
  const label = formatStopCost(cost);
  if (!label) return null;

  if (variant === "light") {
    return (
      <span className={`flex-shrink-0 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-muted-foreground ${className ?? ""}`}>
        {label}
      </span>
    );
  }

  return (
    <span className={`ml-auto flex-shrink-0 rounded-full bg-secondary/70 px-2 py-0.5 text-xs font-medium text-foreground ${className ?? ""}`}>
      {label}
    </span>
  );
}
