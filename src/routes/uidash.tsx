import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Apple,
  Dumbbell,
  TrendingUp,
  User,
  Home,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/uidash")({ component: P });

const navItems = [
  { value: "home", label: "Home", icon: Home },
  { value: "meals", label: "Meals", icon: Apple },
  { value: "workouts", label: "Workout", icon: Dumbbell },
  { value: "progress", label: "Progress", icon: TrendingUp },
  { value: "profile", label: "Profile", icon: User },
];

function P() {
  const [tab, setTab] = useState("home");
  return (
    <div className="flex min-h-screen justify-center bg-page-gradient">
      <div className="relative flex w-full max-w-[448px] flex-col bg-background shadow-card">
        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col gap-0">
          <header className="relative bg-gradient-to-br from-primary/8 via-transparent to-success/8 px-6 pb-8 pt-6">
            <h1 className="text-[30px] font-bold leading-9 tracking-tight">Hi Alex 👋</h1>
            <p className="mt-1 text-base text-muted-foreground">Here's your plan for today</p>
            <button
              type="button"
              className="absolute right-6 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-cta-gradient text-primary-foreground shadow-card"
            >
              <Sparkles className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 px-6 pb-28">
            <TabsContent value="home" className="mt-0">
              <div className="space-y-4">
                <section className="rounded-[24px] bg-gradient-to-br from-primary/10 to-primary/[0.03] p-6 shadow-soft">
                  <div className="flex min-h-[56px] items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-cta-gradient text-primary-foreground shadow-soft">
                        <Dumbbell className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary">Next Workout</p>
                        <p className="text-2xl font-bold leading-8 tracking-tight">14:30</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                      Monday
                    </span>
                  </div>
                  <div className="mt-5 flex min-h-[48px] items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">Quick 30-min session</p>
                      <p className="text-sm text-muted-foreground">30 min · 250 kcal</p>
                    </div>
                    <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </section>

                <section className="rounded-[24px] bg-gradient-to-br from-success/10 to-success/[0.03] p-6 shadow-soft">
                  <div className="flex min-h-[56px] items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-success text-success-foreground shadow-soft">
                        <Apple className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-success">Next Meal</p>
                        <p className="text-2xl font-bold leading-8 tracking-tight">16:00</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold capitalize text-success">
                      snack
                    </span>
                  </div>
                  <div className="mt-5 flex min-h-[48px] items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">High-protein snack</p>
                      <p className="text-sm text-muted-foreground">420 cal · 30g protein</p>
                    </div>
                    <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-success text-success-foreground">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </section>

                <section className="rounded-[24px] bg-card p-6 shadow-card">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-ai text-ai-foreground">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">Today's Summary</h3>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    {[
                      ["1", "Workout"],
                      ["3", "Meals"],
                      ["2,100", "Calories"],
                    ].map(([v, l]) => (
                      <div key={l}>
                        <p className="text-2xl font-bold leading-8 tracking-tight">{v}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[24px] bg-gradient-to-br from-ai/10 to-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-ai" />
                    <div className="min-w-0">
                      <p className="text-base font-semibold">AI Tip</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">
                        You have a 90-min break tomorrow at 2 PM. Perfect for a full workout
                        session!
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </TabsContent>
          </div>

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
      </div>
    </div>
  );
}
