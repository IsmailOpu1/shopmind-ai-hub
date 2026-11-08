import { type ReactNode, Suspense, lazy, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Headset, Languages, ShieldCheck } from "lucide-react";
import BrandMark from "@/components/BrandMark";

const HeroScene = lazy(() => import("@/components/landing/HeroScene"));

const POINTS = [
  { icon: ShieldCheck, text: "Answers only from your products and store info" },
  { icon: Languages, text: "Talks to shoppers in English, Bangla and Banglish" },
  { icon: Headset, text: "Hands tricky chats to your team in one tap" },
];

type Props = { title: string; subtitle: string; children: ReactNode };

/** Shared layout for log in and sign up: brand panel with the 3D scene, form card. */
export default function AuthShell({ title, subtitle, children }: Props) {
  const [sceneFailed, setSceneFailed] = useState(false);
  const onError = useCallback(() => setSceneFailed(true), []);

  return (
    <div className="landing relative flex min-h-screen overflow-x-hidden text-slate-200">
      <div className="landing-bg" aria-hidden="true" />

      {/* Brand panel (large screens) */}
      <aside className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r border-white/[0.06] p-12 lg:flex xl:p-16">
        <Link to="/" className="relative z-10 flex items-center gap-2.5">
          <BrandMark className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight text-white">ShopMind AI</span>
        </Link>

        <div className="relative h-[46vh] min-h-[300px]" aria-hidden="true">
          <div className="absolute inset-0 hero-visual-glow" />
          {sceneFailed ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="hero-orb-fallback" />
            </div>
          ) : (
            <Suspense fallback={null}>
              <HeroScene onError={onError} className="absolute inset-0" />
            </Suspense>
          )}
        </div>

        <div className="relative z-10">
          <h2 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Your store&rsquo;s best salesperson, <span className="text-gradient-hero">awake 24/7.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="icon-chip !h-9 !w-9 !rounded-lg">
                  <p.icon className="h-4 w-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex flex-1 flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <BrandMark />
            <span className="font-semibold text-white">ShopMind AI</span>
          </Link>
          <Link
            to="/"
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="hero-in w-full max-w-md">
            <div className="auth-card rounded-3xl p-7 sm:p-9">
              <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
              <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
              <div className="mt-8">{children}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
