import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Nav } from "@/components/site/Nav";
import { OnboardingFlow } from "@/components/dashboard/OnboardingFlow";

export const metadata = { title: "Onboarding" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id!;
  const profile = await prisma.clientProfile.findUnique({
    where: { userId },
    include: { connections: true },
  });

  return (
    <>
      <Nav />
      <main className="min-h-screen pt-[110px] pb-24">
        <OnboardingFlow
          userName={session.user.name ?? "there"}
          initial={{
            company: profile?.company ?? "",
            website: profile?.website ?? "",
            industry: profile?.industry ?? "",
            monthlyBudget: profile?.monthlyBudget ?? "",
            whatsapp: profile?.whatsapp ?? "",
            stage: profile?.onboardingStage ?? "google_linked",
            connections: profile?.connections.map((c) => ({ provider: c.provider, status: c.status })) ?? [],
          }}
        />
      </main>
    </>
  );
}
