import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { RunView } from "./RunView";
import { AdminView } from "./AdminView";

export function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <NavLink to="/" className="brand" end>docbench</NavLink>
        <div className="nav-links">
          <NavLink to="/" end>run</NavLink>
          <NavLink to="/admin">admin</NavLink>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<RunView />} />
          <Route path="/admin" element={<AdminView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
