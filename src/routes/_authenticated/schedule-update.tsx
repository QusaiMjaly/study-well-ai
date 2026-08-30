import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeTimetable } from "@/lib/schedule.functions";
import { generateAiPlan } from "@/lib/plan.functions";
import { invalidatePlanCaches } from "@/lib/plan-cache";

import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, ChevronLeft, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/schedule-update")({
  head: () => ({
    meta: [
      { title: "Update your timetable — StudentFitAI" },
      {
        name: "description",
        content:
          "Upload a new class timetable image and let StudentFitAI re-read your week without redoing onboarding.",
      },
      { property: "og:title", content: "Update your timetable — StudentFitAI" },
      {
        property: "og:description",
        content: "Replace your timetable image and refresh your schedule in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScheduleUpdate,
});

function ScheduleUpdate() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeTimetable);
  const generate = useServerFn(generateAiPlan);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [done, setDone] = useState(false);

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  function pick(f: File | null) {
    if (!f) return setFile(null);
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB.");
    setFile(f);
  }

  async function submit() {
    if (!file) return toast.error("Choose a timetable image first.");
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("You are signed out. Please sign in again.");

      const path = `${u.user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("schedule-images").upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("schedules").insert({
        user_id: u.user.id,
        image_url: path,
        schedule_json: null,
      });
      if (insErr) throw insErr;

      await analyze(undefined as never);
      await qc.invalidateQueries({ queryKey: ["profile-bundle"] });
      toast.success("Schedule updated.");

      // New class times change every workout/meal constraint, so refresh the plan.
      setRegenerating(true);
      try {
        await generate(undefined as never);
        await invalidatePlanCaches(qc);
        toast.success("Your plan was updated for the new schedule.");
      } catch (e) {
        toast.error(
          friendlyMessage(
            e,
            "Your schedule was saved, but we couldn't refresh your plan yet. You can retry from Profile.",
          ),
        );
      } finally {
        setRegenerating(false);
      }

      setDone(true);
      navTimer.current = setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    } catch (e) {
      toast.error(friendlyMessage(e, "We couldn't update your schedule. Please retry."));
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-page-gradient">
      <div className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-soft"
            aria-label="Back"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <span className="text-xs font-medium text-muted-foreground">Update schedule</span>
          <span className="h-9 w-9" />
        </div>

        <div className="mt-7 space-y-6">
          <div>
            <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight">
              Update your class schedule
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Upload a new timetable image — your profile, goals and preferences stay as they are.
            </p>
          </div>

          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
            <h2 className="text-base font-semibold">Upload Schedule</h2>

            <label className="mt-4 flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center transition-colors hover:bg-primary/10">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold">
                {file ? file.name : "Upload timetable image"}
              </span>
              <span className="px-6 text-xs text-muted-foreground">
                PNG or JPG of your class timetable
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="button"
              onClick={() => toast.info("Calendar sync is coming soon.")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-muted/50"
            >
              <CalendarDays className="h-4.5 w-4.5 text-muted-foreground" />
              Connect Calendar
            </button>
          </section>

          <section className="rounded-2xl border border-ai/20 bg-ai/5 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai/10 text-ai">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ai">AI Scheduling</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Our AI reads your timetable and finds the gaps between lectures, so your workouts
                  and meals land at times you're actually free.
                </p>
              </div>
            </div>
          </section>

          {done && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4.5 w-4.5" />
              Schedule updated — returning to your profile…
            </div>
          )}

          <Button
            onClick={submit}
            disabled={loading || done}
            className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {regenerating
              ? "Updating your plan…"
              : loading
                ? "Analysing your timetable…"
                : "Analyze & Update Schedule"}

          </Button>

          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            disabled={loading}
            className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
