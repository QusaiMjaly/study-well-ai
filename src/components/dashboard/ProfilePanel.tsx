import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";


import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Apple,
  CalendarDays,
  ChevronRight,
  Clock,
  Dumbbell,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVITY_LEVELS,
  CHALLENGES,
  DURATIONS,
  GENDERS,
  GOALS,
  MEAL_PREFS,
  TIMES,
  WORKOUT_PREFS,
  labelOf,
  type Option,
} from "@/lib/profile-options";
import {
  fetchProfileBundle,
  initialsOf,
  isPlanStale,
  scheduleDays,
  totalClasses,
  type ProfileBundle,
  type ProfileEdits,
} from "@/lib/profile-data";
import { saveProfileDetails } from "@/lib/profile.functions";
import { usePlanRegeneration } from "@/lib/plan-regeneration";
import { normalizeDay } from "@/lib/day-utils";
import { DataError } from "@/components/dashboard/DataError";
import { friendlyMessage } from "@/lib/friendly-errors";
import { ChangePasswordSheet } from "@/components/dashboard/ChangePasswordSheet";



const DAY_LABELS: Record<string, string> = {
  sunday: "S",
  monday: "M",
  tuesday: "T",
  wednesday: "W",
  thursday: "T",
  friday: "F",
  saturday: "S",
};

function SectionCard({
  icon,
  iconClass,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-3xl border-border/60 p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}
        >
          {icon}
        </span>
        <h3 className="flex-1 text-[18px] font-bold leading-6">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[15px] font-semibold leading-5">{value || "Not set"}</p>
    </div>
  );
}

function PrefRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-[14px] text-muted-foreground">{label}</span>
      <span className="text-[15px] font-semibold">{value || "Not set"}</span>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={known ? value : undefined} onValueChange={onChange}>
        <SelectTrigger id={id} className="rounded-xl">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  const n = value.trim() === "" ? null : Number(value);
  const invalid = n !== null && (!Number.isFinite(n) || n < min || n > max);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        className="rounded-xl"
        aria-invalid={invalid}
        onChange={(ev) => onChange(ev.target.value.replace(/[^\d.]/g, ""))}
      />
      {invalid && (
        <p className="text-xs text-destructive">
          Enter a value between {min} and {max}.
        </p>
      )}
    </div>
  );
}

// הפונקציה ממלאת את טופס העריכה בערכים השמורים הנוכחיים של המשתמש
function emptyEdits(b: ProfileBundle): ProfileEdits {
  return {
    full_name: b.profile?.full_name ?? "",
    age: b.profile?.age != null ? String(b.profile.age) : "",
    gender: b.profile?.gender ?? "",
    height: b.profile?.height != null ? String(b.profile.height) : "",
    weight: b.profile?.weight != null ? String(b.profile.weight) : "",
    activity_level: b.profile?.activity_level ?? "",
    goal_type: b.goals?.goal_type ?? "",
    target_weight: b.goals?.target_weight != null ? String(b.goals.target_weight) : "",
    workout_preference: b.goals?.workout_preference ?? "",
    meal_preference: b.goals?.meal_preference ?? "",
    workout_duration: b.goals?.workout_duration ?? "",
    preferred_time: b.goals?.preferred_time ?? "",
    biggest_challenge: b.goals?.biggest_challenge ?? "",
  };
}

// הקומפוננטה מציגה את מסך הפרופיל: פרטים אישיים, הלו"ז, ההגדרות, שינוי סיסמה והתנתקות
export function ProfilePanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const saveDetails = useServerFn(saveProfileDetails);
  const { requestRegeneration, isGenerating, hasFailed } = usePlanRegeneration();
  const [editing, setEditing] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [form, setForm] = useState<ProfileEdits | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["profile-bundle"],
    queryFn: fetchProfileBundle,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!data || !form) return { changed: false };
      return (await saveDetails({ data: form })) as { changed: boolean };
    },
    onSuccess: async (result) => {
      setEditing(false);
      setForm(null);
      toast.success("Profile updated");
      await qc.invalidateQueries({ queryKey: ["profile-bundle"] });
      // Exactly one regeneration per Save, owned by the app-level controller
      // so navigating away can't cancel it or turn it into a failure.
      if (result?.changed) void requestRegeneration();
      else await qc.invalidateQueries({ queryKey: ["active-plan"] });
    },
    onError: (e) => toast.error(friendlyMessage(e)),
  });

  const retry = useMutation({ mutationFn: () => requestRegeneration() });
  /** Blocks a duplicate Save only; it never blocks navigation. */
  const busy = save.isPending || retry.isPending || isGenerating;




  const days = useMemo(() => scheduleDays(data?.schedule ?? null), [data]);
  const workoutDayKeys = useMemo(
    () => new Set((data?.workoutDayNames ?? []).map(normalizeDay)),
    [data],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[132px] rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (error) {
    return (
      <DataError
        title="Couldn't load your profile"
        error={error}
        onRetry={() => refetch()}
        className="rounded-3xl"
      />
    );
  }


  if (!data) return null;

  const name = data.profile?.full_name?.trim();
  const email = data.profile?.email ?? data.authEmail;
  const stale = isPlanStale(data, hasFailed);

  /** Seeds the whole form from stored values whenever edit mode opens. */
  // הפונקציה נכנסת למצב עריכה ומאתחלת את הטופס מהערכים השמורים
  function startEditing() {
    if (!data) return;
    setForm(emptyEdits(data));
    setEditing(true);
  }

  // הפונקציה יוצאת ממצב עריכה וזורקת את השינויים שלא נשמרו
  function cancelEditing() {
    setEditing(false);
    setForm(null);
  }

  // הפונקציה מנתקת את המשתמש ומחזירה אותו למסך ההתחברות
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const editPencil = (
    <button
      type="button"
      onClick={startEditing}
      disabled={editing}
      aria-label="Edit your details"
      className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      <Pencil className="h-[18px] w-[18px]" />
    </button>
  );

  const editActions = (
    <div className="mt-5 flex gap-3">
      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="h-11 flex-1 rounded-2xl bg-cta-gradient font-bold text-primary-foreground"
      >
        {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
      </Button>
      <Button
        variant="outline"
        className="h-11 rounded-2xl"
        onClick={cancelEditing}
        disabled={save.isPending}
      >
        Cancel
      </Button>
    </div>
  );




  return (
    <div className="space-y-4">
      {/* HEADER */}
      <section className="bg-profile-gradient rounded-3xl px-6 py-6 text-white shadow-card">
        <div className="flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white text-[22px] font-bold text-primary shadow-soft">
            {initialsOf(name ?? null, email)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[24px] font-bold leading-8">
              {name || "Add your name"}
            </h2>
            <p className="truncate text-[14px] opacity-85">{email || "No email on file"}</p>
          </div>
        </div>
        {!data.profile && (
          <p className="mt-4 rounded-2xl bg-white/15 p-3 text-[13px]">
            No profile details saved yet — complete onboarding or edit the sections below.
          </p>
        )}
      </section>

      {busy && (
        <Card className="flex flex-row items-center gap-3 rounded-2xl border-ai/30 bg-ai/5 p-4 shadow-soft">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ai" />
          <p className="text-sm font-medium">Updating your plan…</p>
        </Card>
      )}

      {!busy && hasFailed && (
        <Card className="flex flex-row items-start gap-3 rounded-2xl border-destructive/30 bg-destructive/5 p-4 shadow-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm">
              Your details were updated, but we couldn't refresh your plan yet. Your previous plan is
              still available.
            </p>
            <Button
              variant="outline"
              className="mt-3 h-9 rounded-xl"
              onClick={() => retry.mutate()}
              disabled={busy}
            >
              Retry plan generation
            </Button>
          </div>
        </Card>
      )}

      {!busy && !hasFailed && stale && (

        <Card className="flex flex-row items-start gap-3 rounded-2xl border-primary/30 bg-primary/5 p-4 shadow-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm">
              Your active plan was generated using previous information. Refresh it to apply these
              changes.
            </p>
            <Button
              variant="outline"
              className="mt-3 h-9 rounded-xl"
              onClick={() => retry.mutate()}
              disabled={busy}
            >
              Refresh my plan
            </Button>
          </div>
        </Card>
      )}


      {/* YOUR DETAILS — one card, one edit mode, one Save */}
      <SectionCard
        icon={<User className="h-5 w-5 text-primary-foreground" />}
        iconClass="bg-primary"
        title="Your Details"
        action={editPencil}
      >
        {editing && form ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  maxLength={100}
                  className="rounded-xl"
                  onChange={(ev) => setForm({ ...form, full_name: ev.target.value })}
                />
              </div>
              <NumberField
                id="age"
                label="Age"
                value={form.age}
                min={13}
                max={100}
                onChange={(v) => setForm({ ...form, age: v })}
              />
              <SelectField
                id="gender"
                label="Gender"
                value={form.gender}
                options={GENDERS}
                onChange={(v) => setForm({ ...form, gender: v })}
              />
              <NumberField
                id="height"
                label="Height (cm)"
                value={form.height}
                min={100}
                max={250}
                onChange={(v) => setForm({ ...form, height: v })}
              />
              <NumberField
                id="weight"
                label="Weight (kg)"
                value={form.weight}
                min={30}
                max={300}
                onChange={(v) => setForm({ ...form, weight: v })}
              />
              <SelectField
                id="activity_level"
                label="Activity level"
                value={form.activity_level}
                options={ACTIVITY_LEVELS}
                onChange={(v) => setForm({ ...form, activity_level: v })}
              />
              <SelectField
                id="goal_type"
                label="Goal"
                value={form.goal_type}
                options={GOALS}
                onChange={(v) => setForm({ ...form, goal_type: v })}
              />
              <NumberField
                id="target_weight"
                label="Target weight (kg)"
                value={form.target_weight}
                min={30}
                max={300}
                onChange={(v) => setForm({ ...form, target_weight: v })}
              />
              <SelectField
                id="workout_preference"
                label="Workout"
                value={form.workout_preference}
                options={WORKOUT_PREFS}
                onChange={(v) => setForm({ ...form, workout_preference: v })}
              />
              <SelectField
                id="meal_preference"
                label="Meal type"
                value={form.meal_preference}
                options={MEAL_PREFS}
                onChange={(v) => setForm({ ...form, meal_preference: v })}
              />
              <SelectField
                id="workout_duration"
                label="Duration"
                value={form.workout_duration}
                options={DURATIONS}
                onChange={(v) => setForm({ ...form, workout_duration: v })}
              />
              <SelectField
                id="preferred_time"
                label="Preferred time"
                value={form.preferred_time}
                options={TIMES}
                onChange={(v) => setForm({ ...form, preferred_time: v })}
              />
              <div className="sm:col-span-2">
                <SelectField
                  id="biggest_challenge"
                  label="Biggest challenge"
                  value={form.biggest_challenge}
                  options={CHALLENGES}
                  onChange={(v) => setForm({ ...form, biggest_challenge: v })}
                />
              </div>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Change everything you need, then save once — your plan refreshes a single time.
            </p>
            {editActions}
          </>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Age" value={data.profile?.age ? `${data.profile.age} years` : ""} />
              <Field
                label="Height"
                value={data.profile?.height ? `${data.profile.height} cm` : ""}
              />
              <Field
                label="Weight"
                value={data.profile?.weight ? `${data.profile.weight} kg` : ""}
              />
              <Field
                label="Target weight"
                value={data.goals?.target_weight ? `${data.goals.target_weight} kg` : ""}
              />
              <Field label="Goal" value={labelOf(GOALS, data.goals?.goal_type)} />
              <Field label="Gender" value={labelOf(GENDERS, data.profile?.gender)} />
              <Field
                label="Activity level"
                value={labelOf(ACTIVITY_LEVELS, data.profile?.activity_level)}
              />
            </div>

            {!data.goals ? (
              <p className="mt-3 text-[13px] text-muted-foreground">
                No preferences saved yet. Tap the pencil to add them.
              </p>
            ) : (
              <div className="mt-3 space-y-2.5">
                <PrefRow
                  icon={<Dumbbell className="h-[18px] w-[18px]" />}
                  label="Workout"
                  value={labelOf(WORKOUT_PREFS, data.goals.workout_preference)}
                />
                <PrefRow
                  icon={<Apple className="h-[18px] w-[18px]" />}
                  label="Meal type"
                  value={labelOf(MEAL_PREFS, data.goals.meal_preference)}
                />
                <PrefRow
                  icon={<CalendarDays className="h-[18px] w-[18px]" />}
                  label="Duration"
                  value={labelOf(DURATIONS, data.goals.workout_duration)}
                />
                <PrefRow
                  icon={<Clock className="h-[18px] w-[18px]" />}
                  label="Preferred time"
                  value={labelOf(TIMES, data.goals.preferred_time)}
                />
                <PrefRow
                  icon={<Sparkles className="h-[18px] w-[18px]" />}
                  label="Biggest challenge"
                  value={labelOf(CHALLENGES, data.goals.biggest_challenge)}
                />
              </div>
            )}
          </>
        )}
      </SectionCard>



      {/* YOUR SCHEDULE */}
      <Card className="gap-0 rounded-3xl border-primary/20 bg-gradient-to-br from-primary/[0.06] to-success/[0.08] p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cta-gradient text-primary-foreground">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold leading-6">Your Schedule</h3>
            <p className="text-[13px] text-muted-foreground">
              {data.schedule?.created_at
                ? `Last updated: ${new Date(data.schedule.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}`
                : "No weekly schedule yet"}
            </p>
          </div>
        </div>

        {!data.schedule ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            Add your weekly study, work and other blocks to personalise your plan.
          </p>
        ) : (
          <>
            <div className="mt-4 rounded-2xl bg-background/80 p-4">
              <div className="grid grid-cols-7 gap-1.5">
                {Object.keys(DAY_LABELS).map((d) => {
                  const hit = days.find((x) => x.day === d);
                  const hasWorkout = workoutDayKeys.has(normalizeDay(d));
                  const classCount = Math.min(hit?.count ?? 0, 3);
                  return (
                    <div key={d} className="flex flex-col items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                          hasWorkout
                            ? "bg-success text-success-foreground"
                            : "text-muted-foreground"
                        }`}
                        title={hasWorkout ? "Workout day" : undefined}
                      >
                        {DAY_LABELS[d]}
                      </span>
                      {Array.from({ length: classCount }).map((_, i) => (
                        <span
                          key={`c${i}`}
                          className="h-1.5 w-full rounded-full bg-primary/35"
                          aria-hidden
                        />
                      ))}
                      {classCount === 0 ? (
                        <span className="h-1.5 w-full rounded-full bg-muted" aria-hidden />
                      ) : null}
                      {hasWorkout ? (
                        <Dumbbell className="mt-0.5 h-3 w-3 text-success" aria-hidden />
                      ) : (
                        <span className="mt-0.5 h-3 w-3" aria-hidden />
                      )}
                      <span className="sr-only">
                        {classCount > 0 ? `${hit?.count} blocks` : "No blocks"}
                        {hasWorkout ? ", workout day" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-4 rounded-full bg-primary/35" aria-hidden />
                  Blocks ({totalClasses(data.schedule)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] font-bold text-success-foreground">
                    <Dumbbell className="h-2.5 w-2.5" aria-hidden />
                  </span>
                  Workout days ({workoutDayKeys.size})
                </span>
              </div>
              {!data.schedule.schedule_json && (
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Schedule saved but not processed yet.
                </p>
              )}
            </div>
          </>
        )}

        <Link to="/schedule-update" className="mt-4 block">
          <Button className="h-12 w-full rounded-2xl bg-cta-gradient font-bold text-primary-foreground">
            <CalendarDays className="mr-2 h-5 w-5" /> Update Schedule
          </Button>
        </Link>
      </Card>

      {/* AUTO-UPDATE */}
      <Card className="gap-0 rounded-3xl border-ai/20 bg-gradient-to-br from-ai/[0.08] to-primary/[0.06] p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ai" />
          <div>
            <h3 className="text-[16px] font-bold leading-5">Auto-Update</h3>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Your plan updates when you change your profile or schedule
            </p>
          </div>
        </div>
      </Card>

      {/* SETTINGS */}
      <SectionCard
        icon={<Settings className="h-5 w-5 text-background" />}
        iconClass="bg-foreground"
        title="Settings"
      >
        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 text-left transition-colors hover:bg-muted"
          >
            <KeyRound className="h-[18px] w-[18px]" />
            <span className="flex-1 text-[15px] font-medium">Change password</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3.5 text-muted-foreground">
            <Sparkles className="h-[18px] w-[18px]" />
            <span className="flex-1 text-[15px] font-medium">
              {data.activePlan ? `Active plan: ${data.activePlan.plan_name}` : "No active AI plan yet"}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ACTIONS */}


      <Button
        variant="outline"
        className="h-13 w-full rounded-2xl border-destructive/30 py-3.5 text-[16px] font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
        onClick={signOut}
      >
        <LogOut className="mr-2 h-5 w-5" /> Log out
      </Button>

      <ChangePasswordSheet open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </div>
  );
}
