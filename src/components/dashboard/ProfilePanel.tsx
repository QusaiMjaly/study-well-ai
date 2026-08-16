import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CalendarDays,
  Image as ImageIcon,
  Info,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Sparkles,
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
  saveProfileEdits,
  scheduleDays,
  totalClasses,
  validateEdits,
  type ProfileBundle,
  type ProfileEdits,
} from "@/lib/profile-data";
import { normalizeDay } from "@/lib/day-utils";

const DAY_LABELS: Record<string, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};


function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value || "Not set"}</p>
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
        <SelectTrigger id={id}>
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

export function ProfilePanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileEdits | null>(null);
  const [editedAt, setEditedAt] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["profile-bundle"],
    queryFn: fetchProfileBundle,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!data || !form) return;
      const message = validateEdits(form);
      if (message) throw new Error(message);
      await saveProfileEdits(data, form);
    },
    onSuccess: async () => {
      setEditedAt(Date.now());
      setEditing(false);
      toast.success("Profile updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile-bundle"] }),
        qc.invalidateQueries({ queryKey: ["active-plan"] }),
      ]);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const days = useMemo(() => scheduleDays(data?.schedule ?? null), [data]);
  const workoutDayKeys = useMemo(
    () => new Set((data?.workoutDayNames ?? []).map(normalizeDay)),
    [data],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load your profile. {(error as Error).message}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => qc.invalidateQueries({ queryKey: ["profile-bundle"] })}
        >
          Try again
        </Button>
      </Card>
    );
  }

  if (!data) return null;

  const name = data.profile?.full_name?.trim();
  const email = data.profile?.email ?? data.authEmail;
  const stale = isPlanStale(data, editedAt);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {initialsOf(name ?? null, email)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{name || "Add your name"}</h2>
            <p className="truncate text-sm text-muted-foreground">{email || "No email on file"}</p>
            {data.goals?.goal_type ? (
              <Badge variant="secondary" className="mt-2 capitalize">
                {data.goals.goal_type.replace(/_/g, " ")}
              </Badge>
            ) : null}
          </div>
        </div>
        {!data.profile && (
          <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            No profile details saved yet — complete onboarding or use Edit details below.
          </p>
        )}
      </Card>

      {stale && (
        <Card className="flex items-start gap-3 rounded-2xl border-primary/30 bg-primary/5 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm">
            Your active plan was generated using previous profile information. Generate a new plan to
            apply these changes.
          </p>
        </Card>
      )}

      {/* Edit mode */}
      {editing && form ? (
        <Card className="rounded-2xl p-5">
          <h3 className="font-semibold">Edit details</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                maxLength={100}
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
              label="Current weight (kg)"
              value={form.weight}
              min={30}
              max={300}
              onChange={(v) => setForm({ ...form, weight: v })}
            />
            <div className="sm:col-span-2">
              <SelectField
                id="activity_level"
                label="Activity level"
                value={form.activity_level}
                options={ACTIVITY_LEVELS}
                onChange={(v) => setForm({ ...form, activity_level: v })}
              />
            </div>
            <SelectField
              id="goal_type"
              label="Main goal"
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
              label="Workout preference"
              value={form.workout_preference}
              options={WORKOUT_PREFS}
              onChange={(v) => setForm({ ...form, workout_preference: v })}
            />
            <SelectField
              id="meal_preference"
              label="Meal preference"
              value={form.meal_preference}
              options={MEAL_PREFS}
              onChange={(v) => setForm({ ...form, meal_preference: v })}
            />
            <SelectField
              id="workout_duration"
              label="Preferred duration"
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
          <div className="mt-5 flex gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Personal information */}
          <Card className="rounded-2xl p-5">
            <h3 className="font-semibold">Personal information</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Age" value={data.profile?.age ?? ""} />
              <Field label="Gender" value={labelOf(GENDERS, data.profile?.gender)} />
              <Field label="Height" value={data.profile?.height ? `${data.profile.height} cm` : ""} />
              <Field
                label="Current weight"
                value={data.profile?.weight ? `${data.profile.weight} kg` : ""}
              />
              <Field label="Main goal" value={labelOf(GOALS, data.goals?.goal_type)} />
              <Field
                label="Activity level"
                value={labelOf(ACTIVITY_LEVELS, data.profile?.activity_level)}
              />
            </div>
          </Card>

          {/* Preferences */}
          <Card className="rounded-2xl p-5">
            <h3 className="font-semibold">Preferences</h3>
            {!data.goals ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No preferences saved yet. Add them with Edit details.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field
                  label="Workout preference"
                  value={labelOf(WORKOUT_PREFS, data.goals.workout_preference)}
                />
                <Field label="Meal preference" value={labelOf(MEAL_PREFS, data.goals.meal_preference)} />
                <Field
                  label="Preferred duration"
                  value={labelOf(DURATIONS, data.goals.workout_duration)}
                />
                <Field label="Preferred time" value={labelOf(TIMES, data.goals.preferred_time)} />
                <div className="col-span-2">
                  <Field
                    label="Biggest challenge"
                    value={labelOf(CHALLENGES, data.goals.biggest_challenge)}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Edit entry point, kept close to the data it changes */}
          <Button
            variant="outline"
            className="w-full rounded-2xl"
            onClick={() => {
              setForm(emptyEdits(data));
              setEditing(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" /> Edit details
          </Button>
        </>
      )}


      {/* Schedule */}
      <Card className="rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Weekly schedule</h3>
          <Link to="/schedule-update">
            <Button variant="outline" size="sm">
              <CalendarDays className="mr-2 h-4 w-4" />
              Update schedule
            </Button>
          </Link>
        </div>

        {!data.schedule ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No timetable uploaded yet. Upload one to personalise your plan.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                <ImageIcon className="mr-1 h-3 w-3" />
                {data.schedule.image_url ? "Timetable image saved" : "No image"}
              </Badge>
              <span>
                Last updated{" "}
                {data.schedule.created_at
                  ? new Date(data.schedule.created_at).toLocaleDateString()
                  : "—"}
              </span>
              <span>· {totalClasses(data.schedule)} classes</span>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Object.keys(DAY_LABELS).map((d) => {
                const hit = days.find((x) => x.day === d);
                const hasWorkout = workoutDayKeys.has(normalizeDay(d));
                return (
                  <div
                    key={d}
                    className={`rounded-xl p-2 text-center text-xs ${
                      hit ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{DAY_LABELS[d]}</div>
                    <div className="mt-0.5">{hit ? hit.count : "—"}</div>
                    <div
                      className={`mx-auto mt-1 h-1.5 w-1.5 rounded-full ${
                        hasWorkout ? "bg-success" : "bg-transparent"
                      }`}
                      aria-hidden
                    />
                  </div>
                );
              })}
            </div>
            {!data.schedule.schedule_json && (
              <p className="mt-3 text-xs text-muted-foreground">
                Timetable uploaded but not analysed yet.
              </p>
            )}
          </>
        )}
      </Card>

      {/* Settings */}
      <Card className="divide-y rounded-2xl">
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium">Auto-update plan</p>
            <p className="text-xs text-muted-foreground">
              Automatically refresh your plan when details change
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Coming soon</Badge>
            <Switch disabled aria-label="Auto-update plan (coming soon)" />
          </div>
        </div>




        <Link
          to="/reset-password"
          className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Change password
          </span>
        </Link>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {data.activePlan
              ? `Active plan: ${data.activePlan.plan_name}`
              : "No active AI plan yet"}
          </div>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
