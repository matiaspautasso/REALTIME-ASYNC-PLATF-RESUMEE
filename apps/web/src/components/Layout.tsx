import { NavLink, Outlet } from 'react-router-dom';

/** App shell: top navigation + routed page content. */
export function Layout() {
  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo">JF</span>
          <span>JobFlow</span>
        </div>
        <nav className="app__nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/imports/new">New import</NavLink>
          <NavLink to="/history">History</NavLink>
        </nav>
      </header>
      <main className="app__main">
        <Outlet />
      </main>
    </div>
  );
}
