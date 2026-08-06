import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dumbbell, Apple, Sparkles, Users, Upload, Wand2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudentFitAI — Smart Fitness & Nutrition for Students" },
      {
        name: "description",
        content:
          "AI-powered workout and meal plans built around your class schedule. Made for busy university students.",
      },
      { property: "og:title", content: "StudentFitAI — Smart Fitness & Nutrition for Students" },
      {
        property: "og:description",
        content: "AI-powered plans built around your schedule, made for busy students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Dumbbell,
    title: "Personalized workouts",
    body: "Sessions matched to your goals, gym access, and free time between lectures.",
    tone: "primary" as const,
  },
  {
    icon: Apple,
    title: "Meal plans that fit your day",
    body: "Student-budget nutrition planned around lectures, labs, and late nights.",
    tone: "success" as const,
  },
  {
    icon: Sparkles,
    title: "Designed for busy students",
    body: "AI reads your timetable and rebuilds your week when plans change.",
    tone: "ai" as const,
  },
];

const steps = [
  { icon: Upload, title: "Upload your timetable", body: "Snap a photo of your class schedule." },
  { icon: Wand2, title: "AI builds your plan", body: "Meals and workouts fitted to your gaps." },
  { icon: TrendingUp, title: "Track your progress", body: "Log weight, mood, and momentum." },
];

const toneClass = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  ai: "bg-ai/10 text-ai",
};

function Landing() {
  return (
    <div className="min-h-screen bg-page-gradient">
      <div className="mx-auto w-full max-w-[420px] px-5 pb-16 pt-8">
        <header className="flex items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta-gradient text-primary-foreground shadow-soft">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <span className="text-base font-bold tracking-tight">StudentFitAI</span>
          </div>
        </header>


        <section className="pt-10 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full bg-ai/10 px-3 py-1.5 text-xs font-medium text-ai">
            <Sparkles className="h-3.5 w-3.5" /> Powered by AI
          </div>
          <h1 className="text-balance text-[2rem] font-bold leading-[1.15] tracking-tight">
            Smart Fitness &amp; Nutrition for Students
          </h1>
          <p className="mx-auto mt-4 max-w-[19rem] text-[0.95rem] leading-relaxed text-muted-foreground">
            AI-powered plans built around your schedule
          </p>

          <div className="mt-7 space-y-3">
            <Link to="/auth" search={{ mode: "signup" }} className="block">
              <Button
                size="lg"
                className="h-13 w-full rounded-2xl bg-cta-gradient text-base font-semibold text-primary-foreground shadow-card transition-transform hover:opacity-95 active:scale-[0.99]"
              >
                Get Started
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth" className="font-semibold text-primary hover:underline">
                Log in
              </Link>
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4 text-success" />
            Join 10,000+ students getting fit
          </div>
        </section>

        <section className="mt-10 space-y-4">
          {features.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
            >
              <div
                className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${toneClass[f.tone]}`}
              >
                <f.icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-center text-xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-5 space-y-4">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta-gradient text-sm font-bold text-primary-foreground">
                  {i + 1}
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-base font-semibold">
                    <s.icon className="h-4 w-4 text-primary" />
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

    </div>
  );
}
