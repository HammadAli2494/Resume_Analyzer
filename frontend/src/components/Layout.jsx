import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FadeIn } from "./Motion";

const nav = [
  { to: "/jobs", label: "Jobs" },
  { to: "/history", label: "History" },
];

export default function Layout() {
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-600/50 bg-surface-800/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/jobs" className="text-lg font-semibold text-white">Resume screening</Link>
          <nav className="flex flex-wrap items-center gap-2" aria-label="Main">
            {isAuthenticated && nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  pathname === to || pathname.startsWith(`${to}/`)
                    ? "bg-accent text-white"
                    : "bg-surface-700 text-gray-200"
                }`}
              >
                {label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <span className="text-sm text-gray-400 px-1">{user?.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    navigate("/login");
                  }}
                  className="text-sm text-gray-300 hover:text-white px-2 py-2"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="px-3 py-2 rounded-lg text-sm bg-surface-700 text-accent">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <FadeIn key={pathname}>
          <Outlet />
        </FadeIn>
      </main>
      <footer className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-500">
        Scores describe fit for a specific job and support human review. They do not reject candidates.
      </footer>
    </div>
  );
}
