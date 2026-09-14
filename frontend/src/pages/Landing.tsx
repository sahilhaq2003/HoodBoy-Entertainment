import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Disc3,
  FileCheck2,
  UsersRound,
} from 'lucide-react';
import './Landing.css';

const experiences = [
  {
    kicker: 'One connected label workspace',
    title: <>Your label,<br />in sync.</>,
    summary: 'Bring artists, catalog, releases, campaigns, contracts, finances, and files into one secure operating system.',
    cardKicker: 'Label operations',
    cardTitle: 'One workspace',
    icon: Disc3,
    position: 'center center',
  },
  {
    kicker: 'Music, metadata & ownership',
    title: <>From sound<br />to release.</>,
    summary: 'Move every record from song and metadata to ownership approval, distribution, marketing, and post-release reporting.',
    cardKicker: 'Catalog & rights',
    cardTitle: 'Release ready',
    icon: FileCheck2,
    position: '38% center',
  },
  {
    kicker: 'Finance & performance',
    title: <>Know every<br />number.</>,
    summary: 'Track income, expenses, budgets, artist balances, royalty statements, tax dates, and performance in one clear view.',
    cardKicker: 'Finance & royalties',
    cardTitle: 'Clear numbers',
    icon: BarChart3,
    position: '62% center',
  },
  {
    kicker: 'Artist development',
    title: <>Build careers,<br />not admin.</>,
    summary: 'Give your team the plans, scorecards, tasks, campaigns, contacts, and shared files they need to move artists forward.',
    cardKicker: 'People & progress',
    cardTitle: 'Built to grow',
    icon: UsersRound,
    position: 'right center',
  },
];

const Landing: React.FC = () => {
  const [active, setActive] = useState(0);

  const move = (direction: number) => {
    setActive((current) => (current + direction + experiences.length) % experiences.length);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selected = experiences[active];

  return (
    <main className="landing-shell">
      <section
        className="landing-stage"
        aria-label="Lnkup label management platform"
        style={{ '--landing-bg-position': selected.position } as React.CSSProperties}
      >
        <div className="landing-photo" aria-hidden="true" />
        <div className="landing-noise" aria-hidden="true" />

        <header className="landing-nav">
          <Link className="landing-brand" to="/" aria-label="HoodBoy Entertainment home">
            <img src="/logo.png" alt="" />
            <span>
              <strong>HoodBoy Entertainment</strong>
              <small>Lnkup Platform</small>
            </span>
          </Link>

          <div className="landing-nav-actions">
            <Link className="landing-signin" to="/login">Sign in <ArrowUpRight size={14} /></Link>
          </div>
        </header>

        <div className="landing-content" id="platform">
          <div className="landing-intro" aria-live="polite">
            <p className="landing-kicker"><span />{selected.kicker}</p>
            <h1 key={`title-${active}`}>{selected.title}</h1>
            <p className="landing-summary" key={`summary-${active}`}>{selected.summary}</p>
            <Link className="landing-primary-action" to="/login">
              <span>Enter the platform</span>
              <ArrowUpRight size={17} />
            </Link>
          </div>

          <div className="landing-carousel" id="capabilities">
            <div className="landing-cards" role="tablist" aria-label="Platform capabilities">
              {experiences.map((experience, index) => {
                const Icon = experience.icon;
                return (
                  <button
                    key={experience.cardTitle}
                    type="button"
                    role="tab"
                    aria-selected={active === index}
                    className={active === index ? 'landing-card is-active' : 'landing-card'}
                    onClick={() => setActive(index)}
                  >
                    <span className="landing-card-image" style={{ backgroundPosition: experience.position }} aria-hidden="true" />
                    <span className="landing-card-shade" aria-hidden="true" />
                    <span className="landing-card-icon"><Icon size={17} /></span>
                    <span className="landing-card-copy">
                      <small>{experience.cardKicker}</small>
                      <strong>{experience.cardTitle}</strong>
                    </span>
                    <span className="landing-card-index">0{index + 1}</span>
                  </button>
                );
              })}
            </div>

            <div className="landing-controls" id="workflow">
              <div className="landing-arrow-group">
                <button type="button" onClick={() => move(-1)} aria-label="Previous capability"><ArrowLeft size={18} /></button>
                <button type="button" onClick={() => move(1)} aria-label="Next capability"><ArrowRight size={18} /></button>
              </div>
              <div className="landing-progress" aria-hidden="true">
                {experiences.map((_, index) => <span key={index} className={active === index ? 'is-active' : ''} />)}
              </div>
              <div className="landing-count"><strong>0{active + 1}</strong><span>/ 0{experiences.length}</span></div>
            </div>
          </div>
        </div>

        <footer className="landing-footer" id="about">
          <span>Artist → Song → Release → Revenue → Royalty</span>
          <span>© 2026 HoodBoy Entertainment</span>
        </footer>
      </section>
    </main>
  );
};

export default Landing;
