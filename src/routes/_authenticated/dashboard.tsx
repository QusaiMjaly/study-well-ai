import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generatePlans } from "@/lib/gemini.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Apple, Dumbbell, TrendingUp, User, Home } from "lucide-react";
import { toast } from "sonner";
import { HomeOverview } from "@/components/dashboard/HomeOverview";
import { MealsPanel } from "@/components/dashboard/MealsPanel";
import { WorkoutsPanel } from "@/components/dashboard/WorkoutsPanel";
import { ProgressPanel } from "@/components/dashboard/ProgressPanel";
import { ProfilePanel } from "@/components/dashboard/ProfilePanel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const navItems = [
  { value: "home", label: "Home", icon: Home },
  { value: "meals", label: "Meals", icon: Apple },
  { value: "workouts", label: "Workout", icon: Dumbbell },
  { value: "progress", label: "Progress", icon: TrendingUp },
  { value: "profile", label: "Profile", icon: User },
];

function Dashboard() {
  const generateFn = useServerFn(generatePlans);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [tab, setTab] = useState("home");

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const p = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    setProfile(p.data);
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

  return (
    <div className="flex min-h-screen justify-center bg-page-gradient">
      <div className="relative flex w-full max-w-[448px] flex-col bg-background shadow-card">
        {loading ? (
          <div className="flex h-[70vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !profile ? (
          <div className="px-6 py-20 text-center">
            <h2 className="text-2xl font-bold">Let's get you set up</h2>
            <p className="mt-2 text-muted-foreground">
              Complete onboarding to see your dashboard.
            </p>
            <Link to="/onboarding">
              <Button className="mt-6 h-12 w-full rounded-2xl bg-cta-gradient font-bold text-primary-foreground">
                Start onboarding
              </Button>
            </Link>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col gap-0">
            {/* Header */}
            <header className="relative bg-gradient-to-br from-primary/8 via-transparent to-success/8 px-6 pb-8 pt-6">
              <h1 className="text-[30px] font-bold leading-9 tracking-tight">
                Hi {profile.full_name?.split(" ")[0] || "there"} 👋
              </h1>
              <p className="text-base text-muted-foreground">Here's your plan for today</p>

              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating}
                aria-label="Regenerate plan with AI"
                className="absolute right-6 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-cta-gradient text-primary-foreground shadow-card transition-opacity hover:opacity-95 disabled:opacity-70"
              >
                {regenerating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </button>
            </header>

            {/* Content */}
            <div className="flex-1 px-6 pb-28">
              <TabsContent value="home" className="mt-0">
                <HomeOverview
                  onOpenWorkouts={() => setTab("workouts")}
                  onOpenMeals={() => setTab("meals")}
                />
              </TabsContent>
              <TabsContent value="meals" className="mt-0">
                <MealsPanel />
              </TabsContent>
              <TabsContent value="workouts" className="mt-0">
                <WorkoutsPanel />
              </TabsContent>
              <TabsContent value="progress" className="mt-0">
                <ProgressPanel />
              </TabsContent>
              <TabsContent value="profile" className="mt-0">
                <ProfilePanel />
              </TabsContent>
            </div>

            {/* Bottom navigation */}
            <div className="sticky bottom-0 z-20 border-t border-border/60 bg-background">
              <TabsList className="grid h-20 w-full grid-cols-5 items-center gap-0 rounded-none bg-transparent px-4 py-3">
                {navItems.map((item) => (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="flex h-14 flex-col items-center justify-center gap-1 rounded-[14px] px-2 text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs font-normal">{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
