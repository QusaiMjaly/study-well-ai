import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Dumbbell, Apple, LineChart, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudentFitAI — AI Wellness for University Students" },
      {
        name: "description",
        content:
          "AI-powered meal & workout plans built around your class schedule. Stay healthy, focused, and on track in college.",
      },
      { property: "og:title", content: "StudentFitAI — AI Wellness for Students" },
      {
        property: "og:description",
        content: "Personalized nutrition and workouts that fit your university schedule.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">StudentFitAI</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-6">
        <section className="mx-auto max-w-3xl py-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Powered by Gemini AI
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight md:text-6xl">
            Wellness that fits your{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              class schedule
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Upload your timetable and get AI-generated meal plans and workouts built around your
            real life as a student.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="h-12 px-8 text-base">
                Start free
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                I already have an account
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Calendar, title: "Schedule-aware", body: "Upload your timetable; plans flex around lectures." },
            { icon: Apple, title: "Smart meals", body: "Nutrition tuned to your goals and habits." },
            { icon: Dumbbell, title: "Workouts", body: "Sessions that fit between classes." },
            { icon: LineChart, title: "Progress", body: "Track weight, mood, and momentum." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
