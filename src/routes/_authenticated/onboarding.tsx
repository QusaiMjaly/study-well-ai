import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { parseSchedule, generatePlans } from "@/lib/gemini.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const parseFn = useServerFn(parseSchedule);
  const generateFn = useServerFn(generatePlans);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: profile
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");

  // Step 2: goals
  const [goalType, setGoalType] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [workoutDays, setWorkoutDays] = useState("3");

  // Step 3: schedule
  const [scheduleFile, setScheduleFile] = useState<File | null>(null);

  async function saveProfile() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: u.user.id,
        email: u.user.email,
        full_name: fullName,
        age: age ? parseInt(age) : null,
        gender,
        height: height ? parseInt(height) : null,
        weight: weight ? parseInt(weight) : null,
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

  async function saveGoals() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("goals").insert({
        user_id: u.user.id,
        goal_type: goalType,
        target_weight: targetWeight ? parseFloat(targetWeight) : null,
        workout_days: parseInt(workoutDays),
      });
      if (error) throw error;
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadAndGenerate() {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      let imageUrl: string | null = null;
      if (scheduleFile) {
        const path = `${u.user.id}/${Date.now()}-${scheduleFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("schedule-images")
          .upload(path, scheduleFile);
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("schedule-images")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        imageUrl = signed?.signedUrl ?? null;

        await supabase.from("schedules").insert({
          user_id: u.user.id,
          image_url: imageUrl,
          schedule_json: null,
        });

        if (imageUrl) {
          toast.info("Reading your schedule with AI...");
          try {
            await parseFn({ data: { imageUrl } });
          } catch (e) {
            console.error(e);
          }
        }
      }

      toast.info("Generating your personalized plans...");
      await generateFn({ data: {} });
      toast.success("Your plans are ready!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition-colors ${
              step >= s ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold">Tell us about yourself</h2>
          <p className="mt-1 text-sm text-muted-foreground">We'll personalize everything to you.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Activity level</Label>
              <Select value={activity} onValueChange={setActivity}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="light">Lightly active</SelectItem>
                  <SelectItem value="moderate">Moderately active</SelectItem>
                  <SelectItem value="very">Very active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveProfile} disabled={loading} className="mt-6 w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold">Your goals</h2>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select value={goalType} onValueChange={setGoalType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lose_weight">Lose weight</SelectItem>
                  <SelectItem value="gain_muscle">Gain muscle</SelectItem>
                  <SelectItem value="maintain">Maintain</SelectItem>
                  <SelectItem value="improve_energy">Improve energy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target weight (kg)</Label>
              <Input type="number" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Workout days per week</Label>
              <Input type="number" min="1" max="7" value={workoutDays} onChange={(e) => setWorkoutDays(e.target.value)} />
            </div>
          </div>
          <Button onClick={saveGoals} disabled={loading} className="mt-6 w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Continue
          </Button>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold">Upload your class schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Optional — we'll plan around your classes if you share it.
          </p>
          <label className="mt-6 flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 transition-colors hover:bg-muted/50">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {scheduleFile ? scheduleFile.name : "Click to upload an image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setScheduleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button onClick={uploadAndGenerate} disabled={loading} className="mt-6 w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Generating with AI..." : "Generate my plans"}
          </Button>
          <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })} className="mt-2 w-full">
            Skip for now
          </Button>
        </Card>
      )}
    </div>
  );
}
