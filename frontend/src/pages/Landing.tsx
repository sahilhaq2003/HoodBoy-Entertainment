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

/**
 * Generates an in-memory seamless calm ambient WAV blob URL so <audio autoPlay loop>
 * can begin playing immediately on page load in browsers that allow media element autoplay.
 */
function buildCalmLoopBlobUrl(): string {
  const sampleRate = 22050;
  const durationSec = 16; // 4 chords x 4 seconds each, seamless loop
  const numSamples = sampleRate * durationSec;
  const numChannels = 2;
  const dataSize = numSamples * numChannels * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const chordLen = sampleRate * 4;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cIdx = Math.floor(i / chordLen) % AMBIENT_CHORDS.length;
    const posInChord = (i % chordLen) / chordLen; // 0..1
    // Smooth sine-squared envelope per chord so transitions are silky smooth
    const env = 0.25 + 0.75 * Math.sin(Math.PI * posInChord) ** 2;
    const chord = AMBIENT_CHORDS[cIdx];

    let left = 0;
    let right = 0;
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n];
      const w = n === 0 ? 0.32 : 0.16;
      left += Math.sin(2 * Math.PI * f * t) * w;
      right += Math.sin(2 * Math.PI * (f * 1.002) * t + 0.4) * w;
    }
    // Gentle high chime note every 2 seconds
    const chimePos = (t % 2) / 2;
    const chimeFreq = CHIME_NOTES[(cIdx * 2 + Math.floor(t / 2)) % CHIME_NOTES.length];
    const chimeEnv = Math.exp(-chimePos * 5.5) * Math.min(1, chimePos * 35) * 0.08;
    const chime = Math.sin(2 * Math.PI * chimeFreq * t) * chimeEnv;

    const lSample = Math.max(-1, Math.min(1, (left * env * 0.35 + chime)));
    const rSample = Math.max(-1, Math.min(1, (right * env * 0.35 + chime)));
    const offset = 44 + i * 4;
    view.setInt16(offset, Math.round(lSample * 28000), true);
    view.setInt16(offset + 2, Math.round(rSample * 28000), true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

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
  const [active, setActive] = useState(0);
  // Default is PLAYING mode (On / unmuted)
  const [isPlayingMode, setIsPlayingMode] = useState(true);
  const synthRef = useRef<CalmSynthController | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingModeRef = useRef(true);

  const move = (direction: number) => setActive((current) => (current + direction + stories.length) % stories.length);

  useEffect(() => {
    const synth = createCalmAmbientSynth();
    synthRef.current = synth;

    // Create an in-memory <audio autoPlay loop> fallback so browsers that permit HTMLMediaElement
    // autoplay start playing immediately on page open, and switch seamlessly to the Web Audio synth.
    const blobUrl = buildCalmLoopBlobUrl();
    const audioEl = new Audio(blobUrl);
    audioEl.loop = true;
    audioEl.volume = 0.45;
    audioEl.autoplay = true;
    audioElRef.current = audioEl;

    let webAudioActive = false;

    const tryStartAudio = async () => {
      if (!isPlayingModeRef.current) return;
      if (!webAudioActive) {
        const started = await synth.start();
        if (started) {
          webAudioActive = true;
          audioEl.pause();
          return;
        }
      }
      if (audioEl.paused && isPlayingModeRef.current) {
        audioEl.play().catch(() => {});
      }
    };

    tryStartAudio();

    const unlockEvents = ['pointerdown', 'pointermove', 'mousemove', 'wheel', 'touchstart', 'keydown', 'click'];
    const onUnlock = () => {
      if (!isPlayingModeRef.current) return;
      if (!webAudioActive) {
        synth.start().then((ok) => {
          if (ok) {
            webAudioActive = true;
            audioEl.pause();
          } else if (audioEl.paused) {
            audioEl.play().catch(() => {});
          }
        });
      }
    };

    unlockEvents.forEach((evt) => window.addEventListener(evt, onUnlock, { passive: true }));

    return () => {
      unlockEvents.forEach((evt) => window.removeEventListener(evt, onUnlock));
      audioEl.pause();
      audioElRef.current = null;
      URL.revokeObjectURL(blobUrl);
      synth.stop();
    };
  }, []);

  const toggleCalmAudio = async () => {
    const nextPlaying = !isPlayingMode;
    isPlayingModeRef.current = nextPlaying;
    setIsPlayingMode(nextPlaying);

    const synth = synthRef.current;
    const audioEl = audioElRef.current;

    if (nextPlaying) {
      if (synth) {
        synth.setMuted(false);
        const ok = await synth.start();
        if (ok) {
          audioEl?.pause();
          return;
        }
      }
      if (audioEl) {
        audioEl.muted = false;
        audioEl.play().catch(() => {});
      }
    } else {
      synth?.setMuted(true);
      if (audioEl) {
        audioEl.pause();
      }
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
  const StoryIcon = story.icon;

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
              <span>{isPlayingMode ? 'AI Calm Music · Playing' : 'AI Calm Music · Muted'}</span>
              {isPlayingMode && (
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
