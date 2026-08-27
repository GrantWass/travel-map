import Image from "next/image";
import { initialsFromName } from "@/lib/utils";

export default function UserAvatar({
  name,
  image,
  size = 36,
  className,
}: {
  name?: string | null;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name ? initialsFromName(name) : "?";

  if (image) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`shrink-0 overflow-hidden rounded-full ${className ?? ""}`}
      >
        <Image
          src={image}
          alt={`${name} avatar`}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm shadow-primary/15 ${className ?? ""}`}
    >
      {initials}
    </div>
  );
}
