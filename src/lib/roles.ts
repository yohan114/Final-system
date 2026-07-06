// Master-system roles. Every portal user carries exactly one; SITE officers
// are additionally scoped to a canonical site (PortalUser.siteId). Legacy
// values from the M1-era portal remain valid: DIRECTOR reads like MANAGER,
// VIEWER like DRIVER (see the exec/home helpers).

export const ASSIGNABLE_ROLES = ["MASTER_ADMIN", "MANAGER", "SITE", "SK", "DRIVER"] as const;

export const ROLE_LABELS: Record<string, string> = {
  MASTER_ADMIN: "Administrator",
  MANAGER: "Manager",
  SITE: "Site Officer",
  SK: "Storekeeper",
  DRIVER: "Driver",
  DIRECTOR: "Director (legacy)",
  VIEWER: "Viewer (legacy)",
};

export function isAdmin(role: string): boolean {
  return role === "MASTER_ADMIN";
}

// Executive views: full analytics (overview, machines, sites, profit, alerts).
export function isExec(role: string): boolean {
  return role === "MASTER_ADMIN" || role === "MANAGER" || role === "DIRECTOR";
}

// Where each role lands after signing in.
export function homeFor(role: string): string {
  if (role === "SITE") return "/site";
  if (role === "SK") return "/stores-view";
  return "/";
}
