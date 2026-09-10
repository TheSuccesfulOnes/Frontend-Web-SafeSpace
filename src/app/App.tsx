import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuthSession,
  Language,
  PageKey,
  Profile,
  Theme,
} from "../domain/types";
import { useLanguage } from "../i18n/LanguageProvider";
import { isUnauthorized } from "../infrastructure/api/apiClient";
import {
  getProfile,
  updatePreferences,
} from "../infrastructure/profile/profileService";
import {
  clearSession,
  readSession,
  saveSession,
} from "../infrastructure/auth/sessionStorage";
import {
  readLocalPreferences,
  saveLocalPreference,
} from "../infrastructure/preferences/preferenceStore";
import { AppShell } from "../shared/layout/AppShell";
import { EmployeeAiPage } from "../contexts/ai/presentation/EmployeeAiPage";
import { EmployeeHomePage } from "../contexts/employee/presentation/EmployeeHomePage";
import { EmployeeSurveysPage } from "../contexts/survey/presentation/EmployeeSurveysPage";
import { HrHomePage } from "../contexts/humanresources/presentation/HrHomePage";
import { HrManagementPage } from "../contexts/humanresources/presentation/HrManagementPage";
import { HrReportsPage } from "../contexts/report/presentation/HrReportsPage";
import { ProfilePage } from "../contexts/profile/presentation/ProfilePage";
import { SettingsPage } from "../contexts/profile/presentation/SettingsPage";
import { LoginPage } from "../contexts/authentication/presentation/LoginPage";
import { RegisterPage } from "../contexts/authentication/presentation/RegisterPage";
import { RecoveryPage } from "../contexts/authentication/presentation/RecoveryPage";
import "./app.css";

type AuthView = "login" | "register" | "recovery";

function allowedPage(role: AuthSession["role"], page: string): PageKey {
  const employeePages: PageKey[] = [
    "home",
    "surveys",
    "ai",
    "settings",
    "profile",
  ];
  const hrPages: PageKey[] = [
    "home",
    "management",
    "reports",
    "settings",
    "profile",
  ];
  const pages = role === "EMPLOYEE" ? employeePages : hrPages;
  return pages.includes(page as PageKey) ? (page as PageKey) : "home";
}

function readPage(role: AuthSession["role"]): PageKey {
  return allowedPage(role, window.location.hash.replace(/^#\/?/, ""));
}

export function App() {
  const { setLanguage, t } = useLanguage();
  const [session, setSession] = useState<AuthSession | null>(() =>
    readSession(),
  );
  const [authView, setAuthView] = useState<AuthView>("login");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [activePage, setActivePage] = useState<PageKey>(() =>
    session ? readPage(session.role) : "home",
  );

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
    setProfile(null);
    setAuthView("login");
  }, []);

  const handleUnauthorized = useCallback(() => {
    signOut();
  }, [signOut]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!session) return;
    const localPreferences = readLocalPreferences(session.userId);
    if (localPreferences.language) setLanguage(localPreferences.language);
    if (localPreferences.theme) setTheme(localPreferences.theme);

    getProfile(session.token)
      .then((loadedProfile) => {
        setProfile(loadedProfile);
        setLanguage(loadedProfile.language);
        setTheme(loadedProfile.theme);
        saveLocalPreference(
          loadedProfile.userId,
          "language",
          loadedProfile.language,
        );
        saveLocalPreference(loadedProfile.userId, "theme", loadedProfile.theme);
      })
      .catch((error: unknown) => {
        if (isUnauthorized(error)) handleUnauthorized();
      });
  }, [handleUnauthorized, session, setLanguage]);

  function handleLogin(nextSession: AuthSession) {
    const localPreferences = readLocalPreferences(nextSession.userId);
    if (localPreferences.language) setLanguage(localPreferences.language);
    if (localPreferences.theme) setTheme(localPreferences.theme);
    saveSession(nextSession);
    setSession(nextSession);
    setActivePage("home");
    window.location.hash = "#/home";
    setAuthView("login");
  }

  function navigate(page: PageKey) {
    const safePage = session ? allowedPage(session.role, page) : "home";
    setActivePage(safePage);
    window.location.hash = `#/${safePage}`;
  }

  function updateSession(nextProfile: Profile, nextToken?: string) {
    const nextSession = {
      ...(session as AuthSession),
      ...(nextToken ? { token: nextToken } : {}),
      username: nextProfile.username,
      displayName: nextProfile.displayName,
      userId: nextProfile.userId,
    };
    saveSession(nextSession);
    setSession(nextSession);
    setProfile(nextProfile);
  }

  async function changePreferences(language: Language, nextTheme: Theme) {
    if (!session) return;
    const nextProfile = await updatePreferences(
      session.token,
      language,
      nextTheme,
    );
    setLanguage(language);
    setTheme(nextTheme);
    saveLocalPreference(nextProfile.userId, "language", language);
    saveLocalPreference(nextProfile.userId, "theme", nextTheme);
    setProfile(nextProfile);
  }

  const currentProfile = useMemo(
    () =>
      profile ??
      (session
        ? {
            username: session.username,
            email: "",
            displayName: session.displayName,
            role: session.role,
            language: "es" as Language,
            theme,
            userId: session.userId,
          }
        : null),
    [profile, session, theme],
  );

  if (!session) {
    if (authView === "register")
      return (
        <RegisterPage
          onBack={() => setAuthView("login")}
          onRegistered={() => setAuthView("login")}
        />
      );
    if (authView === "recovery")
      return <RecoveryPage onBack={() => setAuthView("login")} />;
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => setAuthView("register")}
        onRecovery={() => setAuthView("recovery")}
      />
    );
  }

  if (session.role === "SYSTEM_ADMIN") {
    return (
      <div className="restricted-page">
        <span className="eyebrow">{t("appName")}</span>
        <h1>{t("systemAdminPortal")}</h1>
        <button type="button" className="primary-button" onClick={signOut}>
          {t("signOut")}
        </button>
      </div>
    );
  }

  return (
    <AppShell
      role={session.role}
      displayName={session.displayName}
      activePage={activePage}
      onNavigate={navigate}
      onLogout={signOut}
    >
      {session.role === "EMPLOYEE" && activePage === "home" && (
        <EmployeeHomePage
          token={session.token}
          displayName={session.displayName}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {session.role === "EMPLOYEE" && activePage === "surveys" && (
        <EmployeeSurveysPage
          token={session.token}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {session.role === "EMPLOYEE" && activePage === "ai" && (
        <EmployeeAiPage
          token={session.token}
          language={currentProfile?.language ?? "es"}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {session.role === "HR_MEMBER" && activePage === "home" && (
        <HrHomePage
          token={session.token}
          displayName={session.displayName}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {session.role === "HR_MEMBER" && activePage === "management" && (
        <HrManagementPage
          token={session.token}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {session.role === "HR_MEMBER" && activePage === "reports" && (
        <HrReportsPage
          token={session.token}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {activePage === "settings" && currentProfile && (
        <SettingsPage
          token={session.token}
          profile={currentProfile}
          onProfileUpdated={updateSession}
          onPreferencesUpdated={changePreferences}
          onUnauthorized={handleUnauthorized}
        />
      )}
      {activePage === "profile" && currentProfile && (
        <ProfilePage profile={currentProfile} />
      )}
    </AppShell>
  );
}
