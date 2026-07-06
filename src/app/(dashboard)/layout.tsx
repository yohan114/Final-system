import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { isAdmin, isExec, ROLE_LABELS } from "@/lib/roles";
import {
  LayoutGrid,
  BarChart3,
  LogOut,
  Cpu,
  MapPin,
  TrendingUp,
  TriangleAlert,
  Boxes,
  Users,
} from "lucide-react";

// The nav adapts to the signed-in role: executives see the full analytics
// suite, Site Officers their site, Storekeepers the stores view. Everyone
// keeps the launcher (systems open signed-in via SSO).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const exec = isExec(session.role);
  const admin = isAdmin(session.role);

  const linkCls =
    "px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5";

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-card-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <LayoutGrid className="w-5 h-5 text-accent" />
              <span>E&amp;C Master System</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link href="/" className={linkCls}>
                <LayoutGrid className="w-4 h-4" /> Launcher
              </Link>
              {session.role === "SITE" && (
                <Link href="/site" className={linkCls}>
                  <MapPin className="w-4 h-4" /> My Site
                </Link>
              )}
              {(session.role === "SK" || exec) && (
                <Link href="/stores-view" className={linkCls}>
                  <Boxes className="w-4 h-4" /> Stores
                </Link>
              )}
              {exec && (
                <>
                  <Link href="/overview" className={linkCls}>
                    <BarChart3 className="w-4 h-4" /> Overview
                  </Link>
                  <Link href="/machines" className={linkCls}>
                    <Cpu className="w-4 h-4" /> Machines
                  </Link>
                  <Link href="/sites" className={linkCls}>
                    <MapPin className="w-4 h-4" /> Sites
                  </Link>
                  <Link href="/profit" className={linkCls}>
                    <TrendingUp className="w-4 h-4" /> Profit
                  </Link>
                  <Link href="/alerts" className={linkCls}>
                    <TriangleAlert className="w-4 h-4" /> Alerts
                  </Link>
                </>
              )}
              {admin && (
                <Link href="/admin/users" className={linkCls}>
                  <Users className="w-4 h-4" /> People
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:inline">
              {session.name}
              <span className="text-muted/60"> · {ROLE_LABELS[session.role] ?? session.role}</span>
            </span>
            <form action={logoutAction}>
              <button className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-8">{children}</main>
    </div>
  );
}
