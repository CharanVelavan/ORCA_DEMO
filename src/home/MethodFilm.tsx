import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import transcript from './film-transcript.md?raw';
import walkthroughTranscript from './complete-transcript.md?raw';
import './method-film.css';

const films = {
  walkthrough: {
    name: 'Full detailed walkthrough · 4:39', base: '/media/orca-final-clean',
    description: 'A complete S1 walkthrough at 1.5× speed: the emulated attack, detailed flowchart, model evidence, commander decisions, policy findings, guarded recovery and verified audit replay. Mock agents; simulated incident timings. Closing thanks from Solar Sailors, SSN College of Engineering.',
    transcript: walkthroughTranscript,
  },
  method: {
    name: 'ORCA-NTN overview · 1:38', base: '/media/orca-method',
    description: 'A narrated introduction to cyber vigilance, coordination and guarded self-healing. The animation illustrates an emulated network; its pacing is not a measured recovery time.',
    transcript,
  },
} as const;

export function MethodFilm() {
  const [failed, setFailed] = useState(false);
  const [quality, setQuality] = useState<'4k' | 'web'>('4k');
  const [selected, setSelected] = useState<keyof typeof films>('method');
  const film = films[selected];
  return <section className="learn-section learn-film" id="learn-film" aria-labelledby="film-title">
    <div className="learn-film__copy"><span className="learn-kicker">The method in motion</span><h2 id="film-title">Follow one incident.<br />See every boundary.</h2><p>{film.description}</p><a className="learn-text-link" href={`${film.base}-4k.mp4`} download><ArrowDownToLine size={16} />Download the video</a></div>
    <figure>
      <div className="method-film-controls">
        <div className="method-film-quality"><label htmlFor="method-film-selection">Film</label><select id="method-film-selection" value={selected} onChange={event => { setSelected(event.target.value as keyof typeof films); setFailed(false); }}><option value="method">{films.method.name}</option><option value="walkthrough">{films.walkthrough.name}</option></select></div>
        <div className="method-film-quality"><label htmlFor="method-film-quality">Playback quality</label><select id="method-film-quality" value={quality} onChange={event => { setQuality(event.target.value as '4k' | 'web'); setFailed(false); }}><option value="4k">4K UHD · 3840 × 2160</option><option value="web">{selected === 'walkthrough' ? 'Full HD · lighter playback' : 'HD · lighter playback'}</option></select></div>
      </div>
      <video key={`${selected}-${quality}`} controls playsInline preload="none" poster={`${film.base}-poster.jpg`} width="3840" height="2160" onError={() => setFailed(true)} aria-label={`${film.name}. Enceladus narration, visible highlighted captions, music and sound effects.`}><source src={quality === '4k' ? `${film.base}-4k.mp4` : `${film.base}.mp4`} type="video/mp4" /><track kind="captions" src={`${film.base}.vtt`} srcLang="en" label="English text track" /><p>Your browser cannot play this video. Use the film download or read its transcript.</p></video>
      <figcaption>Google Enceladus · American English · {quality === '4k' ? '4K UHD' : selected === 'walkthrough' ? 'Full HD' : 'HD'} · Highlighted captions · Music &amp; effects</figcaption>
      {failed && <p className="learn-film__error" role="status">The film could not load. Download it above, or read the complete transcript below.</p>}
    </figure>
    <details className="learn-film__transcript"><summary>Read the complete film transcript</summary><div>{film.transcript.split(/\n\s*\n/).filter(p => p.trim() && !p.trim().startsWith('#')).map((p, i) => <p key={i}>{p.trim().replace(/^\*\*|\*\*$/g, '')}</p>)}</div></details>
  </section>;
}
