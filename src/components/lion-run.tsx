import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Copy } from "@/lib/i18n";
import { subscribeSignUi, type SignUi } from "@/lib/wallet";
import { subscribeTxLane } from "@/lib/tx-lane";

const STRIP = `/lion/run-strip.png?v=7`;

const ICON = {
  sm: "h-6 w-11",
  md: "h-11 w-[4.8rem]",
  lg: "h-[4.25rem] w-[7.6rem]",
} as const;

const TRACK = {
  md: "h-[4.25rem]",
  lg: "h-28",
} as const;

const RUNNER = {
  md: "h-14 w-[6.4rem]",
  lg: "h-[5.5rem] w-[10rem]",
} as const;

function LionSprite({ className }: { className?: string }) {
  return (
    <span className={cn("lion-sprite", className)} aria-hidden="true">
      <img
        src={STRIP}
        alt=""
        className="lion-sprite-sheet"
        draggable={false}
      />
    </span>
  );
}

function currentX(el: HTMLElement) {
  const raw = getComputedStyle(el).transform;
  if (!raw || raw === "none") return 0;
  try {
    return new DOMMatrixReadOnly(raw).m41;
  } catch {
    return 0;
  }
}

export function LionRun({
  size = "md",
  className,
  label,
}: {
  size?: keyof typeof ICON;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn("lion-run inline-flex items-end justify-center", ICON[size], className)}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <LionSprite className="h-full w-full" />
    </span>
  );
}

export function LionTrack({
  done = false,
  size = "md",
  label,
  hint,
  className,
}: {
  done?: boolean;
  size?: keyof typeof TRACK;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const runnerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const runner = runnerRef.current;
    if (!track || !runner) return;
    const lane = runner;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const widthOf = () => Math.max(24, lane.clientWidth);
    const finishX = () => Math.max(0, track.clientWidth - widthOf() - 8);
    const enterX = () => -widthOf();
    const exitX = () => track.clientWidth + 8;
    let cancelled = false;
    let anim: Animation | null = null;

    function stop() {
      lane.getAnimations().forEach((a) => a.cancel());
      anim = null;
    }

    function playForward(from: number, to: number, duration: number, easing: string) {
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      stop();
      if (end - start < 1) {
        lane.style.transform = `translateX(${end}px)`;
        return null;
      }
      lane.style.transform = `translateX(${start}px)`;
      anim = lane.animate(
        [{ transform: `translateX(${start}px)` }, { transform: `translateX(${end}px)` }],
        { duration, easing, fill: "forwards" },
      );
      return anim;
    }

    function loopForward() {
      if (cancelled || done) return;
      const from = enterX();
      const to = exitX();
      const dist = Math.max(48, to - from);
      const duration = Math.min(5600, Math.max(2800, dist * 3.2));
      const run = playForward(from, to, duration, "linear");
      if (!run) return;
      run.onfinish = () => {
        if (cancelled || done) return;
        loopForward();
      };
    }

    if (reduce) {
      stop();
      lane.style.transform = `translateX(${done ? finishX() : finishX() * 0.42}px)`;
      return;
    }

    if (done) {
      const to = finishX();
      const from = currentX(lane);
      if (from >= to - 1) {
        stop();
        lane.style.transform = `translateX(${to}px)`;
      } else {
        const start = from < enterX() + 1 ? enterX() : from;
        playForward(
          start,
          to,
          Math.min(900, Math.max(280, (to - start) * 1.05)),
          "cubic-bezier(0.22, 1, 0.36, 1)",
        );
      }
      return () => {
        cancelled = true;
        stop();
      };
    }

    loopForward();
    return () => {
      cancelled = true;
      stop();
    };
  }, [done]);

  return (
    <div
      className={cn("lion-track", done && "is-done", className)}
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div ref={trackRef} className={cn("relative overflow-hidden", TRACK[size])}>
        <span className="lion-track-ground" />
        <span className="lion-track-finish" />
        <span ref={runnerRef} className={cn("lion-track-runner", RUNNER[size])}>
          <LionSprite className="h-full w-full" />
        </span>
      </div>
      {hint ? <p className="mt-2 px-1 text-center text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TxLaneHost({ t }: { t: Copy }) {
  const [lane, setLane] = useState({ open: false, done: false });
  const [sign, setSign] = useState<SignUi>(null);

  useEffect(() => subscribeTxLane(setLane), []);
  useEffect(() => subscribeSignUi(setSign), []);

  if (!lane.open) return null;
  if (sign && !lane.done) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 px-4">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
        <LionTrack done={lane.done} size="md" label={lane.done ? t.txLaneDone : t.txRun} />
        <p className="mt-2 text-center text-xs text-volt">{lane.done ? t.txLaneDone : t.waitingTx}</p>
      </div>
    </div>
  );
}