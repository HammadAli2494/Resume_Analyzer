import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const nav = [
  { to: "/", label: "Analyze" },
  { to: "/jobs", label: "Jobs", auth: true },
  { to: "/labeling", label: "Label Data" },
  { to: "/evaluation", label: "Evaluation" },
];

export default function Layout() {
  const { pathname } = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const isActive = (to) => {
    if (to === "/") return pathname === "/";
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-600/50 bg-surface-800/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Resume Screening</h1>
            <p className="text-sm text-gray-500">ATS-style matching with supervised ML</p>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {nav
              .filter((item) => !item.auth || isAuthenticated)
              .map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    isActive(to) ? "bg-accent text-white" : "bg-surface-700 text-gray-300"
                  }`}
                >
                  {label}
                </Link>
              ))}
            {!isAuthenticated && (
              <Link
                to="/jobs"
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300"
                title="Sign in to manage job postings"
              >
                Jobs (login)
              </Link>
            )}
            {isAuthenticated ? (
              <>
                <span className="text-xs text-gray-500 px-2">{user?.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="px-4 py-2 rounded-lg text-sm bg-surface-700 text-accent">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
      <footer className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-gray-600 border-t border-surface-600/40">
        Resume–job match classifier · Django + React
      </footer>
    </div>
  );
}
