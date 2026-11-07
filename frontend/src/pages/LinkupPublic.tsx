import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Calendar,
  MapPin,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Upload,
  Utensils,
  Wine,
  Armchair,
  Package,
  Mic2,
} from "lucide-react";
import toast from "react-hot-toast";
import { linkupPlatformApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import LinkupHeader from "../components/linkup/LinkupHeader";
import LinkupPageLoader from "../components/linkup/LinkupPageLoader";
import { formatEventSchedule } from "../utils/eventTime";

type AnyRecord = Record<string, any>;
const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(amount || 0),
  );

const LinkupPublic: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPackageId = searchParams.get("package");
  const { user, googleLogin } = useAuth();
  const [events, setEvents] = useState<AnyRecord[]>([]);
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [food, setFood] = useState<Record<string, number>>({});
  const [alcohol, setAlcohol] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState({
    customerName: "",
    email: "",
    phone: "",
    guestCount: 1,
    notes: "",
    ageConfirmed: false,
  });
  const [booking, setBooking] = useState<AnyRecord | null>(null);
  const [artistSlot, setArtistSlot] = useState<AnyRecord | null>(null);
  const [artist, setArtist] = useState({
    artistName: "",
    email: "",
    phone: "",
    performanceCategory: "",
    performanceDescription: "",
    portfolioUrl: "",
  });
  const [receipt, setReceipt] = useState({
    bankAccountId: "",
    transferReference: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
    file: null as File | null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [showGoogleSignIn, setShowGoogleSignIn] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (id) setDetail((await linkupPlatformApi.publicEvent(id)).data.data);
        else
          setEvents((await linkupPlatformApi.publicEvents()).data.data || []);
      } catch {
        toast.error("Unable to load Linkup events");
      }
      setLoading(false);
    })();
  }, [id]);
  useEffect(() => {
    if (user) {
      setShowGoogleSignIn(false);
      setCustomer((current) => ({
        ...current,
        customerName: user.name || "",
        email: user.email || "",
      }));
      setArtist((current) => ({ ...current, email: user.email || "" }));
    }
  }, [user]);

  const openPackage = (pkg: AnyRecord) =>
    navigate(`/linkup/checkout/${pkg._id}`);
  useEffect(() => {
    if (!detail || !requestedPackageId) return;
    const requested = detail.packages?.find(
      (pkg: AnyRecord) => String(pkg._id) === requestedPackageId,
    );
    if (requested) openPackage(requested);
  }, [detail, requestedPackageId]);
  const optionalIds = useMemo(
    () =>
      new Set(
        (selected?.optionalItems || []).map((item: AnyRecord) =>
          String(item.itemId),
        ),
      ),
    [selected],
  );
  const availableFood = (detail?.food || []).filter(
    (item: AnyRecord) => !optionalIds.size || optionalIds.has(String(item._id)),
  );
  const availableAlcohol = (detail?.alcohol || []).filter(
    (item: AnyRecord) => !optionalIds.size || optionalIds.has(String(item._id)),
  );
  const subtotal = useMemo(() => {
    if (!selected) return 0;
    let value = Number(
      selected.packageType === "predefined"
        ? selected.packagePrice
        : selected.basePrice || selected.seating?.price,
    );
    if (selected.packageType === "customizable") {
      for (const item of availableFood)
        value += Number(item.price) * Number(food[item._id] || 0);
      for (const item of availableAlcohol)
        value += Number(item.price) * Number(alcohol[item._id] || 0);
    }
    return value;
  }, [selected, food, alcohol, availableFood, availableAlcohol]);
  const tax = (subtotal * Number(selected?.taxRate || 0)) / 100,
    fee = (subtotal * Number(selected?.serviceFeeRate || 0)) / 100,
    total = subtotal + tax + fee;

  const book = async () => {
    if (!selected) return;
    if (!user) {
      setShowGoogleSignIn(true);
      return;
    }
    if (user.role !== "customer")
      return toast.error("Use a customer Google account to purchase packages");
    if (!customer.phone) return toast.error("Enter your contact number");
    if (
      availableAlcohol.some((item: AnyRecord) => alcohol[item._id] > 0) &&
      !customer.ageConfirmed
    )
      return toast.error("Confirm that you meet the legal age requirement");
    setSubmitting(true);
    try {
      const result = (
        await linkupPlatformApi.bookPackage(selected._id, {
          ...customer,
          paymentMethod: "bank_transfer",
          foodItems: Object.entries(food).map(([itemId, quantity]) => ({
            itemId,
            quantity,
          })),
          alcoholItems: Object.entries(alcohol).map(([itemId, quantity]) => ({
            itemId,
            quantity,
          })),
        })
      ).data.data;
      setBooking(result);
      setReceipt((current) => ({
        ...current,
        bankAccountId: result.bankAccounts?.[0]?._id || "",
      }));
      toast.success("Booking reserved");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Booking could not be completed",
      );
    }
    setSubmitting(false);
  };

  const uploadReceipt = async () => {
    if (
      !booking ||
      !receipt.file ||
      !receipt.bankAccountId ||
      !receipt.transferReference
    )
      return toast.error("Choose an account and attach the transfer receipt");
    const data = new FormData();
    data.append("email", customer.email);
    data.append("bankAccountId", receipt.bankAccountId);
    data.append("transferReference", receipt.transferReference);
    data.append("paymentDate", receipt.paymentDate);
    data.append("notes", receipt.notes);
    data.append("receipt", receipt.file);
    setSubmitting(true);
    try {
      const response = await linkupPlatformApi.submitReceipt(
        booking.booking.bookingReference,
        data,
      );
      toast.success(response.data.message);
      setBooking({ ...booking, submitted: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Receipt upload failed");
    }
    setSubmitting(false);
  };
  const applyForSlot = async () => {
    if (!user) {
      setShowGoogleSignIn(true);
      return;
    }
    if (
      !artistSlot ||
      Object.entries(artist).some(
        ([key, value]) => key !== "portfolioUrl" && !value,
      )
    )
      return toast.error("Complete all required artist details");
    setSubmitting(true);
    try {
      const result = (
        await linkupPlatformApi.bookSlot(artistSlot._id, {
          ...artist,
          paymentMethod: "bank_transfer",
        })
      ).data.data;
      setCustomer((current) => ({ ...current, email: artist.email }));
      setSelected({
        ...artistSlot,
        name: artistSlot.title,
        packageType: "predefined",
        currency: result.booking.currency,
        bankTransferEnabled: true,
        bankAccounts: result.bankAccounts,
      });
      setBooking(result);
      setReceipt((current) => ({
        ...current,
        bankAccountId: result.bankAccounts?.[0]?._id || "",
      }));
      setArtistSlot(null);
      toast.success("Performance slot reserved");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Application failed");
    }
    setSubmitting(false);
  };

  if (loading) return <LinkupPageLoader variant={id ? "detail" : "events"} />;
  return (
    <div className="linkup-content-ready min-h-screen bg-slate-950 text-white">
      <LinkupHeader onSignIn={() => setShowGoogleSignIn(true)} />
      {!id ? (
        <>
          <section className="relative min-h-[620px] overflow-hidden flex items-center">
            <img
              src="/landing-studio-hero.jpg"
              alt="Live entertainment stage"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/45" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/30" />
            <div className="relative max-w-7xl mx-auto w-full px-5 py-20 grid lg:grid-cols-[1.2fr_.8fr] gap-12 items-center">
              <div className="max-w-3xl text-left">
                <span className="text-violet-300 text-sm font-bold uppercase tracking-[.25em]">
                  Live entertainment · packages · creators
                </span>
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[.94] mt-5">
                  YOUR NIGHT.
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                    YOUR EXPERIENCE.
                  </span>
                </h1>
                <p className="text-lg text-slate-200 mt-6 max-w-xl">
                  Discover live events, reserve a chair or table, and build the
                  right food and entertainment package for your night.
                </p>
                <div className="flex flex-wrap gap-3 mt-8">
                  <button
                    onClick={() =>
                      document
                        .getElementById("events")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="bg-violet-600 hover:bg-violet-500 px-5 py-3 rounded-xl font-bold flex items-center gap-2"
                  >
                    Explore events <ArrowRight size={17} />
                  </button>
                  <button
                    onClick={() => navigate("/linkup/packages")}
                    className="border border-white/25 bg-white/10 hover:bg-white/15 px-5 py-3 rounded-xl font-bold backdrop-blur"
                  >
                    Browse all packages
                  </button>
                </div>
              </div>
              <aside className="lg:justify-self-end w-full max-w-md grid gap-4">
                <button
                  onClick={() =>
                    document
                      .getElementById("events")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="group text-left rounded-2xl border border-white/15 bg-slate-950/65 backdrop-blur-xl p-6 hover:border-violet-400/60 hover:bg-slate-900/80 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-violet-500/20 text-violet-300 flex items-center justify-center">
                      <Calendar size={22} />
                    </div>
                    <ArrowRight className="text-slate-500 group-hover:text-violet-300 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase tracking-[.2em] text-violet-300 mt-5">
                    Upcoming now
                  </p>
                  <h2 className="text-2xl font-bold mt-1">Explore Events</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    See dates, venues, featured creators and available
                    experiences.
                  </p>
                </button>
                <button
                  onClick={() => navigate("/linkup/packages")}
                  className="group text-left rounded-2xl border border-white/15 bg-slate-950/65 backdrop-blur-xl p-6 hover:border-fuchsia-400/60 hover:bg-slate-900/80 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center">
                      <Package size={22} />
                    </div>
                    <ArrowRight className="text-slate-500 group-hover:text-fuchsia-300 group-hover:translate-x-1 transition" />
                  </div>
                  <p className="text-xs uppercase tracking-[.2em] text-fuchsia-300 mt-5">
                    Build your night
                  </p>
                  <h2 className="text-2xl font-bold mt-1">View Packages</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    Compare seating, guest capacity, food, drinks and prices.
                  </p>
                </button>
              </aside>
            </div>
          </section>
          <main id="events" className="max-w-7xl mx-auto px-5 py-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-violet-400 font-semibold">Upcoming</p>
                <h2 className="text-3xl font-bold">Entertainment events</h2>
              </div>
              <button
                onClick={() => navigate("/linkup/packages")}
                className="hidden sm:flex items-center gap-2 text-sm font-bold text-violet-300 hover:text-white"
              >
                View all packages <ArrowRight size={15} />
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <article
                  key={event._id}
                  className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden group"
                >
                  <div className="h-52 bg-gradient-to-br from-violet-800 to-slate-900 overflow-hidden">
                    {event.banner && (
                      <img
                        src={event.banner}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span className="flex gap-1">
                        <Calendar size={14} />
                        {formatEventSchedule(event)}
                      </span>
                      <span className="flex gap-1 truncate">
                        <MapPin size={14} />
                        {event.venueName || event.location}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mt-3">{event.title}</h3>
                    <p className="text-slate-400 text-sm mt-2 line-clamp-2">
                      {event.description}
                    </p>
                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        From{" "}
                        <b className="text-white">
                          {event.packages?.length
                            ? money(
                                Math.min(
                                  ...event.packages.map((p: AnyRecord) =>
                                    Number(p.packagePrice || p.basePrice),
                                  ),
                                ),
                              )
                            : "TBA"}
                        </b>
                      </span>
                      <button
                        onClick={() => navigate(`/linkup/events/${event._id}`)}
                        className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
                      >
                        View event <ArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!events.length && (
              <div className="text-center text-slate-400 py-24">
                No published events are currently available.
              </div>
            )}
          </main>
        </>
      ) : (
        <main className="max-w-7xl mx-auto px-5 py-10">
          <button
            onClick={() => navigate("/linkup")}
            className="text-slate-300 flex gap-2 items-center mb-6"
          >
            <ArrowLeft size={16} /> All events
          </button>
          <div className="rounded-3xl overflow-hidden bg-slate-900 border border-white/10">
            <div className="h-64 md:h-96 bg-gradient-to-br from-violet-900 to-slate-900">
              {detail?.event.banner && (
                <img
                  src={detail.event.banner}
                  className="w-full h-full object-cover"
                  alt=""
                />
              )}
            </div>
            <div className="p-6 md:p-9">
              <div className="flex flex-wrap gap-5 text-sm text-violet-200">
                <span className="flex gap-2">
                  <Calendar size={17} />
                  {formatEventSchedule(detail?.event)}
                </span>
                <span className="flex gap-2">
                  <MapPin size={17} />
                  {detail?.event.venueName}, {detail?.event.location}
                </span>
              </div>
              <h1 className="text-4xl font-black mt-5">
                {detail?.event.title}
              </h1>
              <p className="text-slate-300 mt-4 max-w-3xl">
                {detail?.event.description}
              </p>
            </div>
          </div>
          <section className="py-12">
            <h2 className="text-3xl font-bold">Choose your experience</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {detail?.packages.map((pkg: AnyRecord) => (
                <article
                  key={pkg._id}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl shadow-black/10"
                >
                  <div className="relative h-44 overflow-hidden bg-gradient-to-br from-violet-900 to-slate-900">
                    {pkg.image ? (
                      <img
                        src={pkg.image}
                        alt={pkg.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <Package size={48} className="text-white/20" />
                      </div>
                    )}
                    <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200 backdrop-blur">
                      {pkg.packageType}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold">{pkg.name}</h3>
                    <p className="mt-2 min-h-10 text-sm text-slate-400">
                      {pkg.description}
                    </p>
                    <div className="mt-5 space-y-2 text-sm text-slate-300">
                      <div className="flex gap-2">
                        <Armchair size={16} /> {pkg.seating?.name} ·{" "}
                        {pkg.seatingCapacity || pkg.seating?.capacity} guests
                      </div>
                      <div className="flex gap-2">
                        <Users size={16} /> {pkg.availableQuantity} available
                      </div>
                    </div>
                    <div className="mt-6 flex items-end justify-between">
                      <div>
                        <div className="text-xs text-slate-500">
                          {pkg.packageType === "customizable"
                            ? "Starting at"
                            : "Total price"}
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
                        onClick={() => openPackage(pkg)}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 font-bold shadow-lg shadow-violet-950/30 transition hover:bg-violet-500"
                      >
                        Book now
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          {(detail?.performanceSlots?.length || 0) > 0 && (
            <section className="pb-16">
              <h2 className="text-2xl font-bold">Artists & creators</h2>
              <p className="text-slate-400 mt-2">
                Performance applications are available for this event.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-5">
                {detail?.performanceSlots.map((slot: AnyRecord) => (
                  <div
                    key={slot._id}
                    className="border border-white/10 bg-slate-900 rounded-xl p-5"
                  >
                    <Mic2 className="text-fuchsia-400" />
                    <h3 className="font-bold mt-3">{slot.title}</h3>
                    <p className="text-sm text-slate-400">
                      {slot.durationMinutes} minutes ·{" "}
                      {money(slot.price, slot.currency)}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-emerald-400">
                        {slot.availableQuantity} available
                      </span>
                      <button
                        disabled={!slot.bankTransferEnabled}
                        onClick={() => setArtistSlot(slot)}
                        className="bg-fuchsia-600 disabled:bg-slate-700 px-3 py-2 rounded-lg text-sm font-bold"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {artistSlot && (
        <div className="fixed inset-0 z-50 bg-black/75 overflow-y-auto p-4">
          <div className="max-w-xl mx-auto my-10 bg-slate-900 border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  Apply for {artistSlot.title}
                </h2>
                <p className="text-slate-400 text-sm">
                  {money(artistSlot.price, artistSlot.currency)} ·{" "}
                  {artistSlot.durationMinutes} minutes
                </p>
              </div>
              <button onClick={() => setArtistSlot(null)} className="text-2xl">
                ×
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-3 mt-6">
              <input
                className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                placeholder="Artist / creator name"
                value={artist.artistName}
                onChange={(e) =>
                  setArtist({ ...artist, artistName: e.target.value })
                }
              />
              <input
                className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                placeholder="Email"
                value={artist.email}
                onChange={(e) =>
                  setArtist({ ...artist, email: e.target.value })
                }
              />
              <input
                className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                placeholder="Contact number"
                value={artist.phone}
                onChange={(e) =>
                  setArtist({ ...artist, phone: e.target.value })
                }
              />
              <input
                className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                placeholder="Performance category"
                value={artist.performanceCategory}
                onChange={(e) =>
                  setArtist({ ...artist, performanceCategory: e.target.value })
                }
              />
              <input
                className="md:col-span-2 bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                placeholder="Portfolio / social link (optional)"
                value={artist.portfolioUrl}
                onChange={(e) =>
                  setArtist({ ...artist, portfolioUrl: e.target.value })
                }
              />
              <textarea
                className="md:col-span-2 bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                rows={4}
                placeholder="Describe your performance"
                value={artist.performanceDescription}
                onChange={(e) =>
                  setArtist({
                    ...artist,
                    performanceDescription: e.target.value,
                  })
                }
              />
            </div>
            <button
              disabled={submitting}
              onClick={applyForSlot}
              className="w-full mt-5 bg-fuchsia-600 py-3 rounded-xl font-bold"
            >
              {submitting ? "Reserving…" : "Reserve performance slot"}
            </button>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/75 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto my-5 bg-slate-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selected.name}</h2>
                <p className="text-slate-400 text-sm">Complete your booking</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 text-2xl"
              >
                ×
              </button>
            </div>
            {booking?.submitted ? (
              <div className="p-10 text-center">
                <CheckCircle2 size={56} className="text-emerald-400 mx-auto" />
                <h3 className="text-2xl font-bold mt-5">Payment submitted</h3>
                <p className="text-slate-300 mt-3">
                  Your booking is pending payment verification. We will confirm
                  your reservation once your payment has been approved.
                </p>
                <div className="mt-5 font-mono text-violet-300">
                  {booking.booking.bookingReference}
                </div>
              </div>
            ) : booking ? (
              <div className="p-6 space-y-6">
                <div className="bg-violet-500/10 border border-violet-400/20 rounded-xl p-4">
                  <div className="text-sm text-violet-200">Amount to pay</div>
                  <div className="text-3xl font-black">
                    {money(
                      booking.booking.totalAmount,
                      booking.booking.currency,
                    )}
                  </div>
                  <div className="font-mono text-sm mt-2">
                    Reference: {booking.booking.bookingReference}{" "}
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          booking.booking.bookingReference,
                        )
                      }
                    >
                      <Copy size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold">Choose receiving account</h3>
                  <div className="grid gap-3 mt-3">
                    {booking.bankAccounts.map((account: AnyRecord) => (
                      <label
                        key={account._id}
                        className={`border rounded-xl p-4 cursor-pointer ${receipt.bankAccountId === account._id ? "border-violet-400 bg-violet-500/10" : "border-white/10"}`}
                      >
                        <input
                          type="radio"
                          className="mr-2"
                          checked={receipt.bankAccountId === account._id}
                          onChange={() =>
                            setReceipt({
                              ...receipt,
                              bankAccountId: account._id,
                            })
                          }
                        />
                        <b>{account.bankName}</b>
                        <div className="text-sm text-slate-300 mt-2">
                          {account.accountHolderName} · {account.accountNumber}{" "}
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                account.accountNumber,
                              )
                            }
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <div className="text-xs text-slate-400">
                          {account.currency}{" "}
                          {account.branchName && `· ${account.branchName}`}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm">
                    Transaction reference
                    <input
                      className="mt-1 w-full bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                      value={receipt.transferReference}
                      onChange={(e) =>
                        setReceipt({
                          ...receipt,
                          transferReference: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Payment date
                    <input
                      type="date"
                      className="mt-1 w-full bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                      value={receipt.paymentDate}
                      onChange={(e) =>
                        setReceipt({ ...receipt, paymentDate: e.target.value })
                      }
                    />
                  </label>
                  <label className="md:col-span-2 border border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer">
                    <Upload className="mx-auto text-violet-400" />
                    <div className="mt-2">
                      {receipt.file?.name ||
                        "Upload JPG, PNG, or PDF receipt (max 8 MB)"}
                    </div>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="hidden"
                      onChange={(e) =>
                        setReceipt({
                          ...receipt,
                          file: e.target.files?.[0] || null,
                        })
                      }
                    />
                  </label>
                </div>
                <button
                  disabled={submitting}
                  onClick={uploadReceipt}
                  className="w-full bg-violet-600 py-3 rounded-xl font-bold disabled:opacity-50"
                >
                  {submitting
                    ? "Uploading…"
                    : "Submit payment for verification"}
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {selected.packageType === "customizable" && (
                  <>
                    <div>
                      <h3 className="font-bold flex gap-2">
                        <Utensils size={18} /> Food selections
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3 mt-3">
                        {availableFood.map((item: AnyRecord) => (
                          <label
                            key={item._id}
                            className="border border-white/10 rounded-lg p-3 flex justify-between"
                          >
                            <span>
                              <b>{item.name}</b>
                              <small className="block text-slate-400">
                                {item.vendor?.name} ·{" "}
                                {money(item.price, selected.currency)}
                              </small>
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={item.availableQuantity}
                              value={food[item._id] || 0}
                              onChange={(e) =>
                                setFood({
                                  ...food,
                                  [item._id]: Number(e.target.value),
                                })
                              }
                              className="w-16 bg-slate-950 border border-white/15 rounded px-2"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                    {availableAlcohol.length > 0 && (
                      <div>
                        <h3 className="font-bold flex gap-2">
                          <Wine size={18} /> Alcohol options
                        </h3>
                        <div className="grid md:grid-cols-2 gap-3 mt-3">
                          {availableAlcohol.map((item: AnyRecord) => (
                            <label
                              key={item._id}
                              className="border border-white/10 rounded-lg p-3 flex justify-between"
                            >
                              <span>
                                <b>{item.name}</b>
                                <small className="block text-slate-400">
                                  {money(item.price, selected.currency)} ·{" "}
                                  {item.servingSize}
                                </small>
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={item.availableQuantity}
                                value={alcohol[item._id] || 0}
                                onChange={(e) =>
                                  setAlcohol({
                                    ...alcohol,
                                    [item._id]: Number(e.target.value),
                                  })
                                }
                                className="w-16 bg-slate-950 border border-white/15 rounded px-2"
                              />
                            </label>
                          ))}
                        </div>
                        <label className="flex gap-2 mt-3 text-sm text-slate-300">
                          <input
                            type="checkbox"
                            checked={customer.ageConfirmed}
                            onChange={(e) =>
                              setCustomer({
                                ...customer,
                                ageConfirmed: e.target.checked,
                              })
                            }
                          />{" "}
                          I confirm I meet the legal drinking age and will
                          present identification.
                        </label>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <h3 className="font-bold">Your details</h3>
                  {user ? (
                    <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-2 text-sm text-emerald-100">
                      <b>{user.name}</b>
                      <span className="block text-emerald-200/70">
                        {user.email}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowGoogleSignIn(true)}
                      className="mt-3 w-full border border-violet-400/40 bg-violet-500/10 rounded-lg px-3 py-3 text-violet-200 font-bold"
                    >
                      Sign in with Google to continue
                    </button>
                  )}
                  <div className="grid md:grid-cols-2 gap-3 mt-3">
                    <input
                      placeholder="Contact number"
                      className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                      value={customer.phone}
                      onChange={(e) =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      max={
                        selected.seatingCapacity || selected.seating?.capacity
                      }
                      className="bg-slate-950 border border-white/15 rounded-lg px-3 py-2"
                      value={customer.guestCount}
                      onChange={(e) =>
                        setCustomer({
                          ...customer,
                          guestCount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{money(subtotal, selected.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{money(tax, selected.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service fee</span>
                    <span>{money(fee, selected.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3 text-lg font-bold">
                    <span>Total</span>
                    <span>{money(total, selected.currency)}</span>
                  </div>
                </div>
                {selected.bankTransferAvailable ? (
                  <button
                    disabled={submitting}
                    onClick={book}
                    className="w-full bg-violet-600 py-3 rounded-xl font-bold disabled:opacity-50"
                  >
                    {submitting
                      ? "Reserving…"
                      : user
                        ? "Reserve & pay by bank transfer"
                        : "Sign in to purchase"}
                  </button>
                ) : (
                  <div className="text-amber-300 bg-amber-500/10 p-4 rounded-lg">
                    No payment method is currently available for this package.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {showGoogleSignIn && (
        <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black">Sign in to continue</h2>
                <p className="text-sm text-slate-500 mt-2">
                  Use Google to securely reserve packages and upload your
                  payment receipt.
                </p>
              </div>
              <button
                onClick={() => setShowGoogleSignIn(false)}
                className="text-2xl text-slate-400"
              >
                ×
              </button>
            </div>
            <div className="mt-6">
              <GoogleSignInButton
                onCredential={async (credential) => {
                  setSubmitting(true);
                  try {
                    await googleLogin(credential, true);
                    toast.success("Signed in successfully");
                  } catch (error: any) {
                    toast.error(
                      error.response?.data?.message || "Google sign-in failed",
                    );
                  }
                  setSubmitting(false);
                }}
                onError={(message) => toast.error(message)}
              />
            </div>
            <p className="text-xs text-slate-400 text-center mt-4">
              Your Google email identifies and protects your booking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkupPublic;
