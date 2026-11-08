import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

// Small motion helpers for the landing page. Both respect reduced motion and
// do nothing on touch screens where hover tilt makes no sense.

const prefersReducedMotion = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
const canHover = () => typeof window !== "undefined" && (window.matchMedia?.("(hover: hover)").matches ?? false);

type TiltProps = {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  max?: number;
  style?: CSSProperties;
};

/** A card that tilts toward the pointer in 3D, with a moving highlight. */
export function TiltCard({ children, className = "", max = 8, style }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !canHover()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        el.style.setProperty("--rx", `${(0.5 - py) * max * 2}deg`);
        el.style.setProperty("--ry", `${(px - 0.5) * max * 2}deg`);
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame.current);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame.current);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);

  return (
    <div ref={ref} className={`tilt-card ${className}`} style={style}>
      {children}
    </div>
  );
}

type RevealProps = { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" };

/** Fades and lifts its content into place the first time it scrolls into view. */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
