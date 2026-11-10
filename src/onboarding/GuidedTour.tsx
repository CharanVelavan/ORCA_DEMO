import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';
import { JOURNEY, TOUR_STEPS } from './steps';
import './onboarding.css';

export function GuidedTour() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [index, setIndex] = useState<number | null>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const [cardSize, setCardSize] = useState({ width: 440, height: 360 });
  const step = index === null ? null : TOUR_STEPS[index];
  const close = () => { setIndex(null); setBox(null); dialog.current?.close(); launcher.current?.focus(); };
  const move = (next: number) => {
    if (next >= TOUR_STEPS.length) { close(); return; }
    setIndex(next);
    navigate(`${TOUR_STEPS[next].route}${search}`);
  };
  useEffect(() => {
    if (!step) return;
    dialog.current?.showModal();
    setBox(null);
    let frame = 0;
    const measure = () => {
      let target = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (target && (target.offsetHeight > window.innerHeight * .6 || target.offsetWidth > window.innerWidth * .85)) target = target.querySelector<HTMLElement>('h1, h2, h3') ?? target;
      if (target) {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        const rect = target.getBoundingClientRect();
        setBox(rect.width && rect.height ? rect : null);
      }
    };
    frame = requestAnimationFrame(measure);
    const observer = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); });
    observer.observe(document.getElementById('main-content') ?? document.body, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [step, pathname]);
  useEffect(() => {
    if (!step || !card.current) return;
    const measure = () => { const rect = card.current?.getBoundingClientRect(); if (rect) setCardSize(previous => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height }); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [step]);
  const cardStyle = (() => {
    if (!box) return undefined;
    const width = Math.min(cardSize.width, window.innerWidth - 32);
    const height = Math.min(cardSize.height, window.innerHeight - 32);
    const margin = 16;
    const choices = [
      { left: box.right + margin, top: box.top, space: window.innerWidth - box.right, fits: window.innerWidth - box.right >= width + margin },
      { left: box.left - width - margin, top: box.top, space: box.left, fits: box.left >= width + margin },
      { left: box.left, top: box.bottom + margin, space: window.innerHeight - box.bottom, fits: window.innerHeight - box.bottom >= height + margin },
      { left: box.left, top: box.top - height - margin, space: box.top, fits: box.top >= height + margin },
    ];
    const candidate = choices.find(choice => choice.fits) ?? choices.sort((a,b) => b.space - a.space)[0];
    return { left: Math.max(margin, Math.min(window.innerWidth - width - margin, candidate.left)), top: Math.max(margin, Math.min(window.innerHeight - height - margin, candidate.top)), right: 'auto', bottom: 'auto' };
  })();
  // Escape closes the native modal and returns focus to the launch control.
  return <>
    <button ref={launcher} type="button" className="sh-btn sh-btn--sm tour-launch" onClick={() => move(0)}><Compass size={15} /> Guided tour</button>
    <dialog ref={dialog} className="tour-dialog" onCancel={(event) => { event.preventDefault(); close(); }} aria-labelledby="tour-title" aria-describedby="tour-description">
      {step && <>
        {box && <div className="tour-spotlight" aria-hidden="true" style={{ left: Math.max(0, box.left - 4), top: Math.max(0, box.top - 4), width: box.width + 8, height: box.height + 8 }} />}
        <section ref={card} className="tour-card" style={cardStyle}>
          <div className="tour-card__head"><span>Dashboard tour · {index! + 1} / {TOUR_STEPS.length}</span><button type="button" aria-label="Close tour" onClick={close}><X size={20} /></button></div>
          <p className="tour-location">{JOURNEY.find((item) => item.route === step.route)?.label}</p>
          <h2 id="tour-title">{step.title}</h2>
          <p id="tour-description">{step.body}</p>
          <p className="tour-note">Tour only · no exercise actions are executed.</p>
          <div className="tour-progress" aria-hidden="true">{TOUR_STEPS.map((_, i) => <span key={i} className={i <= index! ? 'is-reached' : ''} />)}</div>
          <div className="tour-actions"><button type="button" className="sh-btn sh-btn--sm" disabled={index === 0} onClick={() => move(index! - 1)}><ArrowLeft size={14} /> Back</button><button type="button" className="sh-btn sh-btn--sm" onClick={close}>Skip tour</button><button type="button" className="sh-btn sh-btn--sm sh-btn--primary" onClick={() => move(index! + 1)}>{index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}<ArrowRight size={14} /></button></div>
        </section>
      </>}
    </dialog>
  </>;
}
