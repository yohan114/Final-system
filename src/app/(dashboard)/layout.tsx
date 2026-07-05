import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { LayoutGrid, BarChart3, LogOut, Cpu, MapPin, TrendingUp } from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-card-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <LayoutGrid className="w-5 h-5 text-accent" />
              <span>E&amp;C Master Portal</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1 text-sm">
              <Link href="/" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4" /> Launcher
              </Link>
              <Link href="/overview" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Overview
              </Link>
              <Link href="/machines" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> Machines
              </Link>
              <Link href="/sites" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> Sites
              </Link>
              <Link href="/profit" className="px-3 py-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Profit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted hidden sm:inline">{session.name}</span>
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
