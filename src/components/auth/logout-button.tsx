"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button type="button" className="logout-button" onClick={onLogout} disabled={pending}>
      {pending ? "กำลังออก..." : "ออกจากระบบ"}
    </button>
  );
}
