import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveSchedule } from "@/lib/schedule.functions";
import { usePlanRegeneration } from "@/lib/plan-regeneration";
import { WeeklyScheduleEditor } from "@/components/schedule/WeeklyScheduleEditor";
import {
  overlappingBlockIds,
  scheduleToBlocks,
  type ScheduleBlock,
  type ScheduleJson,
} from "@/lib/schedule-schema";

import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/friendly-errors";

export const Route = createFileRoute("/_authenticated/schedule-update")({
  head: () => ({
    meta: [
      { title: "Update your timetable — StudentFitAI" },
      {
        name: "description",
        content:
          "Edit your weekly study and busy blocks so StudentFitAI plans workouts and meals around your real week.",
      },
      { property: "og:title", content: "Update your timetable — StudentFitAI" },
      {
        property: "og:description",
        content: "Edit your weekly schedule and refresh your plan in seconds.",
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
  const save = useServerFn(saveSchedule);
  const { requestRegeneration, isGenerating } = usePlanRegeneration();
  const [blocks, setBlocks] = useState<ScheduleBlock[] | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (navTimer.current) clearTimeout(navTimer.current); }, []);

  const { data: current, isLoading } = useQuery({
    queryKey: ["current-schedule"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("schedules")
        .select("schedule_json")
        .eq("user_id", u.user.id)
        .not("schedule_json", "is", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.schedule_json as unknown as ScheduleJson) ?? null;
    },
  });

  useEffect(() => {
    if (blocks === null && !isLoading) setBlocks(scheduleToBlocks(current ?? null));
  }, [current, isLoading, blocks]);

  async function submit() {
    const list = blocks ?? [];
    if (list.length === 0) return toast.error("Add at least one study or busy block.");
    if (overlappingBlockIds(list).size > 0)
      return toast.error("Two blocks overlap. Fix them before saving.");

    setLoading(true);
    try {
      await save({
        data: {
          blocks: list.map(({ day, start_time, end_time, type, label }) => ({
            day,
            start_time,
            end_time,
            type,
            label,
          })),
          imagePath,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile-bundle"] });
      await qc.invalidateQueries({ queryKey: ["current-schedule"] });
      toast.success("Schedule updated.");

      // New class/busy times change every workout and meal constraint.
      void requestRegeneration({ reason: "schedule" });

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
              Update your weekly schedule
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Edit your study and busy blocks — your profile, goals and preferences stay as they are.
            </p>
          </div>

          {blocks === null ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-border/60 bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <WeeklyScheduleEditor
              blocks={blocks}
              onChange={setBlocks}
              onImageImported={setImagePath}
            />
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4.5 w-4.5" />
              Schedule updated — returning to your dashboard…
            </div>
          )}

          <Button
            onClick={submit}
            disabled={loading || done || blocks === null}
            className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? "Updating your plan…" : loading ? "Saving…" : "Save schedule"}
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
