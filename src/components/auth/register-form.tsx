"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RegisterResponse = {
  error?: {
    message?: string;
  };
};

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as RegisterResponse;
      setError(payload.error?.message ?? "ไม่สามารถสมัครสมาชิกได้");
      setPending(false);
      return;
    }

    const login = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
      callbackUrl: "/",
    });

    setPending(false);

    if (!login || login.error) {
      setError("สมัครสำเร็จแล้ว แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ กรุณาเข้าสู่ระบบด้วยตนเอง");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label htmlFor="register-name">ชื่อ (ไม่บังคับ)</label>
      <input
        id="register-name"
        type="text"
        autoComplete="name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="ชื่อผู้ใช้งาน"
      />

      <label htmlFor="register-email">อีเมล</label>
      <input
        id="register-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
      />

      <label htmlFor="register-password">รหัสผ่าน</label>
      <input
        id="register-password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="อย่างน้อย 8 ตัวอักษร"
      />

      {error && <p className="auth-error">{error}</p>}

      <button className="button primary auth-submit" disabled={pending}>
        {pending ? "กำลังสร้างบัญชี..." : "สมัครสมาชิก"}
      </button>

      <p className="auth-meta">
        มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
      </p>
    </form>
  );
}
