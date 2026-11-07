import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, Loader2, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { nextStep, progress, type OnboardingStep } from "@/lib/onboarding";

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onIndexNow: () => void;
  indexing: boolean;
}

const OnboardingChecklist = ({ steps, onIndexNow, indexing }: OnboardingChecklistProps) => {
  const next = nextStep(steps);
  const percent = progress(steps);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Card className="mb-10 border-blue-500/30 bg-blue-500/5" aria-label="Setup checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Rocket className="h-5 w-5 text-blue-400" />
            Get your assistant live
          </CardTitle>
          <span className="text-sm text-gray-400">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <Progress value={percent} className="h-2" aria-label={`Setup ${percent}% complete`} />
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step) => {
            const isNext = step.id === next?.id;
            return (
              <li
                key={step.id}
                className={`flex items-start gap-3 rounded-lg p-3 ${isNext ? "bg-white/5 ring-1 ring-blue-500/40" : ""}`}
                aria-current={isNext ? "step" : undefined}
              >
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" aria-label="Done" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-label="Not done" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-medium ${step.done ? "text-gray-400 line-through" : "text-white"}`}>
                    {step.title}
                  </p>
                  {!step.done && <p className="text-sm text-gray-400">{step.description}</p>}
                  {isNext && step.id === "upload" && (
                    <a
                      href="/sample-catalog.csv"
                      download
                      className="mt-1 inline-block text-sm text-blue-400 underline-offset-2 hover:underline"
                    >
                      Download sample catalog (CSV)
                    </a>
                  )}
                </div>
                {isNext && step.id === "index" && (
                  <Button size="sm" onClick={onIndexNow} disabled={indexing}>
                    {indexing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {indexing ? "Indexing..." : "Index now"}
                  </Button>
                )}
                {isNext && step.href && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to={step.href}>
                      Go <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};

export default OnboardingChecklist;
