"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";

type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
type Theme = "LIGHT" | "DARK" | "SYSTEM";
type SettingsData = {
  user: { id: string; name: string | null; email: string; theme: Theme };
  workspace: { id: string; name: string; slug: string };
  role: Role;
};
type Member = { id: string; role: Role; user: { id: string; name: string | null; email: string } };

const roleLabel: Record<Role, string> = { OWNER: "Owner", ADMIN: "Admin", EDITOR: "Editor", VIEWER: "Viewer" };
const themeLabel: Record<Theme, string> = { LIGHT: "สว่าง", DARK: "มืด", SYSTEM: "ตามระบบ" };

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme.toLowerCase();
  localStorage.setItem("devblueprint-theme", theme);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [section, setSection] = useState<"profile" | "workspace" | "members">("profile");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState<Theme>("SYSTEM");
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("VIEWER");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) {
      setError("โหลดการตั้งค่าไม่สำเร็จ");
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as SettingsData;
    setSettings(payload);
    setName(payload.user.name ?? "");
    setEmail(payload.user.email);
    setTheme(payload.user.theme);
    applyTheme(payload.user.theme);
    setWorkspaceName(payload.workspace.name);
    const membersResponse = await fetch("/api/settings/members", { cache: "no-store" });
    if (membersResponse.ok) {
      const memberPayload = (await membersResponse.json()) as { members: Member[] };
      setMembers(memberPayload.members);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Settings are request data; load them once after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, theme }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("บันทึกข้อมูลไม่สำเร็จ");
      return;
    }
    applyTheme(theme);
    setMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
  }

  async function saveWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceName }),
    });
    setSaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      setError(payload.error?.message ?? "บันทึก workspace ไม่สำเร็จ");
      return;
    }
    setMessage("บันทึก workspace เรียบร้อยแล้ว");
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/settings/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("memberEmail"), role }),
    });
    const payload = (await response.json().catch(() => ({}))) as { member?: Member; error?: { message?: string } };
    setSaving(false);
    if (!response.ok || !payload.member) {
      setError(payload.error?.message ?? "เพิ่มสมาชิกไม่สำเร็จ");
      return;
    }
    setMembers((current) => [...current, payload.member as Member]);
    event.currentTarget.reset();
    setMessage("เพิ่มสมาชิกเรียบร้อยแล้ว");
  }

  async function updateMember(memberId: string, nextRole: Exclude<Role, "OWNER">) {
    const response = await fetch(`/api/settings/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    if (!response.ok) {
      setError("เปลี่ยน role ไม่สำเร็จ");
      return;
    }
    const payload = (await response.json()) as { member: Member };
    setMembers((current) => current.map((member) => member.id === memberId ? payload.member : member));
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("ต้องการนำสมาชิกนี้ออกจาก workspace หรือไม่?")) return;
    const response = await fetch(`/api/settings/members/${memberId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("นำสมาชิกออกไม่สำเร็จ");
      return;
    }
    setMembers((current) => current.filter((member) => member.id !== memberId));
    setMessage("นำสมาชิกออกเรียบร้อยแล้ว");
  }

  if (loading) return <main className="loading-screen">กำลังโหลดการตั้งค่า...</main>;
  if (!settings) return <main className="loading-screen"><h1>{error || "ไม่พบข้อมูลการตั้งค่า"}</h1></main>;

  const canManage = settings.role === "OWNER" || settings.role === "ADMIN";

  return (
    <main className="settings-shell">
      <header className="settings-topbar">
        <Link href="/" className="brand"><span className="brand-mark">D</span><span>DevBlueprint</span></Link>
        <div className="settings-top-actions"><Link href="/" className="back-link">← กลับ Dashboard</Link><LogoutButton /></div>
      </header>
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <p className="eyebrow">SETTINGS</p>
          <h1>ตั้งค่า</h1>
          <button className={section === "profile" ? "settings-nav active" : "settings-nav"} onClick={() => setSection("profile")}>โปรไฟล์ของฉัน</button>
          <button className={section === "workspace" ? "settings-nav active" : "settings-nav"} onClick={() => setSection("workspace")}>Workspace</button>
          <button className={section === "members" ? "settings-nav active" : "settings-nav"} onClick={() => setSection("members")}>ผู้ใช้งาน <span>{members.length}</span></button>
        </aside>
        <section className="settings-main">
          {message && <div className="settings-success">{message}</div>}
          {error && <div className="settings-error">{error}</div>}
          {section === "profile" && <SettingsCard title="โปรไฟล์ของฉัน" description="ข้อมูลที่ใช้แสดงใน workspace และกิจกรรมของคุณ"><form className="settings-form" onSubmit={saveProfile}><label>ชื่อที่แสดง<input value={name} onChange={(event) => setName(event.target.value)} placeholder="ชื่อผู้ใช้งาน" /></label><label>อีเมล<input value={email} disabled /></label><label>ธีมการแสดงผล<select value={theme} onChange={(event) => { const nextTheme = event.target.value as Theme; setTheme(nextTheme); applyTheme(nextTheme); }}><option value="LIGHT">{themeLabel.LIGHT}</option><option value="DARK">{themeLabel.DARK}</option><option value="SYSTEM">{themeLabel.SYSTEM}</option></select></label><div className="settings-form-footer"><span>Role: <strong>{roleLabel[settings.role]}</strong></span><button className="button primary" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</button></div></form></SettingsCard>}
          {section === "workspace" && <SettingsCard title="Workspace" description="จัดการชื่อและพื้นที่ทำงานของทีม"><form className="settings-form" onSubmit={saveWorkspace}><label>ชื่อ Workspace<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} disabled={!canManage} /></label><label>Slug<input value={settings.workspace.slug} disabled /></label>{!canManage && <p className="settings-hint">เฉพาะ OWNER หรือ ADMIN เท่านั้นที่แก้ไข workspace ได้</p>}<div className="settings-form-footer"><span>สมาชิก {members.length} คน</span><button className="button primary" disabled={!canManage || saving}>{saving ? "กำลังบันทึก..." : "บันทึก Workspace"}</button></div></form></SettingsCard>}
          {section === "members" && <SettingsCard title="ผู้ใช้งานใน Workspace" description="เพิ่มสมาชิกและกำหนดสิทธิ์การเข้าถึง"><form className="member-add-form" onSubmit={addMember}><input name="memberEmail" type="email" required placeholder="อีเมลของผู้ใช้ที่สมัครแล้ว" disabled={!canManage} /><select value={role} onChange={(event) => setRole(event.target.value as Exclude<Role, "OWNER">)} disabled={!canManage}><option value="VIEWER">Viewer</option><option value="EDITOR">Editor</option><option value="ADMIN">Admin</option></select><button className="button primary" disabled={!canManage || saving}>เพิ่มสมาชิก</button></form>{!canManage && <p className="settings-hint">เฉพาะ OWNER หรือ ADMIN เท่านั้นที่จัดการสมาชิกได้</p>}<div className="member-table">{members.map((member) => <div className="member-row" key={member.id}><div className="member-avatar">{(member.user.name ?? member.user.email).slice(0, 1).toUpperCase()}</div><div className="member-info"><strong>{member.user.name || "ยังไม่ตั้งชื่อ"}</strong><small>{member.user.email}</small></div>{member.role === "OWNER" ? <span className="role-pill owner">Owner</span> : <><select className="role-select" value={member.role} onChange={(event) => void updateMember(member.id, event.target.value as Exclude<Role, "OWNER">)} disabled={!canManage}><option value="ADMIN">Admin</option><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select><button className="remove-member" onClick={() => void removeMember(member.id)} disabled={!canManage}>นำออก</button></>}</div>)}</div></SettingsCard>}
        </section>
      </div>
    </main>
  );
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="settings-card"><div className="settings-card-heading"><h2>{title}</h2><p>{description}</p></div>{children}</div>;
}
