import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin, ROLE_LABELS } from "@/lib/roles";
import { createUserAction, setUserActiveAction } from "@/app/actions/users";
import { Users, UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

// People & roles for the master system. Admin creates every account here and
// decides what each person sees: Managers get the executive views, Site
// Officers get their own site's dashboard, Storekeepers the stores view.
export default async function UsersAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.role)) redirect("/");

  const [users, sites] = await Promise.all([
    prisma.portalUser.findMany({ orderBy: { createdAt: "asc" }, include: { site: true } }),
    prisma.siteMap.findMany({ orderBy: { canonicalKey: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-accent" />
        <div>
          <h1 className="text-xl font-semibold">People &amp; roles</h1>
          <p className="text-sm text-muted">
            One login for everyone — each role gets its own dashboard: Manager (analytics),
            Site Officer (their site), Storekeeper (stores), Driver (coming with driver KPIs).
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-card-border">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-card-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted font-mono">{u.username}</div>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="px-4 py-3 text-muted">{u.site?.label || u.site?.canonicalKey || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={u.active ? "text-emerald-400" : "text-red-400"}>
                      {u.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== session.userId && (
                      <form
                        action={async () => {
                          "use server";
                          await setUserActiveAction(u.id, !u.active);
                        }}
                      >
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-card-border">
                          {u.active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-5 h-fit">
          <div className="flex items-center gap-2 mb-4 font-medium">
            <UserPlus className="w-4 h-4 text-accent" /> Add a person
          </div>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createUserAction(formData);
            }}
            className="space-y-3 text-sm"
          >
            <input
              name="name"
              required
              placeholder="Full name"
              className="w-full bg-white/5 border border-card-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-accent/50"
            />
            <input
              name="username"
              required
              placeholder="Username (same as their system logins for SSO)"
              className="w-full bg-white/5 border border-card-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-accent/50 font-mono"
            />
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Initial password (min 8 chars)"
              className="w-full bg-white/5 border border-card-border rounded-xl px-3 py-2.5 focus:outline-none focus:border-accent/50"
            />
            <select
              name="role"
              required
              className="w-full bg-white/5 border border-card-border rounded-xl px-3 py-2.5 focus:outline-none"
              defaultValue="SITE"
            >
              <option value="MANAGER">Manager — full analytics</option>
              <option value="SITE">Site Officer — own site dashboard</option>
              <option value="SK">Storekeeper — stores view</option>
              <option value="DRIVER">Driver — driver KPIs (coming)</option>
              <option value="MASTER_ADMIN">Administrator — everything</option>
            </select>
            <select
              name="siteId"
              className="w-full bg-white/5 border border-card-border rounded-xl px-3 py-2.5 focus:outline-none"
              defaultValue=""
            >
              <option value="">Site (required for Site Officer)</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.canonicalKey}
                </option>
              ))}
            </select>
            <button className="w-full bg-accent/20 hover:bg-accent/30 border border-accent/30 text-foreground rounded-xl px-4 py-2.5 font-medium">
              Create user
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
