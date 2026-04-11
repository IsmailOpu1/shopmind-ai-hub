import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const EmptyState = ({ icon: Icon, title, description }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <Icon className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  </div>
);

export default EmptyState;
