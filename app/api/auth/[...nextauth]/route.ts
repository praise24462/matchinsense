import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Only import Prisma adapter if DATABASE_URL is available
let adapter: any = undefined;
if (process.env.DATABASE_URL) {
  try {
    const { PrismaAdapter } = require("@next-auth/prisma-adapter");
    const { prisma } = require("@/services/prisma");
    adapter = PrismaAdapter(prisma);
  } catch (err) {
    console.warn("[auth] PrismaAdapter skipped:", err);
  }
}

export const authOptions: NextAuthOptions = {
  ...(adapter ? { adapter } : {}),
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
