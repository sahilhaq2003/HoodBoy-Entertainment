import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Disc3, FileCheck2, Play, UsersRound } from 'lucide-react';
import './Landing.css';

const stories = [
  { eyebrow: 'The operating system for independent labels', title: 'LNKUP', summary: 'One connected workspace for your artists, music, releases, campaigns, contracts, finances, and files.', label: 'Label operations', detail: 'Your whole label. Finally in sync.', icon: Disc3, position: 'center center' },
  { eyebrow: 'Music, metadata and ownership', title: 'RELEASE', summary: 'Move every record from first session to validated rights, distribution, marketing, and post-release reporting.', label: 'Catalog & rights', detail: 'Built for release-ready music.', icon: FileCheck2, position: '42% center' },
  { eyebrow: 'Finance and performance', title: 'ROYALTY', summary: 'Follow income, expenses, budgets, balances, royalty statements, tax dates, and performance with clarity.', label: 'Clear numbers', detail: 'Every dollar has a story.', icon: BarChart3, position: '64% center' },
  { eyebrow: 'Artist development', title: 'GROWTH', summary: 'Turn goals into progress with development plans, scorecards, tasks, campaigns, contacts, and shared files.', label: 'People & progress', detail: 'Build careers, not admin.', icon: UsersRound, position: 'right center' },
];

const Landing: React.FC = () => {
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + stories.length) % stories.length);

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
            <img src="/logo.png" alt="" />
            <span><strong>HoodBoy Entertainment</strong><small>Lnkup platform</small></span>
          </Link>
          <Link className="grow-login" to="/login">Sign in <ArrowUpRight size={14} /></Link>
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
