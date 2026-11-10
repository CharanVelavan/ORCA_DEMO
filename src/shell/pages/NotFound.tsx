/** In-frame 404 — rendered under <Shell/> so the top nav and stepper stay. */
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { NAV } from '../TopNav';

export default function NotFound() {
  return (
    <main className="sh-notfound">
      <h1 className="sh-notfound__title"><Compass size={22} strokeWidth={2} /> Page not found</h1>
      <p className="sh-notfound__sub">That route isn’t part of the console. Pick a view:</p>
      <nav className="sh-notfound__links">
        {NAV.map((n) => <Link key={n.to} to={n.to} className="sh-notfound__link">{n.label}</Link>)}
      </nav>
    </main>
  );
}
