import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { saveSchedule } from "@/lib/schedule.functions";
import { WeeklyScheduleEditor } from "@/components/schedule/WeeklyScheduleEditor";
import {
  overlappingBlockIds,
  scheduleToBlocks,
  type ScheduleBlock,
  type ScheduleJson,
} from "@/lib/schedule-schema";
import { generateAiPlan } from "@/lib/plan.functions";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Sparkles,
  ChevronLeft,
  TrendingDown,
  Dumbbell,
  Heart,
  Activity,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { invalidatePlanCaches } from "@/lib/plan-cache";
import { friendlyAiMessage, friendlyMessage } from "@/lib/friendly-errors";

const searchSchema = z.object({ redo: z.coerce.boolean().optional() });

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Set up your plan — StudentFitAI" },
      {
        name: "description",
        content:
          "Tell StudentFitAI your goals, class schedule and preferences so your AI meal and workout plans fit your week.",
      },
      { property: "og:title", content: "Set up your plan — StudentFitAI" },
      {
        property: "og:description",
        content: "Three quick steps: your goal, your timetable, your preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const AI_STAGES = [
  "Analyzing your timetable",
  "Calculating nutrition",
  "Planning workouts",
  "Preparing meals",
  "Optimizing your week",
  "Saving your AI plan",
];

const GOALS = [

  { value: "lose_weight", label: "Lose Weight", icon: TrendingDown, tone: "primary" as const },
  { value: "gain_muscle", label: "Build Muscle", icon: Dumbbell, tone: "success" as const },
  { value: "maintain", label: "Stay Fit", icon: Activity, tone: "ai" as const },
  { value: "improve_energy", label: "Improve Health", icon: Heart, tone: "primary" as const },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", desc: "Little to no exercise" },
  { value: "light", label: "Lightly Active", desc: "Exercise 1-3 days/week" },
  { value: "moderate", label: "Moderately Active", desc: "Exercise 3-5 days/week" },
  { value: "very", label: "Very Active", desc: "Exercise 6-7 days/week" },
];

const WORKOUT_PREFS = [
  { value: "gym", label: "Gym" },
  { value: "home", label: "Home" },
  { value: "no_preference", label: "No Preference" },
];

const MEAL_PREFS = [
  { value: "balanced", label: "Balanced" },
  { value: "high_protein", label: "High Protein" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "low_carb", label: "Low Carb" },
];

const DURATIONS = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
  { value: "flexible", label: "Flexible" },
];

const TIMES = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "flexible", label: "Flexible" },
];

const CHALLENGES = [
  { value: "motivation", label: "Motivation" },
  { value: "time", label: "Not enough time" },
  { value: "consistency", label: "Staying consistent" },
  { value: "nutrition", label: "Eating well" },
];

const toneClass = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  ai: "bg-ai/10 text-ai",
};

function labelOf(list: { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? "—";
}

function ChoiceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60 bg-card text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const persistSchedule = useServerFn(saveSchedule);
  const generate = useServerFn(generateAiPlan);


  const { redo } = Route.useSearch();
  const [step, setStep] = useState(1);
  const [prefilling, setPrefilling] = useState(true);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiStage, setAiStage] = useState(0);
  const [aiDone, setAiDone] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);


  // Step 1
  const [goalType, setGoalType] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [activity, setActivity] = useState("");

  // Step 2 — manual weekly schedule is the source of truth.
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3
  const [workoutPref, setWorkoutPref] = useState("");
  const [mealPref, setMealPref] = useState("");
  const [duration, setDuration] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [challenge, setChallenge] = useState("");

  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  /**
   * Re-entry: existing users with an active plan go back to the dashboard,
   * otherwise their saved profile/goals/timetable prefill the form.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        const [p, g, sch, plan] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
          supabase
            .from("goals")
            .select("*")
            .eq("user_id", u.user.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("schedules")
            .select("schedule_json")
            .eq("user_id", u.user.id)
            .not("schedule_json", "is", null)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("ai_plans")
            .select("id")
            .eq("user_id", u.user.id)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;

        if (plan.data && !redo) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        const prof = p.data as any;
        if (prof) {
          setFullName(prof.full_name ?? "");
          setAge(prof.age != null ? String(prof.age) : "");
          setGender(prof.gender ?? "");
          setHeight(prof.height != null ? String(prof.height) : "");
          setWeight(prof.weight != null ? String(prof.weight) : "");
          setActivity(prof.activity_level ?? "");
        }
        const goals = g.data as any;
        if (goals) {
          setGoalType(goals.goal_type ?? "");
          setWorkoutPref(goals.workout_preference ?? "");
          setMealPref(goals.meal_preference ?? "");
          setDuration(goals.workout_duration ?? "");
          setPreferredTime(goals.preferred_time ?? "");
          setChallenge(goals.biggest_challenge ?? "");
        }
        setBlocks(scheduleToBlocks((sch.data?.schedule_json as unknown as ScheduleJson) ?? null));
      } catch {
        // Prefill is best-effort; the user can still fill the form manually.
      } finally {
        if (!cancelled) setPrefilling(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [redo]);

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  function validateStep1() {
    if (!goalType) return "Pick your main goal";
    if (!fullName.trim()) return "Enter your full name";
    const ageNum = Number(age);
    if (!age || !Number.isFinite(ageNum) || ageNum < 13 || ageNum > 100)
      return "Age must be between 13 and 100.";
    const heightNum = Number(height);
    if (!height || !Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250)
      return "Height must be between 100 and 250 cm.";
    const weightNum = Number(weight);
    if (!weight || !Number.isFinite(weightNum) || weightNum < 30 || weightNum > 300)
      return "Weight must be between 30 and 300 kg.";
    if (!gender) return "Select your gender";
    if (!activity) return "Select your activity level";
    return null;
  }

  async function saveStep1() {
    const err = validateStep1();
    if (err) return toast.error(err);
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: u.user.id,
        email: u.user.email,
        full_name: fullName.trim(),
        age: parseInt(age),
        gender,
        height: parseInt(height),
        weight: parseInt(weight),
        activity_level: activity,
      });
      if (error) throw error;
      setStep(2);
    } catch (e) {
      toast.error(friendlyMessage(e, "We couldn't save your details. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function saveStep2() {
    if (blocks.length === 0) {
      const message = "Add at least one study or busy block — the AI builds your week around it.";
      setStep2Error(message);
      toast.error(message);
      return;
    }
    if (overlappingBlockIds(blocks).size > 0) {
      const message = "Two blocks overlap. Fix the overlaps before continuing.";
      setStep2Error(message);
      toast.error(message);
      return;
    }
    setStep2Error(null);
    setLoading(true);
    try {
      await persistSchedule({
        data: {
          blocks: blocks.map(({ day, start_time, end_time, type, label }) => ({
            day,
            start_time,
            end_time,
            type,
            label,
          })),
          imagePath,
        },
      });
      setStep(3);
    } catch (e) {
      const message = friendlyMessage(e, "We couldn't save your schedule. Please try again.");
      setStep2Error(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function validateStep3() {
    if (!workoutPref) return "Choose a workout preference";
    if (!mealPref) return "Choose a meal preference";
    if (!duration) return "Choose a workout duration";
    if (!preferredTime) return "Choose a preferred workout time";
    if (!challenge) return "Choose your biggest challenge";
    return null;
  }

  async function runAnalysis() {
    setAiError(null);
    setAiStage(0);
    setAnalyzing(true);
    let ticker: ReturnType<typeof setInterval> | undefined;
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("You are signed out. Please sign in again.");

      // Milestone 1: the weekly schedule was saved in step 2.
      setAiStage(1);

      // Plan generation: advance through the intermediate stages while the AI works.
      ticker = setInterval(() => setAiStage((s) => (s < 4 ? s + 1 : s)), 4000);
      await generate(undefined as never);
      clearInterval(ticker);

      // Real milestone 2: the plan was validated and stored transactionally.
      setAiStage(5);
      setAiDone(true);

      // The new plan invalidates every cached read derived from the active plan.
      await invalidatePlanCaches(qc);

      toast.success("Your personalised AI plan is ready.");
      navTimer.current = setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    } catch (e) {
      if (ticker) clearInterval(ticker);
      setAiError(friendlyAiMessage(e));
    }
  }


  async function generatePlan() {
    const err1 = validateStep1();
    if (err1) {
      setStep(1);
      return toast.error(err1);
    }
    const err = validateStep3();
    if (err) return toast.error(err);

    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const { error: pErr } = await supabase.from("profiles").upsert({
        id: u.user.id,
        email: u.user.email,
        full_name: fullName.trim(),
        age: parseInt(age),
        gender,
        height: parseInt(height),
        weight: parseInt(weight),
        activity_level: activity,
      });
      if (pErr) throw pErr;

      // One current goals row per user: update the existing row instead of
      // appending a new one on every generation (no history is deleted).
      const goalPayload = {
        user_id: u.user.id,
        goal_type: goalType,
        workout_days: duration === "flexible" ? 4 : null,
        workout_preference: workoutPref,
        meal_preference: mealPref,
        workout_duration: duration,
        preferred_time: preferredTime,
        biggest_challenge: challenge,
      };

      const { data: existingGoal, error: gSelErr } = await supabase
        .from("goals")
        .select("id")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (gSelErr) throw gSelErr;

      const gErr = existingGoal?.id
        ? (
            await supabase
              .from("goals")
              .update(goalPayload as never)
              .eq("id", existingGoal.id)
              .eq("user_id", u.user.id)
          ).error
        : (await supabase.from("goals").insert(goalPayload as never)).error;
      if (gErr) throw gErr;

      setLoading(false);
      await runAnalysis();
      return;
    } catch (e) {
      toast.error(friendlyMessage(e, "We couldn't save your details. Please try again."));
    } finally {
      setLoading(false);
    }
  }


  if (prefilling) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-gradient">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-gradient">
      <div className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/dashboard" }))}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-muted-foreground shadow-soft"
            aria-label="Back"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <span className="text-sm font-medium text-muted-foreground">Step {step} of 3</span>
          <span className="text-sm font-semibold text-primary">{progress}%</span>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-cta-gradient transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {step === 1 && (
          <div className="mt-7 space-y-6">
            <div>
              <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight">
                What's your main goal?
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                We'll tailor your plan around it.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => {
                const active = goalType === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGoalType(g.value)}
                    className={`rounded-2xl border p-4 text-left shadow-soft transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border/60 bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[g.tone]}`}
                    >
                      <g.icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold">{g.label}</span>
                  </button>
                );
              })}
            </div>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Personal Information</h2>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    className="h-12 rounded-xl"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input
                      className="h-12 rounded-xl"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Height (cm)</Label>
                    <Input
                      className="h-12 rounded-xl"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="175"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      className="h-12 rounded-xl"
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="70"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Activity Level</h2>
              <div className="mt-4 space-y-3">
                {ACTIVITY_LEVELS.map((a) => {
                  const active = activity === a.value;
                  return (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => setActivity(a.value)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/60 bg-card hover:bg-muted/40"
                      }`}
                    >
                      <span>
                        <span className="block text-sm font-semibold">{a.label}</span>
                        <span className="block text-xs text-muted-foreground">{a.desc}</span>
                      </span>
                      {active && <Check className="h-4.5 w-4.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <Button
              onClick={saveStep1}
              disabled={loading}
              className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-7 space-y-6">
            <div>
              <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight">
                Your academic schedule
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Add your classes and other commitments — we'll plan around them.
              </p>
            </div>

            <WeeklyScheduleEditor
              blocks={blocks}
              onChange={setBlocks}
              onImageImported={setImagePath}
            />

            {step2Error && (
              <p
                role="alert"
                className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
              >
                {step2Error}
              </p>
            )}

            <section className="rounded-2xl border border-ai/20 bg-ai/5 p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai/10 text-ai">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ai">AI Scheduling</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Our AI finds the gaps between your blocks, so workouts and meals land at times
                    you're actually free.
                  </p>
                </div>
              </div>
            </section>


            <Button
              onClick={saveStep2}
              disabled={loading}
              className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Next
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-7 space-y-6">
            <div>
              <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight">
                Goals &amp; Preferences
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Last step — this shapes your daily plan.
              </p>
            </div>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Workout Preference</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {WORKOUT_PREFS.map((o) => (
                  <ChoiceChip
                    key={o.value}
                    active={workoutPref === o.value}
                    onClick={() => setWorkoutPref(o.value)}
                  >
                    {o.label}
                  </ChoiceChip>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Meal Preference</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {MEAL_PREFS.map((o) => (
                  <ChoiceChip
                    key={o.value}
                    active={mealPref === o.value}
                    onClick={() => setMealPref(o.value)}
                  >
                    {o.label}
                  </ChoiceChip>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Workout Duration</h2>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {DURATIONS.map((o) => (
                  <ChoiceChip
                    key={o.value}
                    active={duration === o.value}
                    onClick={() => setDuration(o.value)}
                  >
                    {o.label}
                  </ChoiceChip>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Preferred Workout Time</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {TIMES.map((o) => (
                  <ChoiceChip
                    key={o.value}
                    active={preferredTime === o.value}
                    onClick={() => setPreferredTime(o.value)}
                  >
                    {o.label}
                  </ChoiceChip>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Biggest Challenge</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {CHALLENGES.map((o) => (
                  <ChoiceChip
                    key={o.value}
                    active={challenge === o.value}
                    onClick={() => setChallenge(o.value)}
                  >
                    {o.label}
                  </ChoiceChip>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Your Summary</h2>
              <dl className="mt-4 space-y-2.5 text-sm">
                {[
                  ["Goal", labelOf(GOALS, goalType)],
                  ["Name", fullName || "—"],
                  ["Age", age || "—"],
                  ["Height", height ? `${height} cm` : "—"],
                  ["Weight", weight ? `${weight} kg` : "—"],
                  ["Activity", labelOf(ACTIVITY_LEVELS, activity)],
                  [
                    "Schedule",
                    blocks.length
                      ? `${blocks.length} weekly block${blocks.length === 1 ? "" : "s"}`
                      : "Not provided",
                  ],
                  ["Workouts", labelOf(WORKOUT_PREFS, workoutPref)],
                  ["Meals", labelOf(MEAL_PREFS, mealPref)],
                  ["Duration", labelOf(DURATIONS, duration)],
                  ["Time", labelOf(TIMES, preferredTime)],
                  ["Challenge", labelOf(CHALLENGES, challenge)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <Button
              onClick={generatePlan}
              disabled={loading}
              className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4.5 w-4.5" />
              Generate My Plan
            </Button>
          </div>
        )}
      </div>

      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-3xl border border-border/60 bg-card p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cta-gradient text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold">
                  {aiError ? "We hit a snag" : aiDone ? "All set!" : "Building your AI plan"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {aiError
                    ? "Your upload and details are safe."
                    : aiDone
                      ? "Taking you to your dashboard…"
                      : "This usually takes a few seconds."}
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              {AI_STAGES.map((label, i) => {
                const done = aiDone || i < aiStage;
                const active = !aiError && !aiDone && i === aiStage;
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                        done
                          ? "border-transparent bg-success text-primary-foreground"
                          : active
                            ? "border-primary text-primary"
                            : "border-border/60 text-muted-foreground"
                      }`}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="text-[11px]">{i + 1}</span>
                      )}
                    </span>
                    <span className={done || active ? "font-medium" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ul>

            {aiError && (
              <div className="mt-5 space-y-3">
                <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {aiError}
                </p>
                <Button
                  onClick={runAnalysis}
                  className="h-12 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground"
                >
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setAnalyzing(false)}
                  className="h-11 w-full rounded-2xl text-sm"
                >
                  Back to my details
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

