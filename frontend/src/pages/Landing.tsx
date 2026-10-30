import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Disc3, FileCheck2, Play, Volume2, VolumeX, UsersRound } from 'lucide-react';
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
  let isMuted = false;
  let running = false;

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
      osc2.frequency.setValueAtTime(freq * 1.003, now); // gentle warm chorus detune

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

  const startLoops = () => {
    if (running) return;
    running = true;
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
          masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);

          // Subtle stereo feedback delay for warm studio space
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

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (ctx.state !== 'running') return false;

        if (masterGain && !isMuted) {
          masterGain.gain.cancelScheduledValues(ctx.currentTime);
          masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 1.2);
        }
        startLoops();
        return true;
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
        masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      } else {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        masterGain.gain.linearRampToValueAtTime(0.45, now + 0.8);
      }
    },
    stop: () => {
      running = false;
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
  const [active, setActive] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [userMuted, setUserMuted] = useState(false);
  const synthRef = useRef<CalmSynthController | null>(null);

  const move = (direction: number) => setActive((current) => (current + direction + stories.length) % stories.length);

  useEffect(() => {
    const synth = createCalmAmbientSynth();
    synthRef.current = synth;
    let unlocked = false;

    const tryAutoStart = async () => {
      if (unlocked) return;
      const started = await synth.start();
      if (started) {
        unlocked = true;
        setAudioPlaying(true);
      }
    };

    // Attempt immediate playback on mount; if browser autoplay policy requires a gesture,
    // automatically start on the very first click, key press, or touch on the home page.
    tryAutoStart();
    const onFirstGesture = () => {
      if (!unlocked) tryAutoStart();
    };
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    window.addEventListener('keydown', onFirstGesture, { passive: true });
    window.addEventListener('touchstart', onFirstGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      window.removeEventListener('touchstart', onFirstGesture);
      synth.stop();
    };
  }, []);

  const toggleCalmAudio = async () => {
    const synth = synthRef.current;
    if (!synth) return;
    if (!audioPlaying) {
      const ok = await synth.start();
      if (ok) {
        synth.setMuted(false);
        setUserMuted(false);
        setAudioPlaying(true);
      }
      return;
    }
    const nextMuted = !userMuted;
    synth.setMuted(nextMuted);
    setUserMuted(nextMuted);
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
  const StoryIcon = story.icon;
  const isAudible = audioPlaying && !userMuted;

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
              className={`grow-audio-toggle ${isAudible ? 'is-playing' : ''}`}
              aria-label={isAudible ? 'Mute AI calm studio music' : 'Play AI calm studio music'}
              title={isAudible ? 'Mute AI Calm Music' : 'Play AI Calm Music'}
            >
              {isAudible ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{isAudible ? 'AI Calm Music · On' : 'AI Calm Music · Off'}</span>
              {isAudible && (
                <span className="grow-audio-bars" aria-hidden="true">
                  <i /><i /><i />
                </span>
              )}
            </button>
            <Link className="grow-login" to="/login">Sign in <ArrowUpRight size={14} /></Link>
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
          <Link className="grow-cta" to="/login">Enter the platform <ArrowUpRight size={16} /></Link>
        </div>

        <div className="grow-preview" aria-label={`${story.label}: ${story.detail}`}>
          <span className="grow-preview-photo" style={{ backgroundPosition: story.position }} aria-hidden="true" />
          <span className="grow-preview-shade" aria-hidden="true" />
          <span className="grow-preview-copy"><small>{story.label}</small><strong>{story.detail}</strong></span>
          <span className="grow-preview-icon" aria-hidden="true"><StoryIcon size={14} /></span>
          <button type="button" className="grow-play" onClick={() => move(1)} aria-label="Show next platform story"><Play size={14} fill="currentColor" /></button>
        </div>

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
