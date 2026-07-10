import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  isMember?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

function initials(name?: string) {
  if (!name) return "AK";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({ name, src, size = "md", isMember, className }: UserAvatarProps) {
  return (
    <Avatar
      className={cn(
        sizeMap[size],
        isMember && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt={name ?? "User avatar"} /> : null}
      <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
