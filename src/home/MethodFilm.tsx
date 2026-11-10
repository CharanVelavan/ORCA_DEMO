import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import transcript from './motion/TRANSCRIPT.md?raw';
import './method-film.css';

export function MethodFilm() {
  const [failed, setFailed] = useState(false);
  const [quality, setQuality] = useState<'4k' | 'web'>('4k');
  return <section className="learn-section learn-film" id="learn-film" aria-labelledby="film-title">
    <div className="learn-film__copy"><span className="learn-kicker">The method in motion</span><h2 id="film-title">Follow one incident.<br />See every boundary.</h2><p>A narrated explanation of cyber vigilance, coordinated response and guarded self-healing. The animation illustrates an emulated network; its pacing is not a measured recovery time.</p><a className="learn-text-link" href="/media/orca-method-4k.mp4" download><ArrowDownToLine size={16} />Download the video</a></div>
    <figure><div className="method-film-quality"><label htmlFor="method-film-quality">Playback quality</label><select id="method-film-quality" value={quality} onChange={event => { setQuality(event.target.value as '4k' | 'web'); setFailed(false); }}><option value="4k">4K UHD · 3840 × 2160</option><option value="web">HD · lighter playback</option></select></div><video key={quality} controls playsInline preload="none" poster="/media/orca-method-poster.jpg" width="3840" height="2160" onError={() => setFailed(true)} aria-label="Narrated ORCA-NTN method film. Visible word-highlighted captions, music, sound effects and transcript."><source src={quality === '4k' ? '/media/orca-method-4k.mp4' : '/media/orca-method.mp4'} type="video/mp4" /><track kind="captions" src="/media/orca-method.vtt" srcLang="en" label="English text track" /><p>Your browser cannot play this video. Use the film download or read its transcript.</p></video><figcaption>Google Enceladus · American English · {quality === '4k' ? '4K UHD' : 'HD'} · Live captions · Music &amp; effects</figcaption>{failed && <p className="learn-film__error" role="status">The film could not load. Download it above, or read the complete transcript below.</p>}</figure>
    <details className="learn-film__transcript"><summary>Read the complete film transcript</summary><div>{transcript.split(/\n\s*\n/).filter(p => p.trim() && !p.trim().startsWith('#')).map((p, i) => <p key={i}>{p.trim()}</p>)}</div></details>
  </section>;
}
