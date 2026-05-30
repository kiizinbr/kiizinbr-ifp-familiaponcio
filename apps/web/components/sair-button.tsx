"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function SairButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sair
    </button>
  );
}
