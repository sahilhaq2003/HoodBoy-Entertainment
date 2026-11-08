import React from 'react';

type LoaderVariant = 'events' | 'detail' | 'packages' | 'checkout' | 'bookings';

const labels: Record<LoaderVariant, string> = {
  events: 'Preparing upcoming events',
  detail: 'Preparing event details',
  packages: 'Preparing available packages',
  checkout: 'Preparing secure checkout',
  bookings: 'Loading your bookings',
};

const LinkupPageLoader: React.FC<{ variant?: LoaderVariant }> = ({ variant = 'events' }) => (
  <div className="linkup-loader-enter min-h-screen bg-[#050817] text-white" role="status" aria-live="polite" aria-label={labels[variant]}>
    <div className="border-b border-white/10 bg-[#050817]/95">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl border border-white/10 bg-white/[.06] p-1"><img src="/logo-160.png" alt="" className="h-full w-full object-contain opacity-90"/></span>
          <span><b className="block text-sm sm:text-base">HoodBoy Entertainment</b><small className="block text-[9px] font-bold uppercase tracking-[.2em] text-violet-300">The Lnk Up</small></span>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.04] p-1 md:flex"><span className="h-8 w-20 animate-pulse rounded-full bg-white/[.07]"/><span className="h-8 w-24 animate-pulse rounded-full bg-white/[.05]"/></div>
        <div className="h-10 w-28 animate-pulse rounded-full border border-white/10 bg-white/[.06]"/>
      </div>
    </div>

    <main className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
      <div className="mb-10 flex items-center gap-3 text-sm font-semibold text-violet-200">
        <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70"/><span className="relative inline-flex h-3 w-3 rounded-full bg-violet-400"/></span>
        {labels[variant]}…
      </div>

      {variant === 'events' ? (
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_.8fr]">
          <div className="animate-pulse"><div className="h-3 w-64 rounded-full bg-violet-400/20"/><div className="mt-7 h-14 max-w-xl rounded-xl bg-white/10 sm:h-20"/><div className="mt-4 h-14 max-w-2xl rounded-xl bg-white/[.07] sm:h-20"/><div className="mt-7 h-4 max-w-xl rounded-full bg-white/10"/><div className="mt-3 h-4 max-w-md rounded-full bg-white/[.07]"/><div className="mt-8 flex gap-3"><div className="h-12 w-40 rounded-xl bg-violet-500/25"/><div className="h-12 w-44 rounded-xl bg-white/10"/></div></div>
          <div className="grid animate-pulse gap-4"><div className="h-44 rounded-2xl border border-white/10 bg-white/[.055]"/><div className="h-44 rounded-2xl border border-white/10 bg-white/[.04]"/></div>
        </div>
      ) : variant === 'packages' ? (
        <><div className="max-w-3xl animate-pulse"><div className="h-3 w-40 rounded-full bg-violet-400/20"/><div className="mt-5 h-16 rounded-xl bg-white/10"/><div className="mt-5 h-4 max-w-2xl rounded-full bg-white/[.07]"/></div><div className="mt-14 grid animate-pulse gap-5 md:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(item=><div key={item} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><div className="h-36 bg-violet-500/10"/><div className="space-y-3 p-5"><div className="h-5 w-2/3 rounded bg-white/10"/><div className="h-3 w-full rounded bg-white/[.06]"/><div className="h-3 w-3/4 rounded bg-white/[.06]"/></div></div>)}</div></>
      ) : variant === 'checkout' ? (
        <div className="grid animate-pulse gap-8 lg:grid-cols-[minmax(0,1fr)_400px]"><div className="space-y-5"><div className="h-36 rounded-3xl border border-white/10 bg-violet-500/[.08]"/><div className="h-72 rounded-3xl border border-white/10 bg-white/[.04]"/></div><div className="h-96 rounded-3xl border border-white/10 bg-white/[.055]"/></div>
      ) : variant === 'bookings' ? (
        <><div className="animate-pulse border-b border-white/10 pb-9"><div className="h-3 w-40 rounded-full bg-violet-400/20"/><div className="mt-5 h-14 max-w-md rounded-xl bg-white/10"/><div className="mt-4 h-4 max-w-2xl rounded-full bg-white/[.07]"/></div><div className="mt-8 grid animate-pulse gap-5 lg:grid-cols-2">{[0,1,2,3].map(item=><div key={item} className="h-80 rounded-3xl border border-white/10 bg-white/[.04]"/>)}</div></>
      ) : (
        <><div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-white/[.03]"/><div className="mt-12 grid animate-pulse gap-5 md:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(item=><div key={item} className="h-72 rounded-2xl border border-white/10 bg-white/[.04]"/>)}</div></>
      )}
    </main>
  </div>
);

export default LinkupPageLoader;
