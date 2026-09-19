import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        studentId: { label: "Student ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const studentIdRaw = credentials?.studentId ?? (credentials as any)?.email;
        if (!studentIdRaw || !credentials?.password) {
          return null;
        }
        const studentId = String(studentIdRaw).trim();
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { studentId },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          studentId: user.studentId,
          email: user.studentId, // Keep for NextAuth default type compatibility
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.studentId = (user as any).studentId || user.email;
        token.email = (user as any).studentId || user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as any).studentId = token.studentId as string;
        session.user.email = (token.studentId as string) || (token.email as string);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "attendance-tracker-super-secret-jwt-key-2026",
});
