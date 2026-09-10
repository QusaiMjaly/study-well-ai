import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Award,
  CalendarDays,
  Flame,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { DataError } from "@/components/dashboard/DataError";
import { friendlyMessage } from "@/lib/friendly-errors";
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
  subClass = "text-muted-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  subClass?: string;
}) {
  return (
    <Card className="gap-0 rounded-2xl border-border/60 p-4 shadow-soft">
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-8 tracking-tight">{value}</p>
      {sub ? <p className={`mt-1 text-[12px] font-medium ${subClass}`}>{sub}</p> : null}
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-0 rounded-3xl border-border/60 p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[18px] font-bold leading-6">{title}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

const axisProps = {
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  stroke: "var(--color-muted-foreground)",
} as const;

// הקומפוננטה מציגה את מסך ההתקדמות: גרפי משקל ואימונים, רצפים, הישגים וטופס מדידה חדשה
export function ProgressPanel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
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
    onError: (e) => toast.error(friendlyMessage(e)),
  });

  if (isLoading) {
    return (
      /* מצב טעינה של נתוני ההתקדמות */
      <div className="space-y-4">
        <Skeleton className="h-[132px] w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <DataError title="Couldn't load your progress" error={error} onRetry={() => refetch()} />
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

  const losing = w ? w.change <= 0 : true;

  return (
    <div className="space-y-4">
      {/* כותרת מסך המעקב אחר ההתקדמות */}
      <section className="bg-progress-gradient rounded-3xl px-6 pb-7 pt-6 text-white shadow-card">
        <h2 className="text-[28px] font-bold leading-9 tracking-tight">Your Progress</h2>
        <p className="mt-1 text-[14px] opacity-85">Track your fitness journey</p>
      </section>

      {/* כרטיסי סיכום של משקל, אימונים, רצף ושעות */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={
            losing ? (
              <TrendingDown className="h-[18px] w-[18px] text-success" />
            ) : (
              <TrendingUp className="h-[18px] w-[18px] text-success" />
            )
          }
          label={w && w.change > 0 ? "Weight gained" : "Weight lost"}
          value={w ? `${Math.abs(w.change).toFixed(1)} kg` : "—"}
          sub={
            w
              ? w.entries < 2
                ? `${w.latest} kg logged`
                : `${losing ? "↓" : "↑"} ${Math.abs(w.percent).toFixed(1)}% from start`
              : "No weight logged yet"
          }
          subClass={w && w.entries >= 2 ? "text-success" : "text-muted-foreground"}
        />
        <StatCard
          icon={<Award className="h-[18px] w-[18px] text-primary" />}
          label="Avg Workouts"
          value={`${avg ? avg.toFixed(1) : "0"}/wk`}
          sub={`${data.workouts.length} completed total`}
          subClass="text-primary"
        />
        <StatCard
          icon={<Target className="h-[18px] w-[18px] text-destructive" />}
          label="Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
          sub={streak ? "Keep it up! 🔥" : "No streak yet"}
          subClass={streak ? "text-destructive" : "text-muted-foreground"}
        />
        <StatCard
          icon={<CalendarDays className="h-[18px] w-[18px] text-ai" />}
          label="Total Hours"
          value={`${hours.toFixed(1)}h`}
          sub="Completed workouts"
          subClass="text-ai"
        />
      </div>

      {/* גרף השינוי במשקל לאורך זמן */}
      <ChartCard
        title="Weight Progress"
        subtitle={
          weightSeries.length > 1 ? `Last ${weightSeries.length} entries` : "Your logged weight"
        }
        right={
          w ? (
            <div className="text-right">
              <p className="text-[22px] font-bold leading-7 text-success">{w.latest} kg</p>
              <p className="text-[13px] text-muted-foreground">Current</p>
            </div>
          ) : null
        }
      >
        {weightSeries.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No weight data yet — add your first entry below.
          </p>
        ) : weightSeries.length === 1 ? (
          <div className="mt-8 text-center">
            <p className="text-3xl font-bold">{weightSeries[0]!.weight} kg</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Logged {weightSeries[0]!.date} — add another entry to see your trend.
            </p>
          </div>
        ) : (
          <div className="mt-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis {...axisProps} domain={["auto", "auto"]} />
                <Tooltip />
                <Line
                  type="linear"
                  dataKey="weight"
                  name="Weight (kg)"
                  stroke="var(--color-success)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--color-success)", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* גרף הקלוריות שנשרפו באימונים השבוע */}
      <ChartCard title="Calorie Balance" subtitle="This week">
        {data.workouts.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No completed workouts yet — finish a workout to see your calories.
          </p>
        ) : (
          <>
            <div className="mt-5 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="calories"
                    name="Burned"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="var(--color-primary)"
                    fillOpacity={0.55}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
              Burned
            </div>
          </>
        )}
      </ChartCard>

      {/* גרף משך האימונים בכל יום */}
      <ChartCard title="Workout Duration" subtitle="Minutes per day">
        {data.workouts.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            No completed workouts yet — finish a workout to see your analytics.
          </p>
        ) : (
          <div className="mt-5 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  name="Minutes"
                  stroke="var(--color-ai)"
                  strokeWidth={2}
                  fill="var(--color-ai)"
                  fillOpacity={0.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* מד העמידה בתוכנית הארוחות השבועית */}
      <Card className="gap-0 rounded-3xl border-border/60 p-5 shadow-soft">
        <h3 className="text-[18px] font-bold leading-6">Nutrition Adherence</h3>
        {!data.hasActivePlan || data.mealsPlannedPerWeek === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
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
            <Progress value={Math.min(100, adherence)} className="h-2.5" />
            <p className="text-[12px] font-medium text-success">{adherence}% adherence</p>
          </div>
        )}
      </Card>

      {/* הישגים שהמשתמש צבר לפי הפעילות שלו */}
      <Card className="bg-achievement-gradient gap-0 rounded-3xl border-warning/25 p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warning text-warning-foreground">
            <Award className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[18px] font-bold leading-6">Achievements</h3>
            <p className="text-[13px] text-muted-foreground">Keep crushing your goals!</p>
          </div>
        </div>
        {achievements.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted-foreground">
            No achievements yet — complete a workout or log your weight to earn your first.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl bg-background/80 p-3 text-center shadow-soft"
                title={a.description}
              >
                <Award className="mx-auto h-6 w-6 text-warning" />
                <p className="mt-2 text-[12px] font-medium leading-4">{a.title}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* טופס להזנת משקל, אחוז שומן ומסת שריר */}
      <Card className="gap-0 rounded-3xl border-border/60 p-5 shadow-soft">
        <h3 className="text-[18px] font-bold leading-6">Add a progress entry</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">Log today's body metrics</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Weight (kg)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={20}
              max={400}
              step="0.1"
              className="mt-1.5 rounded-xl"
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
              className="mt-1.5 rounded-xl"
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
              className="mt-1.5 rounded-xl"
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
        {/* שדה אופציונלי להערות על המדידה */}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-3 rounded-xl"
        />
        {/* כפתור לשמירת מדידת ההתקדמות */}
        <Button
          className="mt-4 h-12 w-full rounded-2xl bg-cta-gradient font-bold text-primary-foreground"
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
      </Card>

      <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-muted-foreground">
        <Flame className="h-3.5 w-3.5 text-destructive" />
        All numbers come from your real logs and completions
      </div>
    </div>
  );
}
