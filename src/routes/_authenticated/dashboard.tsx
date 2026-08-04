import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePlans } from "@/lib/gemini.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Apple, Dumbbell, LineChart, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type DayPlan = Record<string, unknown> & { day?: string };

function Dashboard() {
  const generateFn = useServerFn(generatePlans);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [mealPlan, setMealPlan] = useState<{ days: DayPlan[] } | null>(null);
  const [workoutPlan, setWorkoutPlan] = useState<{ days: DayPlan[] } | null>(null);
  const [progress, setProgress] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, m, w, pr] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle(),
      supabase.from("meal_plans").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workout_plans").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("progress").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }),
    ]);
    setProfile(p.data);
    setMealPlan(m.data?.plan as any);
    setWorkoutPlan(w.data?.plan as any);
    setProgress(pr.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function regenerate() {
    setRegenerating(true);
    try {
      await generateFn({ data: {} });
      toast.success("New plans generated!");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto max-w-md py-20 text-center">
        <h2 className="text-2xl font-bold">Let's get you set up</h2>
        <p className="mt-2 text-muted-foreground">Complete onboarding to see your dashboard.</p>
        <Link to="/onboarding">
          <Button className="mt-6">Start onboarding</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hi {profile.full_name?.split(" ")[0] || "there"} 👋</h1>
          <p className="text-sm text-muted-foreground">Here's your personalized week.</p>
        </div>
        <Button onClick={regenerate} disabled={regenerating} variant="outline">
          {regenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Regenerate with AI
        </Button>
      </div>

      <HomeOverview />

      <Tabs defaultValue="meals">

        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="meals"><Apple className="mr-2 h-4 w-4" />Meals</TabsTrigger>
          <TabsTrigger value="workouts"><Dumbbell className="mr-2 h-4 w-4" />Workouts</TabsTrigger>
          <TabsTrigger value="progress"><LineChart className="mr-2 h-4 w-4" />Progress</TabsTrigger>
          <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" />Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="meals" className="mt-6">
          {!mealPlan?.days?.length ? (
            <EmptyState onGenerate={regenerate} loading={regenerating} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mealPlan.days.map((d, i) => (
                <Card key={i} className="p-5">
                  <h3 className="font-semibold text-primary">{d.day as string}</h3>
                  <div className="mt-3 space-y-2 text-sm">
                    {(["breakfast", "lunch", "dinner", "snacks"] as const).map((k) => (
                      d[k] ? <div key={k}><span className="font-medium capitalize">{k}: </span><span className="text-muted-foreground">{d[k] as string}</span></div> : null
                    ))}
                    {d.calories ? <div className="pt-2 text-xs text-muted-foreground">~{d.calories as number} kcal</div> : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="workouts" className="mt-6">
          {!workoutPlan?.days?.length ? (
            <EmptyState onGenerate={regenerate} loading={regenerating} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workoutPlan.days.map((d, i) => (
                <Card key={i} className="p-5">
                  <h3 className="font-semibold text-primary">{d.day as string}</h3>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {d.focus as string} {d.duration_minutes ? `· ${d.duration_minutes as number} min` : ""}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {(d.exercises as any[])?.map((ex, j) => (
                      <li key={j}>• {ex.name} <span className="text-muted-foreground">{ex.sets}×{ex.reps}</span></li>
                    ))}
                  </ul>
                  {d.notes ? <p className="mt-3 text-xs text-muted-foreground">{d.notes as string}</p> : null}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="mt-6">
          <ProgressTab progress={progress} onAdded={load} />
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold">Your profile</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {[
                ["Name", profile.full_name],
                ["Email", profile.email],
                ["Age", profile.age],
                ["Gender", profile.gender],
                ["Height", profile.height ? `${profile.height} cm` : null],
                ["Weight", profile.weight ? `${profile.weight} kg` : null],
                ["Activity", profile.activity_level],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{(v as string) || "—"}</dd>
                </div>
              ))}
            </dl>
            <Link to="/onboarding">
              <Button variant="outline" className="mt-6">Update profile</Button>
            </Link>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ onGenerate, loading }: { onGenerate: () => void; loading: boolean }) {
  return (
    <Card className="p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h3 className="mt-3 font-semibold">No plan yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Generate your AI-powered plan to get started.</p>
      <Button onClick={onGenerate} disabled={loading} className="mt-4">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate
      </Button>
    </Card>
  );
}

function ProgressTab({ progress, onAdded }: { progress: any[]; onAdded: () => void }) {
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("progress").insert({
        user_id: u.user.id,
        current_weight: weight ? parseFloat(weight) : null,
        notes: notes || null,
      });
      if (error) throw error;
      setWeight("");
      setNotes("");
      toast.success("Progress logged");
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const max = Math.max(...progress.map((p) => Number(p.current_weight) || 0), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h3 className="font-semibold">Log progress</h3>
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label>Current weight (kg)</Label>
            <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How are you feeling?" />
          </div>
          <Button onClick={add} disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save entry
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold">History</h3>
        {progress.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <>
            <div className="mt-4 flex h-32 items-end gap-1">
              {[...progress].reverse().map((p, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-primary/80 transition-all"
                  style={{ height: `${((Number(p.current_weight) || 0) / max) * 100}%` }}
                  title={`${p.current_weight} kg`}
                />
              ))}
            </div>
            <ul className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
              {progress.map((p) => (
                <li key={p.id} className="flex justify-between border-b pb-2 last:border-0">
                  <div>
                    <div className="font-medium">{p.current_weight} kg</div>
                    {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
