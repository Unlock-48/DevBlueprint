import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">D</span><strong>DevBlueprint</strong></div>
        <p className="eyebrow">DEVBLUEPRINT</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="auth-description">จัดการโปรเจกต์และ checklist จากข้อมูลจริงของทีมคุณ</p>
        <LoginForm />
      </section>
    </main>
  );
}
