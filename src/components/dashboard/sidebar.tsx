"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NavIcon } from "@/components/dashboard/nav-icon";
import { logoutAction } from "@/lib/actions/auth";
import type { NavItem } from "@/lib/navigation";

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/**
 * Barre latérale du back-office (§8.6). Sur mobile, elle devient un menu repliable ouvert
 * par un bouton (mobile d'abord, §8.5).
 */
export function Sidebar({
  items,
  agenceNom,
  userName,
  roleLabel,
}: {
  items: readonly NavItem[];
  agenceNom: string;
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between border-b border-gt-mist bg-white px-4 py-3 lg:hidden">
        <span className="truncate font-semibold text-gt-teal-900">{agenceNom}</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="dashboard-sidebar"
          className="rounded-lg border border-gt-mist px-3 py-1.5 text-sm font-medium text-gt-teal-700"
        >
          {open ? "Fermer" : "Menu"}
        </button>
      </div>

      <aside
        id="dashboard-sidebar"
        className={`${open ? "block" : "hidden"} border-b border-gt-mist bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0`}
      >
        <div className="flex h-full flex-col gap-6 p-4">
          <div className="hidden lg:block">
            <Link href="/dashboard" className="font-script text-2xl text-gt-teal-700">
              Green Trek
            </Link>
            <p className="mt-1 truncate text-sm font-semibold text-gt-teal-900">{agenceNom}</p>
          </div>

          <nav aria-label="Back-office">
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                        active ? "bg-gt-teal-700 text-white" : "text-gt-teal-900 hover:bg-gt-cream"
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto border-t border-gt-mist pt-4">
            <p className="truncate text-sm font-medium text-gt-teal-900">{userName}</p>
            <p className="text-xs text-gt-teal-900/70">{roleLabel}</p>
            <form action={logoutAction} className="mt-3">
              <button
                type="submit"
                className="text-sm font-medium text-gt-teal-700 underline hover:text-gt-teal-900"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
