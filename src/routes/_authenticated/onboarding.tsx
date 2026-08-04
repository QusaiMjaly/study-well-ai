import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  Upload,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  TrendingDown,
  Dumbbell,
  Heart,
  Activity,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
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

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [goalType, setGoalType] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [activity, setActivity] = useState("");

  // Step 2
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);

  // Step 3
  const [workoutPref, setWorkoutPref] = useState("");
  const [mealPref, setMealPref] = useState("");
  const [duration, setDuration] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [challenge, setChallenge] = useState("");

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;

  function validateStep1() {
    if (!goalType) return "Pick your main goal";
    if (!fullName.trim()) return "Enter your full name";
    if (!age || Number(age) <= 0) return "Enter a valid age";
    if (!height || Number(height) <= 0) return "Enter your height in cm";
    if (!weight || Number(weight) <= 0) return "Enter your weight in kg";
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
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveStep2() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      if (scheduleFile) {
        const path = `${u.user.id}/${Date.now()}-${scheduleFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("schedule-images")
          .upload(path, scheduleFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("schedule-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        const imageUrl = signed?.signedUrl ?? null;

        const { error: insErr } = await supabase.from("schedules").insert({
          user_id: u.user.id,
          image_url: imageUrl,
          schedule_json: null,
        });
        if (insErr) throw insErr;
      }
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
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

      const { error: gErr } = await supabase.from("goals").insert({
        user_id: u.user.id,
        goal_type: goalType,
        workout_days: duration === "flexible" ? 4 : null,
        workout_preference: workoutPref,
        meal_preference: mealPref,
        workout_duration: duration,
        preferred_time: preferredTime,
        biggest_challenge: challenge,
      } as never);
      if (gErr) throw gErr;

      toast.success("Your details are saved — your plan is ready to be generated.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
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
                We'll plan workouts and meals around your classes.
              </p>
            </div>

            <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-base font-semibold">Upload Schedule</h2>

              <label className="mt-4 flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-center transition-colors hover:bg-primary/10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold">
                  {scheduleFile ? scheduleFile.name : "Upload timetable image"}
                </span>
                <span className="px-6 text-xs text-muted-foreground">
                  PNG or JPG of your class timetable
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setScheduleFile(e.target.files?.[0] ?? null)}
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
                    Our AI reads your timetable and finds the gaps between lectures, so your
                    workouts and meals land at times you're actually free.
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
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </button>
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
                  ["Schedule", scheduleFile ? "Timetable uploaded" : "Not provided"],
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
    </div>
  );
}
