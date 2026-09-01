import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { friendlyAuthMessage, validatePassword } from "@/lib/friendly-errors";

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
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // The recovery session may only exist after Supabase finishes the code
  // exchange, so listen for auth events as well as reading the session once.
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
      if (data.session) {
        setHasSession(true);
        setReady(true);
      }
    });
    // Give the PKCE exchange a moment before declaring the link invalid.
    const timer = window.setTimeout(() => {
      if (active) setReady(true);
    }, 3000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(password, "signup");
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError(friendlyAuthMessage("passwords do not match"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Never carry the recovery session into the authenticated app.
      await supabase.auth.signOut();
      setDone(true);
    } catch (err) {
      setError(friendlyAuthMessage(err));
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
          {done ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Password updated successfully</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You can now log in with your new password.
              </p>
              <Button
                asChild
                className="mt-6 h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
              >
                <Link to="/auth" search={{ mode: "signin" }}>
                  Continue to log in
                </Link>
              </Button>
            </div>
          ) : (
            <>
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
                    {friendlyAuthMessage("reset link expired")}
                  </p>
                  <Button
                    asChild
                    className="h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
                  >
                    <Link to="/forgot-password" search={{}}>
                      Request a new link
                    </Link>
                  </Button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm font-medium">
                      New password
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={show ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-12 rounded-xl bg-background pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShow((s) => !s)}
                        aria-label={show ? "Hide password" : "Show password"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm font-medium">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirm-password"
                      type={show ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="h-12 rounded-xl bg-background"
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
                    >
                      {error}
                    </p>
                  )}

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
            </>
          )}
        </div>

        {!done && (
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
        )}
      </div>
    </div>
  );
}
