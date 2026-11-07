import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  Calendar,
  Check,
  MapPin,
  Package,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { linkupPlatformApi } from "../services/api";
import LinkupHeader from "../components/linkup/LinkupHeader";
import LinkupPageLoader from "../components/linkup/LinkupPageLoader";
import { formatEventSchedule } from "../utils/eventTime";

type AnyRecord = Record<string, any>;
const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(amount || 0),
  );

const LinkupPackages: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState(
    searchParams.get("event") || "",
  );

  useEffect(() => {
    (async () => {
      try {
        const loaded = (await linkupPlatformApi.publicEvents()).data.data || [];
        setEvents(loaded);
        if (
          selectedEventId &&
          !loaded.some(
            (event: AnyRecord) => String(event._id) === selectedEventId,
          )
        ) {
          setSelectedEventId("");
          setSearchParams({}, { replace: true });
        }
      } catch {
        toast.error("Unable to load events and packages");
      }
      setLoading(false);
    })();
  }, []);

  const selectedEvent = useMemo(
    () => events.find((event) => String(event._id) === selectedEventId),
    [events, selectedEventId],
  );
  const packages = useMemo(
    () =>
      (selectedEvent?.packages || []).filter(
        (pkg: AnyRecord) => type === "all" || pkg.packageType === type,
      ),
    [selectedEvent, type],
  );
  const selectEvent = (event: AnyRecord) => {
    setSelectedEventId(String(event._id));
    setType("all");
    setSearchParams({ event: String(event._id) });
    window.setTimeout(
      () =>
        document
          .getElementById("event-packages")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  if (loading) return <LinkupPageLoader variant="packages" />;

  return (
    <div className="linkup-content-ready min-h-screen bg-slate-950 text-white">
      <LinkupHeader />
      <section className="border-b border-white/10 bg-gradient-to-br from-violet-950/70 via-slate-950 to-fuchsia-950/30">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-16">
          <button
            onClick={() => navigate("/linkup")}
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            <ArrowLeft size={16} /> Back to events
          </button>
          <div className="mt-8 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[.22em] text-violet-300">
              Event-first booking
            </p>
            <h1 className="mt-3 text-4xl font-black md:text-6xl">
              BUILD YOUR NIGHT
            </h1>
            <p className="mt-4 text-lg text-slate-300">
              Choose the event you want to attend first. We will then show only
              the packages, seating and experiences available for that event.
            </p>
          </div>
          <div className="mt-9 flex max-w-2xl items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-600">
                1
              </span>
              Select event
            </div>
            <span className="h-px flex-1 bg-white/15" />
            <div
              className={`flex items-center gap-2 text-sm font-bold ${selectedEvent ? "text-white" : "text-slate-500"}`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-full ${selectedEvent ? "bg-fuchsia-600" : "bg-white/10"}`}
              >
                2
              </span>
              Choose package
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5 py-12">
        <section aria-labelledby="select-event-heading">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-violet-400">
                Step 1
              </p>
              <h2
                id="select-event-heading"
                className="mt-1 text-2xl font-black md:text-3xl"
              >
                Which event are you attending?
              </h2>
            </div>
            {selectedEvent && (
              <button
                onClick={() => {
                  setSelectedEventId("");
                  setSearchParams({});
                }}
                className="text-sm font-bold text-violet-300 hover:text-white"
              >
                Change selection
              </button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => {
              const active = String(event._id) === selectedEventId;
              return (
                <button
                  key={event._id}
                  onClick={() => selectEvent(event)}
                  className={`group overflow-hidden rounded-2xl border text-left transition ${active ? "border-violet-400 bg-violet-500/10 shadow-xl shadow-violet-950/30 ring-2 ring-violet-500/30" : "border-white/10 bg-slate-900 hover:-translate-y-0.5 hover:border-violet-400/50"}`}
                >
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-violet-900 to-slate-900">
                    {event.banner ? (
                      <img
                        src={event.banner}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <Calendar size={40} className="text-white/25" />
                      </div>
                    )}
                    <span
                      className={`absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border backdrop-blur ${active ? "border-violet-300 bg-violet-600 text-white" : "border-white/15 bg-slate-950/60 text-transparent"}`}
                    >
                      <Check size={16} />
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-extrabold">{event.title}</h3>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} className="text-violet-400" />
                        {formatEventSchedule(event)}
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin size={14} className="text-violet-400" />
                        {event.venueName || event.location}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-xs font-bold text-slate-300">
                        {event.packages?.length || 0} package
                        {event.packages?.length === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-bold text-violet-300">
                        {active ? "Selected" : "Select event"}{" "}
                        <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!loading && !events.length && (
            <div className="rounded-2xl border border-white/10 bg-slate-900 py-20 text-center text-slate-400">
              No upcoming events are currently available.
            </div>
          )}
        </section>

        <section
          id="event-packages"
          className="scroll-mt-28 pt-14"
          aria-labelledby="packages-heading"
        >
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-400">
              Step 2
            </p>
            <h2
              id="packages-heading"
              className="mt-1 text-2xl font-black md:text-3xl"
            >
              {selectedEvent
                ? `Packages for ${selectedEvent.title}`
                : "Select an event to view packages"}
            </h2>
            {selectedEvent && (
              <p className="mt-2 text-sm text-slate-400">
                Every option below is connected to your selected event and its
                available inventory.
              </p>
            )}
          </div>
          {!selectedEvent ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[.025] px-5 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
                <Calendar size={25} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold">
                Choose an event first
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Package availability, seating, food and pricing are unique to
                each event.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap gap-2">
                {[
                  ["all", "All packages"],
                  ["predefined", "Ready-made"],
                  ["customizable", "Customizable"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setType(value)}
                    className={`rounded-full border px-4 py-2 text-sm font-bold transition ${type === value ? "border-violet-500 bg-violet-600 text-white" : "border-white/15 text-slate-300 hover:border-white/30"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg: AnyRecord) => (
                  <article
                    key={pkg._id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-black/10"
                  >
                    <div className="h-48 overflow-hidden bg-gradient-to-br from-violet-800/70 to-fuchsia-950">
                      {pkg.image ? (
                        <img
                          src={pkg.image}
                          alt={pkg.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package size={54} className="text-white/30" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <div className="text-xs font-bold uppercase tracking-wide text-violet-300">
                        {pkg.packageType}
                      </div>
                      <h3 className="mt-2 text-xl font-bold">{pkg.name}</h3>
                      <p className="mt-2 min-h-10 text-sm text-slate-400 line-clamp-2">
                        {pkg.description}
                      </p>
                      <div className="mt-5 space-y-2 text-sm text-slate-300">
                        <div className="flex gap-2">
                          <Calendar size={15} />
                          {formatEventSchedule(selectedEvent)}{" "}
                          · {selectedEvent.title}
                        </div>
                        <div className="flex gap-2">
                          <MapPin size={15} />
                          {selectedEvent.venueName || selectedEvent.location}
                        </div>
                        <div className="flex gap-2">
                          <Armchair size={15} />
                          {pkg.seating?.name || "Reserved seating"}
                        </div>
                        <div className="flex gap-2">
                          <Users size={15} />
                          {pkg.seatingCapacity ||
                            pkg.seating?.capacity ||
                            1}{" "}
                          guests · {pkg.availableQuantity} available
                        </div>
                      </div>
                      <div className="mt-6 flex items-end justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500">
                            {pkg.packageType === "customizable"
                              ? "Starting at"
                              : "Package price"}
                          </div>
                          <div className="text-2xl font-black">
                            {money(
                              pkg.packageType === "predefined"
                                ? pkg.packagePrice
                                : pkg.basePrice || pkg.seating?.price,
                              pkg.currency,
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            navigate(
                              `/linkup/events/${selectedEvent._id}?package=${pkg._id}`,
                            )
                          }
                          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold transition hover:bg-violet-500"
                        >
                          Select package <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!packages.length && (
                <div className="rounded-2xl border border-white/10 bg-slate-900 py-20 text-center text-slate-400">
                  No packages are available for this event in the selected
                  category.
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

export default LinkupPackages;
