import { PersonIcon } from "@radix-ui/react-icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  isMember?: boolean;
  /** When true and no name, show person icon instead of "G" from "Guest". */
  guest?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

const iconMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

function initials(name?: string) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function UserAvatar({
  name,
  src,
  size = "md",
  isMember,
  guest,
  className,
}: UserAvatarProps) {
  const letters = initials(name);
  const showIcon = Boolean(guest && !isMember && !letters && !src);

  return (
    <Avatar
      className={cn(
        sizeMap[size],
        isMember && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {src ? <AvatarImage src={src} alt={name ?? "User avatar"} /> : null}
      <AvatarFallback className="bg-muted font-semibold text-foreground">
        {showIcon ? (
          <PersonIcon className={iconMap[size]} aria-hidden />
        ) : (
          letters || "·"
        )}
      </AvatarFallback>
    </Avatar>
  );
}
