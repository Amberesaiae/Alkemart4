import { useRef, useState } from "react";
import { UploadIcon, Cross2Icon } from "@radix-ui/react-icons";
import {
  useRequestImageUploadUrl,
  useRegisterImage,
} from "@workspace/api-client-react";
import type { ImageTargetType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ImageSlot } from "./image-slot";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  targetType: ImageTargetType;
  targetId?: number | null;
  currentImageUrl?: string | null;
  label?: string;
  ratio?: number;
  onUploaded?: () => void;
  className?: string;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "pending"; message: string }
  | { phase: "rejected"; message: string }
  | { phase: "error"; message: string };

/**
 * Vendor/admin image upload control: requests a presigned upload URL, PUTs
 * the raw file to object storage, then registers it for server-side
 * technical validation + moderation. Approved images replace `currentImageUrl`
 * once an admin approves them (via the moderation queue).
 */
export function ImageUploader({
  targetType,
  targetId,
  currentImageUrl,
  label = "Image",
  ratio = 1,
  onUploaded,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const requestUploadUrl = useRequestImageUploadUrl();
  const registerImage = useRegisterImage();

  async function handleFile(file: File) {
    setState({ phase: "uploading" });
    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Upload to storage failed");
      }

      const registered = await registerImage.mutateAsync({
        data: { objectPath, targetType, targetId: targetId ?? null },
      });

      if (registered.status === "rejected") {
        setState({
          phase: "rejected",
          message: registered.rejectionReason ?? "Image was rejected.",
        });
      } else {
        setState({
          phase: "pending",
          message: "Uploaded — awaiting admin approval.",
        });
      }
      onUploaded?.();
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isBusy = state.phase === "uploading";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="w-40">
        <ImageSlot ratio={ratio} rounded="md" tone="brand" src={currentImageUrl} alt={label} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="h-4 w-4" />
        {isBusy ? "Uploading…" : "Upload image"}
      </Button>
      {state.phase === "pending" && (
        <p className="text-xs text-muted-foreground">{state.message}</p>
      )}
      {state.phase === "rejected" && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <Cross2Icon className="mt-0.5 h-3 w-3 shrink-0" />
          {state.message}
        </p>
      )}
      {state.phase === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        JPEG, PNG or WebP, at least 600×600px, up to 5MB.
      </p>
    </div>
  );
}
