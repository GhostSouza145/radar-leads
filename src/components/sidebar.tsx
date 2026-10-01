"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  Radar,
  Settings,
  SquareKanban,
  Users,
} from "lucide-react";
import { logout } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/radar", label: "Radar Google Maps", icon: Radar },
  { href: "/empresas-novas", label: "Empresas novas", icon: Building2 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/funil", label: "Funil", icon: SquareKanban },
  { href: "/monitores", label: "Monitores", icon: Bell },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="flex shrink-0 flex-col border-line bg-panel max-md:border-b md:sticky md:top-0 md:h-screen md:w-60 md:border-r">
      <div className="flex items-center gap-2 px-4 py-4 text-[15px] font-semibold">
        <Radar className="size-5 text-accent" />
        Radar de Leads
        <form action={logout} className="ml-auto md:hidden">
          <button type="submit" className="btn btn-ghost btn-sm" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:pb-0">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive(href) ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="hidden border-t border-line p-3 md:block">
        <p className="truncate px-1 text-xs text-muted" title={email}>{email}</p>
        <form action={logout}>
          <button type="submit" className="btn btn-ghost mt-1 w-full justify-start px-1">
            <LogOut className="size-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
