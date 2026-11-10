/**
 * Primary navigation. The Console combines exercise direction and operation.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, History as HistoryIcon, Home, type LucideIcon, Radio, Scale, Moon, Sun, ListChecks, Github } from 'lucide-react';
import { DemoTour } from '../showcase/DemoTour';
import { useUi } from '../stage/uiStore';
import { OrcaMark } from './OrcaMark';

type NavItem = { to: string; label: string; icon: LucideIcon };
export const NAV: NavItem[] = [
  { to: '/', label: 'Learn', icon: Home },
  { to: '/scenarios', label: 'Scenarios', icon: ListChecks },
  { to: '/workspace', label: 'Console', icon: Radio },
  { to: '/policy', label: 'Policy & Gaps', icon: Scale },
  { to: '/recovery', label: 'Recovery', icon: ClipboardList },
  { to: '/audit', label: 'Audit & Replay', icon: HistoryIcon },
];

export function TopNav() {
  const { search, pathname } = useLocation();
  const theme = useUi(s => s.theme);
  const toggleTheme = useUi(s => s.toggleTheme);
  const suffix = new URLSearchParams(search).get('fake') === '1' ? search : '';
  return (
    <header className="sh-topnav">
      <NavLink to={`/${suffix}`} className="sh-brand" aria-label="ORCA-NTN home">
        <span className="sh-brand__mark"><OrcaMark size={40} /></span>
        <span className="sh-brand__name">ORCA-<b>NTN</b></span>
      </NavLink>
      <nav className="sh-nav" aria-label="Primary">
        {NAV.map(({ to, label }) => (
          <NavLink key={to} to={`${to}${suffix}`} end={to === '/'} className={({ isActive }) => `sh-nav__link${isActive || (to === '/workspace' && ['/operations', '/simulator'].includes(pathname)) ? ' is-active' : ''}`}>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <a className="sh-btn sh-btn--sm repository-link" href="https://github.com/CharanVelavan/ORCA" target="_blank" rel="noreferrer" aria-label="Open ORCA GitHub repository" title="ORCA source on GitHub"><Github size={16} /><span>GitHub</span></a>
      <button type="button" className="sh-btn sh-btn--sm theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>
      <DemoTour />
    </header>
  );
}
