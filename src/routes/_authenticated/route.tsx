import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PlanRegenerationProvider } from "@/lib/plan-regeneration";
import { PlanRegenerationBanner } from "@/components/dashboard/PlanRegenerationBanner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

/**
 * The mobile app shell owns its own header and bottom navigation, so this
 * layout stays chrome-free. Logging out lives on the Profile tab.
 *
 * Plan regeneration state lives here (above every page) so it keeps running
 * while the user navigates between Dashboard tabs and the schedule page.
 */
// הקומפוננטה היא המעטפת של כל העמודים המוגנים (רק למשתמשים מחוברים) ומנהלת את יצירת התוכנית מחדש ברמה הגלובלית
function AuthenticatedLayout() {
  return (
    /* מעטפת העמודים הפרטיים עם מנהל עדכון התוכנית */
    <PlanRegenerationProvider>
      <div className="min-h-screen bg-background">
        <Outlet />
        <PlanRegenerationBanner />
      </div>
    </PlanRegenerationProvider>
  );
}


