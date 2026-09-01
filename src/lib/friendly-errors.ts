/**
 * Maps raw Supabase / PostgREST / network errors onto short, user-facing copy.
 * Raw technical text is never surfaced to the UI.
 */

function raw(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as { message?: string; error_description?: string };
  return e.error_description || e.message || "";
}

const GENERIC = "Something went wrong. Please try again.";

/** Friendly copy for data reads/writes (dashboard panels, saves). */
export function friendlyMessage(err: unknown, fallback = GENERIC): string {
  const m = raw(err).toLowerCase();
  if (!m) return fallback;
  if (m.includes("not signed in") || m.includes("jwt") || m.includes("401"))
    return "Your session expired. Please sign in again.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (m.includes("permission") || m.includes("row-level security") || m.includes("policy"))
    return "You don't have access to this data.";
  if (m.includes("timeout") || m.includes("timed out"))
    return "That took too long. Please try again.";
  if (m.includes("rate limit") || m.includes("429"))
    return "Too many requests right now. Please wait a moment and try again.";
  // Anything that looks like a validation message we wrote ourselves is safe to show.
  if (/^[A-Z][^{}]{0,120}[.!?]$/.test(raw(err))) return raw(err);
  return fallback;
}

/** Friendly copy for Supabase Auth failures. Never surfaces raw provider text. */
export function friendlyAuthMessage(err: unknown): string {
  const m = raw(err).toLowerCase();
  if (!m) return GENERIC;
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "That email or password is incorrect.";
  if (m.includes("email not confirmed"))
    return "Please confirm your email address first — check your inbox.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try logging in instead.";
  if (m.includes("passwords do not match") || m.includes("password mismatch"))
    return "Those passwords don't match.";
  if (m.includes("same password") || m.includes("should be different"))
    return "Please choose a password different from your current one.";
  if (m.includes("password should be") || m.includes("weak password") || m.includes("too short"))
    return "Please choose a stronger password (at least 8 characters, with a letter and a number).";
  if (m.includes("current password") || m.includes("reauthentication"))
    return "Your current password is incorrect.";
  if (m.includes("oauth cancelled") || m.includes("access_denied"))
    return "Google sign-in was cancelled. You can try again.";
  if (m.includes("oauth") || m.includes("provider"))
    return "We couldn't complete Google sign-in. Please try again.";
  if (
    m.includes("reset link") ||
    m.includes("otp_expired") ||
    m.includes("token has expired") ||
    m.includes("invalid token") ||
    m.includes("expired")
  )
    return "This reset link is invalid or has expired. Request a new one from the login screen.";
  if (m.includes("auth session missing") || m.includes("session_not_found") || m.includes("recovery session"))
    return "Your reset session isn't available anymore. Request a new reset link.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("429"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "We couldn't reach the server. Check your connection and try again.";
  if (m.includes("invalid email")) return "Please enter a valid email address.";
  return GENERIC;
}


/** Friendly copy for the AI onboarding pipeline. */
export function friendlyAiMessage(err: unknown): string {
  const m = raw(err).toLowerCase();
  if (m.includes("no schedule") || m.includes("no timetable") || m.includes("schedule image"))
    return "We couldn't find your timetable image. Please upload it again.";
  if (m.includes("rate limit") || m.includes("429"))
    return "Our AI is busy right now. Please retry in a moment.";
  if (m.includes("network") || m.includes("failed to fetch"))
    return "We couldn't reach the AI service. Check your connection and retry.";
  return "We couldn't build your plan just now. Your details are saved — please retry.";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Please enter your email address.";
  if (!EMAIL_RE.test(email.trim())) return "Please enter a valid email address.";
  return null;
}

export function validatePassword(password: string, mode: "signin" | "signup"): string | null {
  if (!password) return "Please enter your password.";
  if (mode === "signup") {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))
      return "Password must include at least one letter and one number.";
  } else if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}
