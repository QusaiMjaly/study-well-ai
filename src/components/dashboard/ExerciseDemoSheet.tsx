import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Dumbbell, Info, ListChecks, TriangleAlert, VideoOff } from "lucide-react";
import { getExerciseDemo } from "@/lib/exercise-demo.functions";
import type { WorkoutExercise } from "@/lib/workouts-data";

// הקומפוננטה מציגה חלון הדגמה של תרגיל: סרטון, שרירים עובדים, דגשי טכניקה וטעויות נפוצות
export function ExerciseDemoSheet({
  exercise,
  open,
  onOpenChange,
}: {
  exercise: WorkoutExercise | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const fetchDemo = useServerFn(getExerciseDemo);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["exercise-demo", exercise?.exercise_slug ?? null, exercise?.exercise_name ?? ""],
    queryFn: () =>
      fetchDemo({
        data: {
          slug: exercise?.exercise_slug ?? null,
          exerciseName: exercise?.exercise_name ?? "",
        },
      }),
    enabled: open && !!exercise,
    // Provider media URLs are temporary — always fetch fresh when a demo opens.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  // One refetch attempt per sheet session when a temporary URL has expired.
  const retriedRef = useRef(false);
  const [videoFailed, setVideoFailed] = useState(false);
  useEffect(() => {
    if (!open) {
      retriedRef.current = false;
      setVideoFailed(false);
    }
  }, [open]);

  // הפונקציה מנסה שוב פעם אחת לטעון את הסרטון כשהקישור הזמני פג, ואז מציגה מצב "לא זמין"
  const onVideoError = () => {
    if (!retriedRef.current) {
      retriedRef.current = true;
      void refetch();
      return;
    }
    setVideoFailed(true);
  };

  const video = videoFailed ? null : (data?.video ?? null);
  const showUnavailable = !!data && !video;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[88vh] w-full max-w-[448px] overflow-y-auto rounded-t-3xl border-border/70 p-0"
      >
        <SheetHeader className="px-5 pb-2 pt-5 text-left">
          <SheetTitle className="text-[20px] font-bold leading-7">
            {data?.display_name ?? exercise?.exercise_name ?? "Exercise"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-5 pb-8">
          {/* Demo media */}
          <div className="overflow-hidden rounded-2xl bg-muted">
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : video ? (
              <video
                key={video.url}
                src={video.url}
                poster={video.poster ?? undefined}
                autoPlay={!reducedMotion}
                loop={!reducedMotion}
                muted
                playsInline
                controls
                preload="metadata"
                onError={onVideoError}
                aria-label={`${data?.display_name ?? "Exercise"} demonstration`}
                className="mx-auto h-64 w-full max-w-[320px] object-contain"
              />
            ) : showUnavailable ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                <VideoOff className="h-7 w-7 text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  Exercise demo video is temporarily unavailable.
                </p>
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
                <VideoOff className="h-7 w-7 text-muted-foreground" />
                <p className="text-[13px] text-muted-foreground">
                  No demo animation is available for this exercise yet.
                </p>
              </div>
            )}
          </div>


          {/* Plan prescription */}
          <div className="flex flex-wrap gap-2">
            {exercise?.sets ? <Pill>{exercise.sets} sets</Pill> : null}
            {exercise?.reps ? <Pill>{exercise.reps} reps</Pill> : null}
            {exercise?.duration_seconds ? <Pill>{exercise.duration_seconds}s work</Pill> : null}
            {exercise?.rest_seconds ? <Pill>{exercise.rest_seconds}s rest</Pill> : null}
            {data?.equipment ? <Pill className="capitalize">{data.equipment}</Pill> : null}
          </div>

          {data?.primary_muscles?.length ? (
            <Section icon={<Dumbbell className="h-[18px] w-[18px] text-primary" />} title="Muscles worked">
              <p className="text-[14px] capitalize leading-5 text-foreground/90">
                {data.primary_muscles.join(", ")}
              </p>
            </Section>
          ) : null}

          {data?.cues?.length ? (
            <Section icon={<ListChecks className="h-[18px] w-[18px] text-success" />} title="Form cues">
              <ul className="space-y-2">
                {data.cues.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[14px] leading-5 text-foreground/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {data?.common_mistakes?.length ? (
            <Section
              icon={<TriangleAlert className="h-[18px] w-[18px] text-warning" />}
              title="Common mistakes"
            >
              <ul className="space-y-2">
                {data.common_mistakes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-[14px] leading-5 text-foreground/90">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {exercise?.notes ? (
            <Section icon={<Info className="h-[18px] w-[18px] text-primary" />} title="Coach note">
              <p className="text-[14px] leading-5 text-foreground/90">{exercise.notes}</p>
            </Section>
          ) : null}

          {!isLoading && !data ? (
            <p className="text-[13px] leading-5 text-muted-foreground">
              This exercise isn't in our demo library yet — follow your plan's sets, reps and coach
              note above.
            </p>
          ) : null}

          {data?.attribution || data?.license ? (
            <p className="text-[11px] leading-4 text-muted-foreground">
              {data.attribution}
              {data.attribution && data.license ? " · " : ""}
              {data.license}
              {data.source_url ? (
                <>
                  {" · "}
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline"
                  >
                    source
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** True when the user has asked the OS to reduce motion. Hydration-safe. */
// ה-Hook בודק אם המשתמש ביקש מהמערכת להפחית אנימציות (prefers-reduced-motion)
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium leading-4 text-muted-foreground ${className}`}
    >
      {children}
    </span>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-[16px] font-bold">
        {icon}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
