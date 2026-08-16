import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Award, Flame, Loader2, Scale, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  addProgressLog,
  validateProgressEntry,
  avgWorkoutsPerWeek,
  currentStreak,
  earnedAchievements,
  fetchProgressData,
  totalWorkoutHours,
  weeklySeries,
  weightStats,
} from "@/lib/progress-data";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

export function ProgressPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["progress-logs"],
    queryFn: () => fetchProgressData(),
    staleTime: 60_000,
  });

  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{
    weight?: string;
    body_fat?: string;
    muscle_mass?: string;
  }>({});

  const add = useMutation({
    mutationFn: () =>
      addProgressLog({
        weight: Number(weight),
        body_fat: bodyFat ? Number(bodyFat) : null,
        muscle_mass: muscle ? Number(muscle) : null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      setWeight("");
      setBodyFat("");
      setMuscle("");
      setNotes("");
      setErrors({});
      toast.success("Progress logged");
      qc.invalidateQueries({ queryKey: ["progress-logs"] });
      qc.invalidateQueries({ queryKey: ["active-plan"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="flex items-start gap-3 rounded-2xl border-destructive/30 p-5">
        <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
        <div>
          <h3 className="font-semibold">Couldn't load your progress</h3>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const w = weightStats(data.logs);
  const streak = currentStreak(data.workouts);
  const avg = avgWorkoutsPerWeek(data.workouts);
  const hours = totalWorkoutHours(data.workouts);
  const series = weeklySeries(data.workouts);
  const achievements = earnedAchievements(data);
  const adherence = data.mealsPlannedPerWeek
    ? Math.round((data.mealsCompletedThisWeek / data.mealsPlannedPerWeek) * 100)
    : 0;

  const weightSeries = data.logs
    .filter((l) => l.weight != null)
    .map((l) => ({
      date: new Date(l.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      weight: Number(l.weight),
    }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Your Progress</h2>
        <p className="text-sm text-muted-foreground">Real numbers from your logs and completions</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Scale className="h-3.5 w-3.5" />}
          label="Weight change"
          value={w ? `${w.latest} kg` : "—"}
          sub={
            w
              ? w.entries < 2
                ? "First entry logged"
                : `${w.change > 0 ? "+" : ""}${w.change.toFixed(1)} kg (${w.percent > 0 ? "+" : ""}${w.percent.toFixed(1)}%)`
              : "No weight logged yet"
          }
        />
        <StatCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Avg workouts / week"
          value={avg ? avg.toFixed(1) : "0"}
          sub={`${data.workouts.length} completed total`}
        />
        <StatCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Current streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          sub={streak ? "Keep it going" : "No streak yet"}
        />
        <StatCard
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Total workout hours"
          value={`${hours.toFixed(1)} h`}
          sub="Completed workouts only"
        />
      </div>

      <Card className="rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Weight progress</h3>
          {w && w.entries >= 2 ? (
            <Badge variant="secondary" className="gap-1">
              {w.change <= 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <TrendingUp className="h-3 w-3" />
              )}
              {w.change > 0 ? "+" : ""}
              {w.change.toFixed(1)} kg
            </Badge>
          ) : null}
        </div>
        {weightSeries.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No weight data yet — add your first entry below.
          </p>
        ) : weightSeries.length === 1 ? (
          <div className="mt-6 text-center">
            <p className="text-3xl font-semibold">{weightSeries[0]!.weight} kg</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Logged {weightSeries[0]!.date} — add another entry to see your trend.
            </p>
          </div>
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weightSeries} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  fill="url(#wg)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-5 space-y-3 border-t pt-5">
          <h4 className="text-sm font-semibold">Add a progress entry</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Weight (kg)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={20}
                max={400}
                step="0.1"
                aria-invalid={!!errors.weight}
                value={weight}
                onChange={(e) => {
                  setWeight(e.target.value);
                  setErrors((p) => ({ ...p, weight: undefined }));
                }}
                placeholder="70"
              />
              {errors.weight ? (
                <p className="mt-1 text-[11px] text-destructive">{errors.weight}</p>
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Body fat %</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={75}
                step="0.1"
                aria-invalid={!!errors.body_fat}
                value={bodyFat}
                onChange={(e) => {
                  setBodyFat(e.target.value);
                  setErrors((p) => ({ ...p, body_fat: undefined }));
                }}
                placeholder="optional"
              />
              {errors.body_fat ? (
                <p className="mt-1 text-[11px] text-destructive">{errors.body_fat}</p>
              ) : null}
            </div>
            <div>
              <Label className="text-xs">Muscle (kg)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={200}
                step="0.1"
                aria-invalid={!!errors.muscle_mass}
                value={muscle}
                onChange={(e) => {
                  setMuscle(e.target.value);
                  setErrors((p) => ({ ...p, muscle_mass: undefined }));
                }}
                placeholder="optional"
              />
              {errors.muscle_mass ? (
                <p className="mt-1 text-[11px] text-destructive">{errors.muscle_mass}</p>
              ) : null}
            </div>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
          />
          <Button
            className="w-full"
            disabled={add.isPending}
            onClick={() => {
              const next = validateProgressEntry({
                weight,
                body_fat: bodyFat,
                muscle_mass: muscle,
              });
              setErrors(next);
              const first = Object.values(next)[0];
              if (first) {
                toast.error(first);
                return;
              }
              add.mutate();
            }}
          >
            {add.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save entry
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold">Workout analytics</h3>
        <p className="text-xs text-muted-foreground">Last 7 days</p>
        {data.workouts.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No completed workouts yet — finish a workout to see your analytics.
          </p>
        ) : (
          <>
            <div className="mt-4 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="workouts" name="Workouts" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="minutes" name="Minutes" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="calories"
                    name="Calories burned"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>

      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold">Nutrition adherence</h3>
        {!data.hasActivePlan || data.mealsPlannedPerWeek === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No active meal plan — adherence will appear once a plan exists.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Completed meals this week</span>
              <span className="font-semibold">
                {data.mealsCompletedThisWeek} / {data.mealsPlannedPerWeek}
              </span>
            </div>
            <Progress value={Math.min(100, adherence)} />
            <p className="text-xs text-muted-foreground">{adherence}% adherence</p>
          </div>
        )}
      </Card>

      <Card className="rounded-2xl p-5">
        <h3 className="font-semibold">Achievements</h3>
        {achievements.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No achievements yet — complete a workout or log your weight to earn your first.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {achievements.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <span className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Award className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
