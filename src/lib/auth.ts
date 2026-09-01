import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

/**
 * AUTH — two-stage identity resolution.
 *
 * Stage 1  Google login. Minimal scopes (openid/email/profile). This is the
 *          consent gate: signing in IS the authorisation to personalise
 *          tracking, which is why the modal offers it as the primary action.
 *
 * Stage 2  Asset access. Requested AFTER the client is inside, never before —
 *          asking for `business_management` at first contact destroys the
 *          conversion rate. Google Business Profile and Meta Business scopes
 *          both require app review before they work in production; until then
 *          the onboarding flow records the *request* and falls back to a
 *          partner-invitation link, which is what agencies actually use.
 */

const googleScopes = [
  "openid",
  "email",
  "profile",
  // Enable after Google verification for GBP read access:
  // "https://www.googleapis.com/auth/business.manage",
].join(" ");

const facebookScopes = [
  "email",
  "public_profile",
  // Enable after Meta App Review for asset access:
  // "business_management", "ads_read", "pages_show_list", "pages_read_engagement",
].join(",");

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/", error: "/" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { scope: googleScopes, prompt: "consent", access_type: "offline" },
      },
      allowDangerousEmailAccountLinking: true,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      authorization: { params: { scope: facebookScopes } },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: string }).role ?? "visitor";
      }
      if (account?.provider) token.lastProvider = account.provider;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "visitor";
      }
      return session;
    },
  },
  events: {
    /**
     * The moment identity resolves: bind the anonymous behavioural history to
     * the real person. Without this step every pre-login behaviour is orphaned
     * and the lead score restarts at zero — the most common failure in
     * home-grown tracking.
     */
    async signIn({ user, account }) {
      if (!user.id) return;
      const isAdmin = (process.env.ADMIN_EMAILS ?? "")
        .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
        .includes((user.email ?? "").toLowerCase());

      await prisma.user.update({
        where: { id: user.id },
        data: { role: isAdmin ? "admin" : "client" },
      }).catch(() => {});

      await prisma.clientProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          onboardingStage: account?.provider === "google" ? "google_linked" : "started",
        },
        update: {},
      }).catch(() => {});
    },
  },
});

export async function isAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}
