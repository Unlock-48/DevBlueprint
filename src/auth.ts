import { db } from "@/server/db";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  // ใช้ JWT strategy สำหรับ Credentials Provider
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "test@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null; // ถ้าไม่ได้ส่งอีเมลหรือรหัสผ่านมา ให้ตีตกไป
        }

        // 1. ค้นหาผู้ใช้จาก Email
        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        // 2. ถ้าไม่เจอผู้ใช้ หรือผู้ใช้นั้นไม่มีรหัสผ่าน (เช่น สมัครด้วย Google) ให้ตีตก
        if (!user || !user.passwordHash) {
          return null;
        }

        // 3. ตรวจสอบรหัสผ่านว่าตรงกับ Hash ในระบบหรือไม่
        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          return null;
        }

        // 4. ล็อกอินสำเร็จ คืนค่าข้อมูลที่ต้องการให้อยู่ใน Token
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    // นำ id ของผู้ใช้ยัดเข้าไปใน JWT Token (รันตอนล็อกอินสำเร็จ)
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    // นำ id จาก Token ออกมาให้ดึงไปใช้ในฝั่ง Client ได้ (ผ่าน useSession)
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
