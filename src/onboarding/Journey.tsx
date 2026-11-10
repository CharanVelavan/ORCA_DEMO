import { NavLink, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { JOURNEY } from './steps';
export function Journey() {
  const { search } = useLocation();
  return <nav className="journey" aria-label="Suggested dashboard journey">{JOURNEY.map((item, index) => <span key={item.route}>
    {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
    <NavLink to={`${item.route}${search}`} end={item.route === '/'} title={item.detail} className={({ isActive }) => isActive ? 'is-current' : ''}><span className="journey-number">{index + 1}</span>{item.label}</NavLink>
  </span>)}</nav>;
}
