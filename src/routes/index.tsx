import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell, Apple, BookOpen, Calendar, Sparkles, ArrowRight } from "lucide-react";

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
    body: "Tailored to your goals and fitness level",
    tile: "bg-primary",
    tint: "from-primary/12 to-primary/5",
  },
  {
    icon: Apple,
    title: "Meal plans that fit your day",
    body: "Quick, healthy meals between classes",
    tile: "bg-success",
    tint: "from-success/14 to-success/5",
  },
  {
    icon: Calendar,
    title: "Designed for busy students",
    body: "Works around your class schedule",
    tile: "bg-ai",
    tint: "from-ai/12 to-ai/5",
  },
];

function Landing() {
  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className="relative flex w-full max-w-[448px] flex-col pb-10">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-14 pt-16 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-30%] -top-24 h-[520px] opacity-90"
            style={{
              background:
                "radial-gradient(45% 45% at 22% 30%, color-mix(in oklab, var(--primary) 28%, transparent) 0%, transparent 70%), radial-gradient(45% 45% at 80% 28%, color-mix(in oklab, var(--success) 28%, transparent) 0%, transparent 70%)",
            }}
          />

          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-cta-gradient text-primary-foreground shadow-card">
              <Sparkles className="h-9 w-9" />
            </div>

            <div className="mt-4 flex items-end justify-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-primary text-primary-foreground shadow-soft">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-success text-success-foreground shadow-soft">
                <Apple className="h-7 w-7" />
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-ai text-ai-foreground shadow-soft">
                <BookOpen className="h-6 w-6" />
              </div>
            </div>

            <h1 className="mt-6 text-[36px] font-bold leading-[1.18] tracking-tight">
              Smart Fitness &amp;
              <br />
              Nutrition for Students
            </h1>
            <p className="mt-4 text-lg leading-snug text-muted-foreground">
              AI-powered plans built around your schedule
            </p>
          </div>
        </section>

        {/* Feature cards */}
        <section className="space-y-4 px-6">
          {features.map((f) => (
            <article
              key={f.title}
              className={`flex items-center gap-4 rounded-2xl bg-gradient-to-r ${f.tint} p-4`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.9rem] ${f.tile} text-primary-foreground shadow-soft`}
              >
                <f.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight">{f.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            </article>
          ))}
        </section>

        {/* How it works */}
        <section className="mt-6 px-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta-gradient text-primary-foreground">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">How it works</h2>
            </div>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Our AI analyzes your schedule and creates the perfect workout and meal plan based on
              your free time. No more guessing—just results that fit your student life.
            </p>
          </div>
        </section>

        {/* Primary actions */}
        <section className="mt-auto px-6 pt-14 text-center">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cta-gradient text-base font-bold text-primary-foreground shadow-card transition-opacity hover:opacity-95 active:scale-[0.99]"
          >
            Get Started <ArrowRight className="h-4.5 w-4.5" />
          </Link>

          <p className="mt-4 text-base text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="font-bold text-primary hover:underline">
              Log in
            </Link>
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center">
              <span className="h-5 w-5 rounded-full border-2 border-background bg-primary" />
              <span className="-ml-1.5 h-5 w-5 rounded-full border-2 border-background bg-success" />
              <span className="-ml-1.5 h-5 w-5 rounded-full border-2 border-background bg-ai" />
            </div>
            Join 10,000+ students getting fit
          </div>
        </section>
      </div>
    </div>
  );
}
