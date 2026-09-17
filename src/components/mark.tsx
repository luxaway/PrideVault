import { useId } from "react";
import { cn } from "@/lib/utils";

export function RoarMark({ className }: { className?: string }) {
  return (
    <img
      src="/roar-crest.jpg"
      alt=""
      className={cn("rounded-md object-cover outline-none", className)}
    />
  );
}

export function HeartMark({ className }: { className?: string }) {
  const uid = useId();
  const left = `${uid}-left`;
  const right = `${uid}-right`;
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <clipPath id={left}>
          <rect x="0" y="0" width="16" height="32" />
        </clipPath>
        <clipPath id={right}>
          <rect x="16" y="0" width="16" height="32" />
        </clipPath>
      </defs>
      <path
        d="M16 26 C10 21 6 16.5 6 12.2 C6 9.4 8.2 7.4 10.8 7.4 C13 7.4 14.6 8.6 16 10.4 C17.4 8.6 19 7.4 21.2 7.4 C23.8 7.4 26 9.4 26 12.2 C26 16.5 22 21 16 26 Z"
        className="fill-ember"
        clipPath={`url(#${left})`}
      />
      <path
        d="M16 26 C10 21 6 16.5 6 12.2 C6 9.4 8.2 7.4 10.8 7.4 C13 7.4 14.6 8.6 16 10.4 C17.4 8.6 19 7.4 21.2 7.4 C23.8 7.4 26 9.4 26 12.2 C26 16.5 22 21 16 26 Z"
        className="fill-volt"
        clipPath={`url(#${right})`}
      />
    </svg>
  );
}
