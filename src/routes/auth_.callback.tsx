import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { friendlyAuthMessage } from "@/lib/friendly-errors";

/**
 * Public OAuth landing route. Supabase completes the PKCE/code exchange
 * asynchronously after redirecting here, so we must NOT gate on getUser()
 * before that finishes — we wait for either an existing session or an
 * auth-state event, then route to a fixed internal destination.
 */
export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — StudentFitAI" },
      {
        name: "description",
        content: "Completing your secure sign-in to StudentFitAI.",
      },
      { property: "og:title", content: "Signing you in — StudentFitAI" },
      { property: "og:description", content: "Completing your secure sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallback,
});

/** Authoritative onboarding check: a profile row is what the dashboard requires. */
// הפונקציה בודקת אם המשתמש סיים אונבורדינג לפי קיום שורת פרופיל (המקור המוסמך)
async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

// הפונקציה מחלצת שגיאת OAuth מהכתובת אם הספק החזיר את המשתמש עם כשל
function providerErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const err = search.get("error") || hash.get("error");
  const code = search.get("error_code") || hash.get("error_code");
  if (!err && !code) return null;
  if ((err || "").includes("access_denied")) return "oauth cancelled";
  return "oauth failed";
}

// הקומפוננטה משלימה את התחברות Google: מחכה לסשן ומנווטת לדשבורד או לאונבורדינג
function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let active = true;

    const providerError = providerErrorFromUrl();
    if (providerError) {
      setError(friendlyAuthMessage(providerError));
      return;
    }

    // הפונקציה מסיימת את ההתחברות ומנווטת פעם אחת ליעד הנכון
    async function finish(userId: string) {
      if (done.current) return;
      done.current = true;
      const completed = await hasCompletedOnboarding(userId);
      if (!active) return;
      navigate({ to: completed ? "/dashboard" : "/onboarding", replace: true });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      void finish(session.user.id);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session?.user) void finish(data.session.user.id);
    });

    // Safety net: if no session ever arrives, show a friendly error
    // instead of spinning forever or bouncing in a redirect loop.
    const timer = window.setTimeout(() => {
      if (!active || done.current) return;
      setError(friendlyAuthMessage("oauth failed"));
    }, 12000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page-gradient px-5 py-8">
      <div className="w-full max-w-[420px] rounded-2xl border border-border/60 bg-card p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cta-gradient text-primary-foreground shadow-soft">
          <Sparkles className="h-5 w-5" />
        </div>
        {error ? (
          <>
            {/* מצב כשל בהשלמת ההתחברות החיצונית */}
            <h1 className="text-xl font-bold tracking-tight">We couldn't sign you in</h1>
            <p role="alert" className="mt-2 text-sm text-muted-foreground">
              {error}
            </p>
            <Button
              asChild
              className="mt-6 h-12 w-full rounded-xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-soft hover:opacity-95"
            >
              <Link to="/auth" search={{ mode: "signin" }}>
                Back to log in
              </Link>
            </Button>
          </>
        ) : (
          <>
            {/* מצב טעינה בזמן השלמת ההתחברות והפניית המשתמש */}
            <h1 className="text-xl font-bold tracking-tight">Signing you in…</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Just a moment while we finish setting up your session.
            </p>
            <Loader2 className="mx-auto mt-6 h-5 w-5 animate-spin text-muted-foreground" />
          </>
        )}
      </div>
    </div>
  );
}
