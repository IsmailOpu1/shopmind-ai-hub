import { useState } from "react";
import { Info, Mail } from "lucide-react";
import { INSTALL_GUIDES, type BuilderId, developerEmail } from "@/lib/install";

/** "Which website builder do you use?" with the steps for the one picked. */
export default function InstallGuide({ snippet }: { snippet: string }) {
  const [picked, setPicked] = useState<BuilderId>("shopify");
  const guide = INSTALL_GUIDES.find((g) => g.id === picked) ?? INSTALL_GUIDES[0];

  return (
    <div className="space-y-3">
      <p id="builder-label" className="text-sm font-medium">Which website builder do you use?</p>
      <div role="group" aria-labelledby="builder-label" className="flex flex-wrap gap-2">
        {INSTALL_GUIDES.map((g) => {
          const active = g.id === picked;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPicked(g.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-blue-400/60 bg-blue-500/20 text-blue-200"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      <ol className="space-y-2" aria-label={`Steps for ${guide.name}`}>
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-slate-300">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/80 to-violet-600/80 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      {guide.note && (
        <p className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 text-xs text-amber-200/90">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          {guide.note}
        </p>
      )}

      {guide.id === "other" && (
        <a
          href={developerEmail(snippet)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.08]"
        >
          <Mail className="h-3.5 w-3.5" /> Email the code to my developer
        </a>
      )}
    </div>
  );
}
