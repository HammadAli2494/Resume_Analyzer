import { createContext, useContext, useEffect, useState } from "react";
import { getProfile, login as apiLogin, logoutRequest, register as apiRegister, setAuthToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    getProfile()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("access_token");
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiLogin(email, password);
    localStorage.setItem("access_token", data.token);
    setAuthToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const data = await apiRegister(name, email, password);
    localStorage.setItem("access_token", data.token);
    setAuthToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch {
      // The token is discarded locally even if the server is unreachable.
    }
    localStorage.removeItem("access_token");
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
