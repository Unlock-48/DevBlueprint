"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setPending(false);

    if (!result || result.error) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label htmlFor="login-email">อีเมล</label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />

      <label htmlFor="login-password">รหัสผ่าน</label>
      <input
        id="login-password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
      />

      {error && <p className="auth-error">{error}</p>}

      <button className="button primary auth-submit" disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </button>

      <p className="auth-meta">
        ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link>
      </p>
    </form>
  );
}
