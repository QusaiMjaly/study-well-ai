import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthMessage, validatePassword } from "@/lib/friendly-errors";

type Identity = { provider: string };

// הקומפוננטה מציגה חלון שינוי סיסמה; למשתמשי Google בלבד מוצע לשלוח קישור מאובטח למייל
export function ChangePasswordSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loadingUser, setLoadingUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"updated" | "sent" | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingUser(true);
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setDone(null);
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const user = data.user;
      const identities = (user?.identities ?? []) as Identity[];
      setEmail(user?.email ?? null);
      setHasPassword(identities.some((i) => i.provider === "email"));
      setLoadingUser(false);
    });
    return () => {
      active = false;
    };
  }, [open]);

  // הפונקציה מעדכנת את הסיסמה אחרי בדיקת הסיסמה הנוכחית מול השרת
  async function onUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!current) {
      setError("Please enter your current password.");
      return;
    }
    const pwError = validatePassword(next, "signup");
    if (pwError) {
      setError(pwError);
      return;
    }
    if (next !== confirm) {
      setError(friendlyAuthMessage("passwords do not match"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // The installed SDK accepts `current_password` on updateUser; passing it
      // keeps the existing session intact and lets Supabase do the
      // reauthentication server-side (no risky re-sign-in dance).
      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
        current_password: current,
      });
      if (updateError) throw updateError;
      setDone("updated");
    } catch (err) {
      setError(friendlyAuthMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // הפונקציה שולחת למשתמשי Google קישור אימייל מאובטח להגדרת סיסמה ראשונה
  async function onSetPassword() {
    if (!email) {
      setError(friendlyAuthMessage(""));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (resetError) throw resetError;
      setDone("sent");
    } catch (err) {
      setError(friendlyAuthMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>{hasPassword ? "Change password" : "Set a password"}</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-8">
          {loadingUser ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : done === "updated" ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-[16px] font-bold">Password updated successfully</p>
              <Button
                className="mt-6 h-12 w-full rounded-xl bg-cta-gradient font-semibold text-primary-foreground"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          ) : done === "sent" ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailCheck className="h-5 w-5" />
              </div>
              <p className="text-[16px] font-bold">Check your email</p>
              <p className="mt-2 text-sm text-muted-foreground">
                We've sent a link to set your password. Open it to finish.
              </p>
              <Button
                className="mt-6 h-12 w-full rounded-xl bg-cta-gradient font-semibold text-primary-foreground"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          ) : !hasPassword ? (
            <div className="py-4">
              <p className="text-[15px] text-muted-foreground">
                You currently sign in with Google. You can add a password to your account — we'll
                email you a secure link to set it.
              </p>
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
                >
                  {error}
                </p>
              )}
              <Button
                disabled={busy}
                onClick={onSetPassword}
                className="mt-6 h-12 w-full rounded-xl bg-cta-gradient font-semibold text-primary-foreground"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set a password
              </Button>
            </div>
          ) : (
            <form onSubmit={onUpdate} className="mt-2 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cp-current" className="text-sm font-medium">
                  Current password
                </Label>
                <Input
                  id="cp-current"
                  type={show ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-xl bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cp-new" className="text-sm font-medium">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="cp-new"
                    type={show ? "text" : "password"}
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="••••••••"
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
                <Label htmlFor="cp-confirm" className="text-sm font-medium">
                  Confirm new password
                </Label>
                <Input
                  id="cp-confirm"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
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
                disabled={busy}
                className="h-12 w-full rounded-xl bg-cta-gradient font-semibold text-primary-foreground"
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
