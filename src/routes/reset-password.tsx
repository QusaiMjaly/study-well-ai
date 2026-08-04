import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your password — StudentFitAI" },
      {
        name: "description",
        content:
          "Choose a new password for your StudentFitAI account and get back to your AI meal and workout plans.",
      },
      { property: "og:title", content: "Reset your password — StudentFitAI" },
      {
        property: "og:description",
        content: "Set a new password for your StudentFitAI account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated! Please log in with your new password.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", search: { mode: "signin" } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page-gradient px-5 py-8">
      <div className="mx-auto w-full max-w-[420px]">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta-gradient text-primary-foreground shadow-soft">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-bold tracking-tight">StudentFitAI</span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
          <h1 className="text-center text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="mt-1.5 text-center text-sm text-muted-foreground">
            Choose a new password for your account
          </p>

          {!ready ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSession ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">
                This reset link is invalid or has expired. Request a new one from the login screen.
              </p>
              <Button
                asChild
                className="h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
              >
                <Link to="/auth" search={{ mode: "signin" }}>
                  Back to log in
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">
                  New password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">
                  Confirm new password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-12 rounded-xl bg-background"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="font-semibold text-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
