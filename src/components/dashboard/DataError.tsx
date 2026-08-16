import { AlertCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { friendlyMessage } from "@/lib/friendly-errors";

type Props = {
  title: string;
  error: unknown;
  onRetry: () => void;
  className?: string;
};

/** Shared friendly error state with Retry — never shows raw Supabase text. */
export function DataError({ title, error, onRetry, className }: Props) {
  return (
    <Card
      className={`flex items-start gap-3 rounded-2xl border-destructive/30 p-5 shadow-soft ${className ?? ""}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {friendlyMessage(error, "Please check your connection and try again.")}
        </p>
        <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    </Card>
  );
}
