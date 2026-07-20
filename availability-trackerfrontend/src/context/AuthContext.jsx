import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simple storage: use localStorage for persistence across tabs
  const storage = localStorage;

  const loadUser = useCallback(async () => {
    const token = storage.getItem("token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { user: u } = await authApi.me();
      setUser(u);
    } catch (err) {
      console.warn("[AuthContext] /me failed:", err?.message);
      // Token is invalid — clear everything
      storage.removeItem("token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email, password) => {
    const { user: u, token } = await authApi.login({ email, password });
    storage.setItem("token", token);
    setUser(u);
    return u;
  }, []);

  // DISABLED: Registration removed per assignment (data is pre-seeded)
  // const register = useCallback(async (data) => {
  //   const { user: u, token } = await authApi.register(data);
  //   storage.setItem("token", token);
  //   setUser(u);
  //   return u;
  // }, []);

  const logout = useCallback(() => {
    storage.removeItem("token");
    // DISABLED: SSO-related storage keys (no longer needed)
    // for (const key of ["userRole", "userId", "userEmail", "role", "user"]) {
    //   sessionStorage.removeItem(key);
    //   localStorage.removeItem(key);
    // }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
