import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Disc3, FileCheck2, LogOut, Package, Volume2, VolumeX, UsersRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Landing.css';

const stories = [
  { eyebrow: 'The operating system for independent labels', title: 'LNKUP', summary: 'One connected workspace for your artists, music, releases, campaigns, contracts, finances, and files.', label: 'Label operations', detail: 'Your whole label. Finally in sync.', icon: Disc3, position: 'center center' },
  { eyebrow: 'Music, metadata and ownership', title: 'RELEASE', summary: 'Move every record from first session to validated rights, distribution, marketing, and post-release reporting.', label: 'Catalog & rights', detail: 'Built for release-ready music.', icon: FileCheck2, position: '42% center' },
  { eyebrow: 'Finance and performance', title: 'ROYALTY', summary: 'Follow income, expenses, budgets, balances, royalty statements, tax dates, and performance with clarity.', label: 'Clear numbers', detail: 'Every dollar has a story.', icon: BarChart3, position: '64% center' },
  { eyebrow: 'Artist development', title: 'GROWTH', summary: 'Turn goals into progress with development plans, scorecards, tasks, campaigns, contacts, and shared files.', label: 'People & progress', detail: 'Build careers, not admin.', icon: UsersRound, position: 'right center' },
];

// Warm ambient chord progressions (Fmaj9 -> Em7 -> Dm9 -> Cmaj9) in Hz
const AMBIENT_CHORDS: number[][] = [
  [174.61, 220.0, 261.63, 329.63, 392.0],  // Fmaj9
  [164.81, 196.0, 246.94, 293.66, 392.0],  // Em7(add11)
  [146.83, 174.61, 220.0, 261.63, 329.63], // Dm9
  [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
];

const CHIME_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C5 pentatonic

interface CalmSynthController {
  start: () => Promise<boolean>;
  setMuted: (muted: boolean) => void;
  stop: () => void;
}

function createCalmAmbientSynth(): CalmSynthController {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let chordTimer: number | null = null;
  let chimeTimer: number | null = null;
  let chordIndex = 0;
  let isMuted = true;
  let loopsStarted = false;

  const playPadChord = (freqs: number[]) => {
    if (!ctx || !masterGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const duration = 7.5;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(980, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);
    filter.Q.value = 0.7;

    const chordGain = ctx.createGain();
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.linearRampToValueAtTime(0.16, now + 2.2);
    chordGain.gain.setValueAtTime(0.16, now + duration - 2.6);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(chordGain);
    chordGain.connect(masterGain);

    freqs.forEach((freq, idx) => {
      if (!ctx) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const voiceGain = ctx.createGain();

      osc1.type = idx === 0 ? 'sine' : 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 1.003, now);

      voiceGain.gain.value = idx === 0 ? 0.28 : 0.16;
      osc1.connect(voiceGain);
      osc2.connect(voiceGain);
      voiceGain.connect(filter);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.1);
      osc2.stop(now + duration + 0.1);
    });
  };

  const playSoftChime = () => {
    if (!ctx || !masterGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const freq = CHIME_NOTES[Math.floor(Math.random() * CHIME_NOTES.length)];

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 3.7);
  };

  const ensureLoops = () => {
    if (loopsStarted) return;
    loopsStarted = true;
    playPadChord(AMBIENT_CHORDS[chordIndex]);
    chordIndex = (chordIndex + 1) % AMBIENT_CHORDS.length;

    chordTimer = window.setInterval(() => {
      playPadChord(AMBIENT_CHORDS[chordIndex]);
      chordIndex = (chordIndex + 1) % AMBIENT_CHORDS.length;
    }, 6400);

    chimeTimer = window.setInterval(() => {
      if (Math.random() > 0.25) playSoftChime();
    }, 2800);
  };

  return {
    start: async () => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return false;
        if (!ctx) {
          ctx = new AudioCtx();
          masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(isMuted ? 0.0001 : 0.42, ctx.currentTime);

          const delay = ctx.createDelay(2.0);
          delay.delayTime.value = 0.42;
          const feedback = ctx.createGain();
          feedback.gain.value = 0.28;
          const delayFilter = ctx.createBiquadFilter();
          delayFilter.type = 'lowpass';
          delayFilter.frequency.value = 900;

          masterGain.connect(ctx.destination);
          masterGain.connect(delay);
          delay.connect(delayFilter);
          delayFilter.connect(feedback);
          feedback.connect(delay);
          delayFilter.connect(ctx.destination);
        }

        ensureLoops();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (ctx.state === 'running') {
          if (masterGain && !isMuted) {
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.8);
          }
          playPadChord(AMBIENT_CHORDS[chordIndex]);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    setMuted: (muted: boolean) => {
      isMuted = muted;
      if (!ctx || !masterGain) return;
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
      if (muted) {
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      } else {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        masterGain.gain.linearRampToValueAtTime(0.45, now + 0.6);
      }
    },
    stop: () => {
      loopsStarted = false;
      if (chordTimer) window.clearInterval(chordTimer);
      if (chimeTimer) window.clearInterval(chimeTimer);
      chordTimer = null;
      chimeTimer = null;
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
        masterGain = null;
      }
    },
  };
}

const Landing: React.FC = () => {
  const { user, logout } = useAuth();
  const [active, setActive] = useState(0);
  // Web Audio starts only after the visitor deliberately presses the control.
  const [isPlayingMode, setIsPlayingMode] = useState(false);
  const synthRef = useRef<CalmSynthController | null>(null);

  const move = (direction: number) => setActive((current) => (current + direction + stories.length) % stories.length);

  useEffect(() => () => synthRef.current?.stop(), []);

  const toggleCalmAudio = async () => {
    const nextPlaying = !isPlayingMode;
    setIsPlayingMode(nextPlaying);

    if (nextPlaying) {
      const synth = synthRef.current || createCalmAmbientSynth();
      synthRef.current = synth;
      if (synth) {
        synth.setMuted(false);
        const started = await synth.start();
        if (!started) setIsPlayingMode(false);
      }
    } else {
      synthRef.current?.setMuted(true);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => move(1), 5000);
    return () => window.clearTimeout(timer);
  }, [active]);

  const story = stories[active];
  const initials = String(user?.name||'Customer').split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase();
  return (
    <main className="grow-landing">
      <section className="grow-stage" aria-label="HoodBoy Entertainment Lnkup platform" style={{ '--hero-position': story.position } as React.CSSProperties}>
        <div className="grow-stage-photo" aria-hidden="true" />
        <div className="grow-grain" aria-hidden="true" />

        <header className="grow-nav">
          <Link className="grow-brand" to="/" aria-label="HoodBoy Entertainment home">
            <img src="/logo-160.png" alt="" width="160" height="160" decoding="async" />
            <span><strong>HoodBoy Entertainment</strong><small>Lnkup platform</small></span>
          </Link>
          <div className="grow-nav-actions">
            <button
              type="button"
              onClick={toggleCalmAudio}
              className={`grow-audio-toggle ${isPlayingMode ? 'is-playing' : ''}`}
              aria-label={isPlayingMode ? 'Mute AI calm studio music' : 'Play AI calm studio music'}
              title={isPlayingMode ? 'Mute AI Calm Music' : 'Play AI Calm Music'}
            >
              {isPlayingMode ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{isPlayingMode ? 'Calm Music · Playing' : 'Play Calm Music'}</span>
              {isPlayingMode && (
                <span className="grow-audio-bars" aria-hidden="true">
                  <i /><i /><i />
                </span>
              )}
            </button>
            {user?<div className="grow-customer-session"><Link className="grow-customer-profile" to={user.role==='customer'?'/linkup/bookings':'/linkup'} aria-label={user.role==='customer'?`Open ${user.name}'s bookings`:`Open ${user.name}'s Linkup profile`}>{user.avatar?<img src={user.avatar} alt="" referrerPolicy="no-referrer"/>:<span>{initials}</span>}<span className="grow-customer-copy"><strong>{user.name}</strong><small>{user.role==='customer'?'My bookings':'Signed in'}</small></span></Link><button type="button" className="grow-logout" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={14}/><span>Sign out</span></button></div>:<Link className="grow-login" to="/login">Sign in <ArrowUpRight size={14} /></Link>}
          </div>
        </header>

        <button className="grow-side-arrow grow-side-arrow-left" type="button" onClick={() => move(-1)} aria-label="Previous story"><ArrowLeft size={18} /></button>
        <button className="grow-side-arrow grow-side-arrow-right" type="button" onClick={() => move(1)} aria-label="Next story"><ArrowRight size={18} /></button>

        <div className="grow-copy" aria-live="polite">
          <p className="grow-eyebrow" key={`eyebrow-${active}`}>{story.eyebrow}</p>
          <div className="grow-title-wrap">
            <h1 key={`title-${active}`}>{story.title}</h1>
          </div>
          <p className="grow-summary" key={`summary-${active}`}>{story.summary}</p>
          <div className="grow-cta-row"><Link className="grow-cta" to="/linkup">Browse events <ArrowUpRight size={16} /></Link><Link className="grow-cta grow-cta-secondary" to="/linkup/packages">View packages <Package size={15} /></Link></div>
        </div>

        <aside className="grow-discovery" aria-label="Explore Linkup events and packages">
          <p className="grow-discovery-kicker">Live entertainment</p><h2>Choose your experience</h2><p className="grow-discovery-intro">Reserve seats, compare packages, and complete your night with food and drinks.</p>
          <Link to="/linkup" className="grow-discovery-card"><span className="grow-discovery-icon"><CalendarDays size={18}/></span><span><small>Upcoming</small><strong>Browse live events</strong></span><ArrowRight size={17}/></Link>
          <Link to="/linkup/packages" className="grow-discovery-card grow-discovery-card-featured"><span className="grow-discovery-icon"><Package size={18}/></span><span><small>Seating · food · drinks</small><strong>Explore packages</strong></span><ArrowRight size={17}/></Link>
        </aside>

        <div className="grow-bottom">
          <div className="grow-topics" aria-label="Platform coverage"><span>Artists</span><i /><span>Catalog</span><i /><span>Rights</span><i /><span>Royalties</span></div>
          <div className="grow-pagination">
            <span className="grow-current">0{active + 1}</span>
            <div className="grow-dots" role="tablist" aria-label="Platform stories">
              {stories.map((item, index) => <button key={item.title} type="button" role="tab" aria-label={`Show ${item.title}`} aria-selected={active === index} className={active === index ? 'is-active' : ''} onClick={() => setActive(index)} />)}
            </div>
            <span>/ 0{stories.length}</span>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Landing;
