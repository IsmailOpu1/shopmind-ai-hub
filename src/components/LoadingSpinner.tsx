import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
  fullPage?: boolean;
}

const LoadingSpinner = ({ message = "Loading...", fullPage = false }: LoadingSpinnerProps) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );

  if (fullPage) {
    return <div className="flex min-h-screen items-center justify-center">{content}</div>;
  }

  return content;
};

export default LoadingSpinner;
