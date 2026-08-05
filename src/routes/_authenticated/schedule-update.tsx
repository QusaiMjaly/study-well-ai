import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeTimetable } from "@/lib/schedule.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/schedule-update")({
  head: () => ({
    meta: [
      { title: "Update your timetable — StudentFitAI" },
      {
        name: "description",
        content:
          "Upload a new class timetable image and let StudentFitAI re-read your week without redoing onboarding.",
      },
      { property: "og:title", content: "Update your timetable — StudentFitAI" },
      {
        property: "og:description",
        content: "Replace your timetable image and refresh your schedule in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScheduleUpdate,
});

function ScheduleUpdate() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeTimetable);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (!f.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (f.size > 10 * 1024 * 1024) return toast.error("Image must be under 10 MB.");
    setFile(f);
  }

  async function submit() {
    if (!file) return toast.error("Choose a timetable image first.");
    setBusy(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("You are signed out. Please sign in again.");

      const path = `${u.user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("schedule-images").upload(path, file);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("schedules").insert({
        user_id: u.user.id,
        image_url: path,
        schedule_json: null,
      });
      if (insErr) throw insErr;

      await analyze(undefined as never);

      setDone(true);
      toast.success("Timetable updated.");
      setTimeout(() => navigate({ to: "/dashboard" }), 1000);
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-5 py-6">
      <button
        type="button"
        onClick={() => navigate({ to: "/dashboard" })}
        className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </button>

      <h1 className="text-xl font-semibold">Update your timetable</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a new class timetable image. Your other details stay exactly as they are.
      </p>

      <Card className="mt-5 rounded-2xl p-5">
        <label
          htmlFor="timetable"
          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected timetable preview"
              className="max-h-56 w-full rounded-xl object-contain"
            />
          ) : (
            <>
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <span className="mt-3 text-sm font-medium">Tap to choose an image</span>
              <span className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 10 MB</span>
            </>
          )}
        </label>
        <input
          id="timetable"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {file && (
          <p className="mt-3 truncate text-xs text-muted-foreground">Selected: {file.name}</p>
        )}
      </Card>

      {error && (
        <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <Button className="mt-5 w-full" onClick={submit} disabled={busy || !file || done}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading your timetable…
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Updated
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> Upload and analyse
          </>
        )}
      </Button>

      <Button
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => navigate({ to: "/dashboard" })}
        disabled={busy}
      >
        Cancel
      </Button>
    </div>
  );
}
