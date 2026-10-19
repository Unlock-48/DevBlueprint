import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">D</span><strong>DevBlueprint</strong></div>
        <p className="eyebrow">DEVBLUEPRINT</p>
        <h1>สมัครสมาชิก</h1>
        <p className="auth-description">สร้างบัญชีเพื่อเริ่มจัดการโครงการใน workspace ของคุณ</p>
        <RegisterForm />
      </section>
    </main>
  );
}
