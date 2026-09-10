import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, MailCheck } from "lucide-react";
import { friendlyAuthMessage, validateEmail } from "@/lib/friendly-errors";

const searchSchema = z.object({ email: z.string().optional() });

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Forgot your password — StudentFitAI" },
      {
        name: "description",
        content:
          "Request a password reset link for your StudentFitAI account and get back to your AI meal and workout plans.",
      },
      { property: "og:title", content: "Forgot your password — StudentFitAI" },
      {
        property: "og:description",
        content: "We'll email you a secure link to set a new password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

// הקומפוננטה מציגה את מסך "שכחתי סיסמה": שליחת קישור איפוס למייל והודעת הצלחה
function ForgotPasswordPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // הפונקציה שולחת למשתמש קישור איפוס סיסמה במייל אחרי בדיקת תקינות הכתובת
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setFieldError(friendlyAuthMessage(err));
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
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If that address is eligible, we've sent a password reset link. Open it on this
                device to set a new password.
              </p>
              <Button
                asChild
                className="mt-6 h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
              >
                <Link to="/auth" search={{ mode: "signin" }}>
                  Back to log in
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-center text-2xl font-bold tracking-tight">
                Forgot your password?
              </h1>
              <p className="mt-1.5 text-center text-sm text-muted-foreground">
                Enter your email and we'll send you a link to set a new password.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl bg-background"
                  />
                </div>

                {fieldError && (
                  <p
                    role="alert"
                    className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
                  >
                    {fieldError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="font-semibold text-primary hover:underline"
            >
              Back to log in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
