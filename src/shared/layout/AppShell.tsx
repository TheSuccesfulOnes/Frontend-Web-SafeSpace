import { useEffect, useMemo, useState } from "react";
import type { PageKey, Role } from "../../domain/types";
import { useLanguage } from "../../i18n/LanguageProvider";
import { Logo } from "../ui/Logo";

type AppShellProps = {
  role: Role;
  displayName: string;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function AppShell({
  role,
  displayName,
  activePage,
  onNavigate,
  onLogout,
  children,
}: AppShellProps) {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isEmployee = role === "EMPLOYEE";
  const navItems = useMemo(
    () =>
      isEmployee
        ? ([
            ["home", t("home"), "home"],
            ["surveys", t("surveys"), "poll"],
            ["ai", t("ai"), "auto_awesome"],
            ["settings", t("settings"), "settings"],
          ] as const)
        : ([
            ["home", t("home"), "home"],
            ["management", t("management"), "campaign"],
            ["reports", t("reports"), "assignment"],
            ["settings", t("settings"), "settings"],
          ] as const),
    [isEmployee, t],
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function go(page: PageKey) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-backdrop ${mobileMenuOpen ? "visible" : ""}`}
        type="button"
        aria-label={t("closeMenu")}
        onClick={() => setMobileMenuOpen(false)}
      />
      <aside
        className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}
        id="primary-navigation"
      >
        <div className="sidebar-brand">
          <Logo />
          <div>
            <strong>{t("appName")}</strong>
            <span>{t("workspace")}</span>
          </div>
          <button
            className="sidebar-close"
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t("closeMenu")}
          >
            ×
          </button>
        </div>

        <div className="sidebar-view-label">{t("mainNavigation")}</div>
        <nav className="side-nav" aria-label={t("mainNavigation")}>
          {navItems.map(([page, label, icon]) => (
            <button
              type="button"
              className={`side-nav-item ${activePage === page ? "active" : ""}`}
              key={page}
              onClick={() => go(page)}
            >
              <span
                className="side-nav-icon material-symbols-rounded"
                aria-hidden="true"
              >
                {icon}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account-actions">
            <button
              type="button"
              className={`sidebar-account-button ${activePage === "profile" ? "active" : ""}`}
              onClick={() => go("profile")}
              aria-label={`${t("profile")}: ${displayName}`}
            >
              <span
                className="avatar avatar-small sidebar-account-avatar"
                aria-hidden="true"
              >
                {initials(displayName)}
              </span>
              <span className="sidebar-account-name" title={displayName}>
                {displayName}
              </span>
              <span className="sidebar-account-chevron" aria-hidden="true">
                ›
              </span>
            </button>
            <button type="button" className="logout-button" onClick={onLogout}>
              {t("signOut")}
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              type="button"
              className="menu-button"
              aria-label={t("openMenu")}
              aria-expanded={mobileMenuOpen}
              aria-controls="primary-navigation"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
            <h1>
              {activePage === "profile"
                ? t("profile")
                : (navItems.find(([page]) => page === activePage)?.[1] ??
                  t("home"))}
            </h1>
          </div>
        </header>

        <main className="page-content">{children}</main>
        <footer className="page-footer">
          <span>{t("copyright")}</span>
        </footer>
      </div>
    </div>
  );
}
