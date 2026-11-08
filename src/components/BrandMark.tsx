import { cn } from "@/lib/utils";

/** The ShopMind brain logo (transparent PNG, tuned for the dark UI). */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={128}
      height={128}
      draggable={false}
      className={cn("h-9 w-9 shrink-0 select-none object-contain drop-shadow-[0_0_10px_rgba(139,92,246,0.35)]", className)}
    />
  );
}
