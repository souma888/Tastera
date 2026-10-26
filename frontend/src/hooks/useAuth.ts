import { useCallback, useState } from "react";
import type { Account } from "../services/accountApi";

function cachedAccount(): Account | null {
  try {
    const value = JSON.parse(sessionStorage.getItem("tastera_cached_account") ?? "null") as Partial<Account> | null;
    return value && typeof value.id === "string" && typeof value.email === "string" ? { id: value.id, email: value.email } : null;
  } catch { return null; }
}

export type AuthMode = "sign-in" | "sign-up";

export function useAuth() {
  const [account, setAccount] = useState<Account | null>(() => sessionStorage.getItem("tastera_access_token") ? cachedAccount() : null);
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem("tastera_access_token"));
  const [isCheckingAccount, setIsCheckingAccount] = useState(() => Boolean(sessionStorage.getItem("tastera_access_token")));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAccountInfoOpen, setIsAccountInfoOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const clearCachedAccountData = useCallback(() => {
    try {
      const current = cachedAccount();
      if (current) sessionStorage.removeItem(`tastera_cached_library_${current.id}`);
      sessionStorage.removeItem("tastera_cached_account");
    } catch { /* Storage may be unavailable in a restricted browser context. */ }
  }, []);

  const requireSignIn = useCallback((message: string) => {
    sessionStorage.removeItem("tastera_access_token");
    clearCachedAccountData();
    setAuthToken(null);
    setAccount(null);
    setIsCheckingAccount(false);
    setAuthMode("sign-in");
    setAuthError(message);
    setIsAuthOpen(true);
  }, [clearCachedAccountData]);

  return {
    account, setAccount, authToken, setAuthToken, isCheckingAccount, setIsCheckingAccount,
    isAuthOpen, setIsAuthOpen, isAccountInfoOpen, setIsAccountInfoOpen, authMode, setAuthMode,
    authEmail, setAuthEmail, authPassword, setAuthPassword, authError, setAuthError,
    isAuthBusy, setIsAuthBusy, clearCachedAccountData, requireSignIn,
  };
}
