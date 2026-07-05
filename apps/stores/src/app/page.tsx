import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Query Requests
  const requests = await prisma.machineRequest.findMany({
    include: {
      mediaFiles: true,
      machine: {
        include: {
          site: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Query Sites
  const sites = await prisma.site.findMany({
    orderBy: {
      name: "asc",
    },
  });

  // Query Machines
  const machines = await prisma.machine.findMany({
    include: {
      site: true,
      mediaFiles: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <Dashboard 
      initialRequests={requests} 
      initialSites={sites} 
      initialMachines={machines} 
      session={session} 
    />
  );
}
