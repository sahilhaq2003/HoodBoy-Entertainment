const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const connectDB = require('../config/db');
const orm = require('../lib/mysql-orm');
const { decryptField } = require('../lib/fieldEncryption');
const { validTimeZone, calendarDateInZone } = require('../lib/eventTime');
const User = require('../models/User');
const { createNotification, createBulkNotifications } = require('../services/notificationService');
const { notifyBooking, queueAdmin } = require('../services/emailService');
const { optimizeImageBuffer } = require('../services/imageOptimizationService');
const {
  LinkupEvent, LinkupPerformanceSlot, LinkupSeating, LinkupFoodVendor, LinkupFoodItem,
  LinkupAlcoholOption, LinkupBankAccount, LinkupPackage, LinkupBooking,
  LinkupBankTransfer, LinkupAuditLog,
} = require('../models/LinkupPlatform');

const resources = {
  events: LinkupEvent, slots: LinkupPerformanceSlot, seating: LinkupSeating, vendors: LinkupFoodVendor,
  food: LinkupFoodItem, alcohol: LinkupAlcoholOption, 'bank-accounts': LinkupBankAccount,
  packages: LinkupPackage, bookings: LinkupBooking, transfers: LinkupBankTransfer,
};
const population = {
  events: [['artists', 'artistName legalName stageName']], slots: [['event', 'title eventDate']],
  seating: [['event', 'title eventDate']], vendors: [['events', 'title eventDate']],
  food: [['vendor', 'name'], ['events', 'title eventDate']], alcohol: [['events', 'title eventDate']],
  packages: [['event', 'title eventDate'], ['seating', 'name seatingType capacity price']],
  bookings: [['event', 'title eventDate'], ['package', 'name'], ['performanceSlot', 'title']],
  transfers: [['booking', 'bookingReference customerName email totalAmount currency'], ['bankAccount', 'bankName accountHolderName accountNumber currency']],
};
const editableFields = {
  events: ['title','description','banner','gallery','category','eventDate','startTime','endTime','timeZone','venueName','location','artists','bookingOpensAt','bookingClosesAt','status','ageRestricted'],
  slots: ['event','title','description','durationMinutes','scheduledAt','price','totalQuantity','availableQuantity','bookingDeadline','status','bankTransferEnabled','bankAccounts','currency','paymentInstructions'],
  seating: ['event','name','seatingType','capacity','price','totalQuantity','availableQuantity','description','isActive'],
  vendors: ['name','contactPerson','phone','email','description','logo','address','events','isActive'],
  food: ['vendor','events','category','name','description','image','price','availableQuantity','dietaryInfo','allergenInfo','isActive'],
  alcohol: ['events','name','category','description','price','servingSize','image','availableQuantity','pricingMode','isActive','minimumAge'],
  'bank-accounts': ['bankName','accountHolderName','accountNumber','branchName','routingNumber','swiftCode','iban','country','currency','instructions','isActive'],
  packages: ['event','name','description','image','packageType','seating','seatingCapacity','basePrice','packagePrice','includedItems','optionalItems','totalQuantity','availableQuantity','status','bankTransferEnabled','bankAccounts','defaultBankAccount','paymentInstructions','paymentDeadlineHours','checkoutHoldMinutes','taxRate','serviceFeeRate','currency','otherPaymentMethods'],
};
const pick = (source, fields) => Object.fromEntries(fields.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const populate = (query, name) => (population[name] || []).reduce((result, [field, select]) => result.populate(field, select), query);
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const notifyAdmins = async notification => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    if (admins.length) await createBulkNotifications(admins.map(admin => ({ userId: admin._id, ...notification })));
  } catch (error) { console.error(`Linkup notification warning: ${error.message}`); }
};
const eventCalendarDate = event => {
  const date = new Date(event?.eventDate);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const isCurrentOrUpcomingEvent = event => eventCalendarDate(event) >= calendarDateInZone(event?.timeZone);
const bankView = doc => {
  const value = doc?.toJSON ? doc.toJSON() : { ...doc };
  for (const field of ['accountNumber','routingNumber','swiftCode','iban']) value[field] = decryptField(value[field]);
  return value;
};

const normalizePackageItems = async items => {
  const normalized = [];
  const seen = new Set();
  for (const raw of Array.isArray(items) ? items : []) {
    const itemType = raw?.itemType;
    const itemId = String(raw?.itemId?._id || raw?.itemId || '');
    if (!['food', 'alcohol'].includes(itemType) || !itemId) throw new Error('Every package item must be selected from the food or alcohol catalog');
    const key = `${itemType}:${itemId}`;
    if (seen.has(key)) continue;
    const Model = itemType === 'food' ? LinkupFoodItem : LinkupAlcoholOption;
    const item = await Model.findById(itemId);
    if (!item || item.isActive === false) throw new Error(`${raw?.name || 'Selected item'} is not available in the system catalog`);
    seen.add(key);
    normalized.push({ itemType, itemId: String(item._id), name: item.name, quantity: Math.max(1, Math.floor(Number(raw.quantity) || 1)) });
  }
  return normalized;
};

const validatePackageData = async data => {
  const eventId = String(data.event?._id || data.event || '');
  const seatingId = String(data.seating?._id || data.seating || '');
  if (!eventId || !await LinkupEvent.exists({ _id: eventId })) throw new Error('Select a valid event for this package');
  const seating = seatingId ? await LinkupSeating.findById(seatingId) : null;
  if (!seating || seating.isActive === false || String(seating.event?._id || seating.event) !== eventId) throw new Error('Select an active seating configuration from the package event');
  const bankAccounts = [...new Set((Array.isArray(data.bankAccounts) ? data.bankAccounts : []).map(account => String(account?._id || account || '')).filter(Boolean))];
  for (const bankId of bankAccounts) {
    const bank = await LinkupBankAccount.findById(bankId);
    if (!bank || bank.isActive === false) throw new Error('One of the selected bank accounts is no longer available');
  }
  const defaultBankAccount = String(data.defaultBankAccount?._id || data.defaultBankAccount || '');
  if (defaultBankAccount && !bankAccounts.includes(defaultBankAccount)) throw new Error('The default bank account must also be selected as an accepted bank account');
  return {
    ...data,
    event: eventId,
    seating: seatingId,
    bankAccounts,
    defaultBankAccount: defaultBankAccount || null,
    includedItems: await normalizePackageItems(data.includedItems),
    optionalItems: await normalizePackageItems(data.optionalItems),
  };
};

const list = async (req, res) => {
  try {
    const Model = resources[req.params.resource];
    if (!Model) return fail(res, 404, 'Unknown Linkup resource');
    if (req.params.resource === 'bank-accounts' && req.user.role !== 'admin') return fail(res, 403, 'Only administrators can view bank accounts');
    const allowedFilters = ['status','event','package','bookingStatus','paymentStatus','verificationStatus','isActive','vendor'];
    const filter = pick(req.query, allowedFilters);
    const data = await populate(Model.find(filter).sort({ createdAt: -1 }), req.params.resource);
    const output = req.params.resource === 'bank-accounts' ? data.map(bankView) : req.params.resource === 'transfers' ? data.map(item => { if (item.bankAccount) item.bankAccount = bankView(item.bankAccount); return item; }) : data;
    res.json({ success: true, data: output });
  } catch (error) { fail(res, 500, error.message); }
};

const getOne = async (req, res) => {
  try {
    const Model = resources[req.params.resource];
    if (!Model) return fail(res, 404, 'Unknown Linkup resource');
    if (req.params.resource === 'bank-accounts' && req.user.role !== 'admin') return fail(res, 403, 'Only administrators can view bank accounts');
    const data = await populate(Model.findById(req.params.id), req.params.resource);
    if (!data) return fail(res, 404, 'Record not found');
    if (req.params.resource === 'transfers' && data.bankAccount) data.bankAccount = bankView(data.bankAccount);
    res.json({ success: true, data: req.params.resource === 'bank-accounts' ? bankView(data) : data });
  } catch (error) { fail(res, 500, error.message); }
};

const create = async (req, res) => {
  try {
    const name = req.params.resource;
    if (name === 'bank-accounts' && req.user.role !== 'admin') return fail(res, 403, 'Only administrators can manage bank accounts');
    const Model = resources[name];
    if (!Model || !editableFields[name]) return fail(res, 404, 'Unknown Linkup resource');
    let input = pick(req.body, editableFields[name]);
    if (name === 'events') {
      if (!validTimeZone(input.timeZone)) throw new Error('Select a valid event time zone');
      const parsedEventDate = input.eventDate ? new Date(input.eventDate) : null;
      if (parsedEventDate && Number.isNaN(parsedEventDate.getTime())) throw new Error('Enter a valid event date');
      const eventDate = parsedEventDate ? parsedEventDate.toISOString().slice(0, 10) : '';
      if (eventDate && eventDate < calendarDateInZone(input.timeZone)) throw new Error('Event date cannot be in the past at the venue location');
    }
    if (name === 'packages') input = await validatePackageData(input);
    const data = await Model.create(input);
    await LinkupAuditLog.create({ actor: req.user._id, action: 'create', entityType: name, entityId: data._id, details: { name: data.name || data.title || '' } });
    res.status(201).json({ success: true, data: name === 'bank-accounts' ? bankView(data) : data });
  } catch (error) { fail(res, 400, error.message); }
};

const update = async (req, res) => {
  try {
    const name = req.params.resource;
    if (name === 'bank-accounts' && req.user.role !== 'admin') return fail(res, 403, 'Only administrators can manage bank accounts');
    const Model = resources[name];
    if (!Model || !editableFields[name]) return fail(res, 404, 'Unknown Linkup resource');
    let input = pick(req.body, editableFields[name]);
    if (name === 'events' && input.timeZone !== undefined && !validTimeZone(input.timeZone)) throw new Error('Select a valid event time zone');
    if (name === 'packages') {
      const current = await Model.findById(req.params.id);
      if (!current) return fail(res, 404, 'Record not found');
      const existing = current.toJSON ? current.toJSON() : { ...current };
      const validated = await validatePackageData({ ...existing, ...input });
      input = pick(validated, editableFields[name]);
    }
    const data = await Model.findByIdAndUpdate(req.params.id, input, { new: true, runValidators: true });
    if (!data) return fail(res, 404, 'Record not found');
    await LinkupAuditLog.create({ actor: req.user._id, action: 'update', entityType: name, entityId: data._id });
    res.json({ success: true, data: name === 'bank-accounts' ? bankView(data) : data });
  } catch (error) { fail(res, 400, error.message); }
};

const remove = async (req, res) => {
  try {
    const name = req.params.resource;
    if (name === 'bank-accounts' && req.user.role !== 'admin') return fail(res, 403, 'Only administrators can manage bank accounts');
    const Model = resources[name];
    if (!Model || !editableFields[name]) return fail(res, 404, 'Unknown Linkup resource');
    if (name === 'bank-accounts') {
      const used = await LinkupBankTransfer.exists({ bankAccount: req.params.id });
      const assigned = await LinkupPackage.exists({ bankAccounts: req.params.id });
      if (used || assigned) return fail(res, 409, 'Deactivate this account instead; it is assigned or has payment history');
    }
    const data = await Model.findByIdAndDelete(req.params.id);
    if (!data) return fail(res, 404, 'Record not found');
    await LinkupAuditLog.create({ actor: req.user._id, action: 'delete', entityType: name, entityId: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) { fail(res, 409, error.message); }
};

const overview = async (_req, res) => {
  try {
    const [totalEvents, publishedEvents, activePackages, totalBookings, confirmedBookings, pendingVerifications, slots, paid] = await Promise.all([
      LinkupEvent.countDocuments({}), LinkupEvent.find({ status: 'published', eventDate: { $gte: new Date(Date.now() - 2 * 86400000) } }),
      LinkupPackage.countDocuments({ status: 'published' }), LinkupBooking.countDocuments({}), LinkupBooking.countDocuments({ bookingStatus: 'confirmed' }),
      LinkupBankTransfer.countDocuments({ verificationStatus: 'awaiting_verification' }), LinkupPerformanceSlot.countDocuments({ status: 'available' }),
      LinkupBooking.find({ paymentStatus: 'paid' }).lean(),
    ]);
    const upcomingEvents = publishedEvents.filter(isCurrentOrUpcomingEvent).length;
    res.json({ success: true, data: { totalEvents, upcomingEvents, activePackages, totalBookings, confirmedBookings, pendingVerifications, availablePerformanceSlots: slots, verifiedRevenue: paid.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0) } });
  } catch (error) { fail(res, 500, error.message); }
};

const publicEvents = async (_req, res) => {
  try {
    const events = (await LinkupEvent.find({ status: 'published', eventDate: { $gte: new Date(Date.now() - 2 * 86400000) } }).populate('artists', 'artistName legalName stageName').sort({ eventDate: 1 })).filter(isCurrentOrUpcomingEvent);
    const packages = await LinkupPackage.find({ status: 'published', availableQuantity: { $gt: 0 } }).populate('seating', 'name seatingType capacity price');
    const data = events.map(event => ({ ...event.toJSON(), packages: packages.filter(pkg => String(pkg.event) === String(event._id)).map(publicPackageSummary) }));
    res.json({ success: true, data });
  } catch (error) { fail(res, 500, error.message); }
};

const publicEvent = async (req, res) => {
  try {
    const event = await LinkupEvent.findOne({ _id: req.params.id, status: 'published' }).populate('artists', 'artistName legalName stageName');
    if (!event) return fail(res, 404, 'Event not found');
    const [packages, seating, vendors, food, alcohol, slots] = await Promise.all([
      LinkupPackage.find({ event: event._id, status: 'published', availableQuantity: { $gt: 0 } }).populate('seating', 'name seatingType capacity price'),
      LinkupSeating.find({ event: event._id, isActive: true, availableQuantity: { $gt: 0 } }),
      LinkupFoodVendor.find({ events: event._id, isActive: true }), LinkupFoodItem.find({ events: event._id, isActive: true, availableQuantity: { $gt: 0 } }).populate('vendor', 'name logo'),
      LinkupAlcoholOption.find({ events: event._id, isActive: true, availableQuantity: { $gt: 0 } }),
      LinkupPerformanceSlot.find({ event: event._id, status: 'available', availableQuantity: { $gt: 0 } }),
    ]);
    res.json({ success: true, data: { event, packages: packages.map(publicPackageSummary), seating, vendors, food, alcohol: event.ageRestricted ? alcohol : [], performanceSlots: slots.map(slot => { const value = slot.toJSON(); delete value.bankAccounts; delete value.paymentInstructions; return value; }) } });
  } catch (error) { fail(res, 500, error.message); }
};

const publicPackage = async (req, res) => {
  try {
    const pkg = await LinkupPackage.findOne({ _id: req.params.id, status: 'published', availableQuantity: { $gt: 0 } }).populate('event', 'title eventDate startTime endTime timeZone venueName location ageRestricted').populate('seating', 'name seatingType capacity price');
    if (!pkg) return fail(res, 404, 'Package not found');
    const bankAccounts = pkg.bankTransferEnabled ? await LinkupBankAccount.find({ _id: { $in: pkg.bankAccounts || [] }, isActive: true }).select('bankName accountHolderName accountNumber branchName routingNumber swiftCode iban country currency instructions') : [];
    res.json({ success: true, data: { ...publicPackageSummary(pkg), includedItems: pkg.includedItems, optionalItems: pkg.optionalItems, taxRate: pkg.taxRate, serviceFeeRate: pkg.serviceFeeRate, paymentDeadlineHours: pkg.paymentDeadlineHours, otherPaymentMethods: pkg.otherPaymentMethods, bankTransferEnabled: pkg.bankTransferEnabled, bankTransferAvailable: pkg.bankTransferEnabled && bankAccounts.length > 0 } });
  } catch (error) { fail(res, 500, error.message); }
};

const normalizeSelection = value => Array.isArray(value) ? value.map(item => ({ itemId: String(item.itemId || ''), quantity: Math.max(0, Math.floor(Number(item.quantity || 0))) })).filter(item => item.itemId && item.quantity) : [];
function publicPackageSummary(pkg) {
  const value = pkg.toJSON ? pkg.toJSON() : { ...pkg };
  const { bankAccounts, defaultBankAccount, paymentInstructions, ...safe } = value;
  return safe;
}
const priceBooking = async (pkg, body) => {
  const seating = await LinkupSeating.findById(pkg.seating);
  if (!seating || !seating.isActive) throw new Error('Selected seating is unavailable');
  const items = [];
  let subtotal = pkg.packageType === 'predefined' ? Number(pkg.packagePrice) : Number(pkg.basePrice || seating.price);
  items.push({ itemType: 'seating', itemId: String(seating._id), name: seating.name, quantity: 1, unitPrice: subtotal, totalPrice: subtotal });
  const selections = [{ type: 'food', Model: LinkupFoodItem, values: normalizeSelection(body.foodItems) }, { type: 'alcohol', Model: LinkupAlcoholOption, values: normalizeSelection(body.alcoholItems) }];
  if (pkg.packageType === 'customizable') for (const group of selections) {
    for (const selected of group.values) {
      const allowed = (pkg.optionalItems || []).filter(item => item.itemType === group.type).map(item => String(item.itemId));
      if (allowed.length && !allowed.includes(selected.itemId)) throw new Error(`Selected ${group.type} item is not available for this package`);
      const item = await group.Model.findOne({ _id: selected.itemId, isActive: true });
      if (!item || Number(item.availableQuantity) < selected.quantity) throw new Error(`${group.type} selection is unavailable`);
      const total = roundMoney(Number(item.price) * selected.quantity);
      items.push({ itemType: group.type, itemId: selected.itemId, name: item.name, quantity: selected.quantity, unitPrice: Number(item.price), totalPrice: total });
      subtotal += total;
    }
  }
  for (const included of pkg.includedItems || []) {
    if (!['food','alcohol'].includes(included.itemType) || !included.itemId) continue;
    const Model = included.itemType === 'food' ? LinkupFoodItem : LinkupAlcoholOption;
    const item = await Model.findOne({ _id: included.itemId, isActive: true });
    const quantity = Math.max(1, Number(included.quantity || 1));
    if (!item || Number(item.availableQuantity) < quantity) throw new Error(`Included item ${included.name || ''} is unavailable`);
    items.push({ itemType: included.itemType, itemId: String(included.itemId), name: included.name || item.name, quantity, included: true, unitPrice: 0, totalPrice: 0 });
  }
  subtotal = roundMoney(subtotal);
  const taxAmount = roundMoney(subtotal * Number(pkg.taxRate || 0) / 100);
  const serviceFeeAmount = roundMoney(subtotal * Number(pkg.serviceFeeRate || 0) / 100);
  return { seating, items, subtotal, taxAmount, serviceFeeAmount, totalAmount: roundMoney(subtotal + taxAmount + serviceFeeAmount) };
};

const preparePackageCheckout = async (user, packageId, body) => {
  const pkg = await LinkupPackage.findOne({ _id: packageId, status: 'published', availableQuantity: { $gt: 0 } });
  if (!pkg) throw new Error('Package is unavailable');
  if (!user || user.role !== 'customer') throw new Error('Sign in with a customer Google account to purchase a package');
  if (!body.phone?.trim()) throw new Error('Contact number is required');
  if (!pkg.bankTransferEnabled || !(pkg.bankAccounts || []).length) throw new Error('Bank transfer is unavailable for this package');
  const accounts = await LinkupBankAccount.find({ _id: { $in: pkg.bankAccounts || [] }, isActive: true }).select('bankName accountHolderName accountNumber branchName routingNumber swiftCode iban country currency instructions');
  if (!accounts.length) throw new Error('No active bank account is available for this package');
  const event = await LinkupEvent.findById(pkg.event);
  const requestedAlcohol = normalizeSelection(body.alcoholItems);
  if (requestedAlcohol.length && (!event?.ageRestricted || body.ageConfirmed !== true)) throw new Error('Alcohol is unavailable or legal-age confirmation is required');
  const quote = await priceBooking(pkg, body);
  const guestCount = Number(body.guestCount || 1);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > Number(pkg.seatingCapacity || quote.seating.capacity)) throw new Error('Guest count exceeds the seating capacity');
  return { pkg, quote, accounts, guestCount };
};

// This endpoint only prepares payment instructions. It deliberately does not
// create a booking or deduct inventory.
const createBooking = async (req, res) => {
  try {
    const { pkg, quote, accounts } = await preparePackageCheckout(req.user, req.params.packageId, req.body);
    res.json({ success: true, data: { quote, bankAccounts: accounts.map(bankView), paymentInstructions: pkg.paymentInstructions } });
  } catch (error) { fail(res, /unavailable|sold out/i.test(error.message) ? 409 : 400, error.message); }
};

const completePackageBooking = async (req, res) => {
  const cleanup = () => { if (req.file?.path) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return fail(res, 400, 'Payment receipt or screenshot is required before booking');
    let body;
    try { body = JSON.parse(req.body.payload || '{}'); }
    catch { cleanup(); return fail(res, 400, 'Invalid checkout details'); }
    const { pkg, quote, accounts, guestCount } = await preparePackageCheckout(req.user, req.params.packageId, body);
    const account = accounts.find(item => String(item._id) === String(req.body.bankAccountId));
    if (!account) { cleanup(); return fail(res, 400, 'Choose a valid receiving bank account'); }
    if (!req.body.transferReference?.trim()) { cleanup(); return fail(res, 400, 'Transaction reference is required'); }
    const paymentDate = new Date(req.body.paymentDate);
    if (Number.isNaN(paymentDate.getTime()) || paymentDate.getTime() > Date.now() + 86400000) { cleanup(); return fail(res, 400, 'Enter a valid payment date'); }
    const sequelize = connectDB.getSequelize();
    const result = await sequelize.transaction(async transaction => {
      await Promise.all([LinkupPackage._ready(), LinkupSeating._ready(), LinkupFoodItem._ready(), LinkupAlcoholOption._ready(), LinkupBooking._ready(), LinkupBankTransfer._ready()]);
      const [packageChanged] = await LinkupPackage._sql.update({ availableQuantity: sequelize.literal('availableQuantity - 1') }, { where: { id: String(pkg._id), status: 'published', availableQuantity: { [orm.Op.gte]: 1 } }, transaction });
      if (!packageChanged) throw new Error('Package sold out during checkout');
      const [seatChanged] = await LinkupSeating._sql.update({ availableQuantity: sequelize.literal('availableQuantity - 1') }, { where: { id: String(quote.seating._id), isActive: true, availableQuantity: { [orm.Op.gte]: 1 } }, transaction });
      if (!seatChanged) throw new Error('Seating sold out during checkout');
      for (const item of quote.items.filter(entry => ['food','alcohol'].includes(entry.itemType))) {
        const Model = item.itemType === 'food' ? LinkupFoodItem : LinkupAlcoholOption;
        const [changed] = await Model._sql.update({ availableQuantity: sequelize.literal(`availableQuantity - ${Number(item.quantity)}`) }, { where: { id: item.itemId, isActive: true, availableQuantity: { [orm.Op.gte]: item.quantity } }, transaction });
        if (!changed) throw new Error(`${item.name} sold out during checkout`);
      }
      const now = Date.now();
      const booking = new LinkupBooking({
        bookingReference: `LNK-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        customer: req.user._id, event: pkg.event, package: pkg._id, customerName: req.user.name, email: req.user.email, phone: body.phone.trim(),
        guestCount, notes: body.notes || '', items: quote.items, ...quote, currency: pkg.currency, paymentMethod: 'bank_transfer',
        bookingStatus: 'pending_payment_verification', paymentStatus: 'awaiting_verification',
        holdExpiresAt: new Date(now + Number(pkg.paymentDeadlineHours || 24) * 3600000), paymentDueAt: new Date(now + Number(pkg.paymentDeadlineHours || 24) * 3600000),
      });
      await booking.save({ transaction });
      const transfer = new LinkupBankTransfer({ booking: booking._id, bankAccount: account._id, transferReference: req.body.transferReference.trim(), receiptFile: req.file.filename, originalFileName: path.basename(req.file.originalname), paymentDate, amount: quote.totalAmount, currency: pkg.currency, notes: req.body.paymentNotes || '', auditHistory: [{ action: 'submitted_with_booking', at: new Date().toISOString() }] });
      await transfer.save({ transaction });
      return { booking, transfer };
    });
    await notifyAdmins({ type: 'approval_needed', title: 'Linkup payment awaiting verification', message: `${result.booking.bookingReference} submitted a bank transfer receipt`, link: '/the-lnk-up', priority: 'high', metadata: { bookingId: result.booking._id, transferId: result.transfer._id } });
    await notifyBooking(result.booking, 'booking_created', { transitionKey: 'created' });
    await notifyBooking(result.booking, 'receipt_submitted', { transitionKey: String(result.transfer._id), bankAccount: bankView(account) });
    const refreshedPackage = await LinkupPackage.findById(pkg._id);
    if (Number(refreshedPackage?.availableQuantity || 0) === 0) {
      await queueAdmin({ notificationType: 'package_sold_out', templateData: { title: 'Linkup package sold out', message: `${pkg.name} has reached zero available inventory.`, actionPath: '/the-lnk-up' }, relatedEntityType: 'package', relatedEntityId: pkg._id, dedupeKey: `package:${pkg._id}:sold_out`, category: 'booking' }).catch(() => {});
      const remaining = await LinkupPackage.countDocuments({ event: pkg.event, status: 'published', availableQuantity: { $gt: 0 } });
      if (!remaining) {
        const soldOutEvent = await LinkupEvent.findById(pkg.event);
        if (soldOutEvent && soldOutEvent.status === 'published') { soldOutEvent.status = 'sold_out'; await soldOutEvent.save(); }
        await queueAdmin({ notificationType: 'event_sold_out', templateData: { title: 'Linkup event sold out', message: `${soldOutEvent?.title || 'An event'} has no remaining package inventory.`, actionPath: '/the-lnk-up' }, relatedEntityType: 'event', relatedEntityId: pkg.event, dedupeKey: `event:${pkg.event}:sold_out`, category: 'booking' }).catch(() => {});
      }
    }
    res.status(201).json({ success: true, data: result, message: 'Payment submitted. Your booking is pending verification.' });
  } catch (error) { cleanup(); fail(res, /sold out|unavailable/i.test(error.message) ? 409 : 400, error.message); }
};

const createSlotBooking = async (req, res) => {
  try {
    const slot = await LinkupPerformanceSlot.findOne({ _id: req.params.slotId, status: 'available', availableQuantity: { $gt: 0 } });
    if (!slot) return fail(res, 404, 'Performance slot unavailable');
    if ((req.body.paymentMethod || 'bank_transfer') === 'bank_transfer' && (!slot.bankTransferEnabled || !(slot.bankAccounts || []).length)) return fail(res, 400, 'Bank transfer is unavailable for this performance slot');
    const accounts = slot.bankTransferEnabled ? await LinkupBankAccount.find({ _id: { $in: slot.bankAccounts || [] }, isActive: true }).select('bankName accountHolderName accountNumber branchName routingNumber swiftCode iban country currency instructions') : [];
    if ((req.body.paymentMethod || 'bank_transfer') === 'bank_transfer' && !accounts.length) return fail(res, 400, 'No active bank account is available for this performance slot');
    if (!req.user || req.user.role !== 'customer') return fail(res, 403, 'Sign in with Google before reserving a performance slot');
    const required = ['artistName','phone','performanceCategory','performanceDescription'];
    if (required.some(field => !req.body[field])) return fail(res, 400, 'Complete all required artist details');
    const sequelize = connectDB.getSequelize();
    const booking = await sequelize.transaction(async transaction => {
      await Promise.all([LinkupPerformanceSlot._ready(), LinkupBooking._ready()]);
      const [changed] = await LinkupPerformanceSlot._sql.update({ availableQuantity: sequelize.literal('availableQuantity - 1') }, { where: { id: String(slot._id), status: 'available', availableQuantity: { [orm.Op.gte]: 1 } }, transaction });
      if (!changed) throw new Error('Performance slot was just reserved');
      const doc = new LinkupBooking({ bookingReference: `ART-${crypto.randomBytes(5).toString('hex').toUpperCase()}`, customer: req.user._id, event: slot.event, performanceSlot: slot._id, bookingType: 'performance_slot', customerName: req.body.artistName, email: req.user.email, phone: req.body.phone, artistDetails: { performanceCategory: req.body.performanceCategory, performanceDescription: req.body.performanceDescription, portfolioUrl: req.body.portfolioUrl || '' }, items: [{ itemType: 'performance_slot', itemId: String(slot._id), name: slot.title, quantity: 1, unitPrice: slot.price, totalPrice: slot.price }], subtotal: slot.price, totalAmount: slot.price, currency: slot.currency || 'USD', paymentMethod: req.body.paymentMethod || 'bank_transfer', bookingStatus: 'awaiting_payment', paymentStatus: 'unpaid', holdExpiresAt: new Date(Date.now() + 30 * 60000), paymentDueAt: new Date(Date.now() + 24 * 3600000) });
      await doc.save({ transaction }); return doc;
    });
    await notifyBooking(booking, 'booking_created', { transitionKey: 'created' });
    await notifyBooking(booking, 'payment_pending', { transitionKey: 'initial', bankAccount: accounts[0] ? bankView(accounts[0]) : undefined, message: slot.paymentInstructions || '' });
    res.status(201).json({ success: true, data: { booking, bankAccounts: accounts.map(bankView), paymentInstructions: slot.paymentInstructions } });
  } catch (error) { fail(res, 409, error.message); }
};

const submitReceipt = async (req, res) => {
  const cleanup = () => { if (req.file?.path) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return fail(res, 400, 'Receipt file is required');
    const booking = await LinkupBooking.findOne({ bookingReference: req.params.reference, customer: req.user._id });
    if (!booking) { cleanup(); return fail(res, 404, 'Booking not found'); }
    if (!['unpaid','rejected'].includes(booking.paymentStatus)) { cleanup(); return fail(res, 409, 'This booking already has a payment under review or completed'); }
    const paymentOwner = booking.package ? await LinkupPackage.findById(booking.package) : booking.performanceSlot ? await LinkupPerformanceSlot.findById(booking.performanceSlot) : null;
    if (!paymentOwner || !(paymentOwner.bankAccounts || []).map(String).includes(String(req.body.bankAccountId))) { cleanup(); return fail(res, 400, 'Bank account is not assigned to this booking'); }
    const account = await LinkupBankAccount.findOne({ _id: req.body.bankAccountId, isActive: true });
    if (!account) { cleanup(); return fail(res, 400, 'Bank account is inactive'); }
    const transfer = await LinkupBankTransfer.create({ booking: booking._id, bankAccount: account._id, transferReference: req.body.transferReference, receiptFile: req.file.filename, originalFileName: path.basename(req.file.originalname), paymentDate: req.body.paymentDate, amount: booking.totalAmount, currency: booking.currency, notes: req.body.notes || '', auditHistory: [{ action: 'submitted', at: new Date().toISOString() }] });
    booking.bookingStatus = 'pending_payment_verification'; booking.paymentStatus = 'awaiting_verification'; await booking.save();
    await notifyAdmins({ type: 'approval_needed', title: 'Linkup payment awaiting verification', message: `${booking.bookingReference} submitted a bank transfer receipt`, link: '/the-lnk-up', priority: 'high', metadata: { bookingId: booking._id, transferId: transfer._id } });
    await notifyBooking(booking, 'receipt_submitted', { transitionKey: String(transfer._id) });
    res.status(201).json({ success: true, data: transfer, message: 'Your payment details have been submitted successfully. Your booking is pending payment verification. We will confirm your reservation once your payment has been approved.' });
  } catch (error) { cleanup(); fail(res, 400, error.message); }
};

const verifyTransfer = async (req, res) => {
  try {
    const action = req.body.action;
    if (!['approve','reject','request_information'].includes(action)) return fail(res, 400, 'Invalid verification action');
    const sequelize = connectDB.getSequelize();
    const result = await sequelize.transaction(async transaction => {
      await Promise.all([LinkupBankTransfer._ready(), LinkupBooking._ready()]);
      const transferRow = await LinkupBankTransfer._sql.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!transferRow) throw new Error('Transfer not found');
      const transfer = LinkupBankTransfer._hydrate(transferRow.get({ plain: true }));
      if (action === 'approve' && transfer.verificationStatus === 'approved') return transfer;
      if (!['awaiting_verification','information_requested'].includes(transfer.verificationStatus)) throw new Error('Payment has already been finalized');
      const bookingRow = await LinkupBooking._sql.findByPk(String(transfer.booking), { transaction, lock: transaction.LOCK.UPDATE });
      if (!bookingRow) throw new Error('Booking not found');
      const booking = LinkupBooking._hydrate(bookingRow.get({ plain: true }));
      if (action === 'approve') {
        if (booking.paymentStatus === 'paid' && booking.bookingStatus === 'confirmed') return transfer;
        if (booking.bookingStatus === 'expired' || booking.inventoryReleased) throw new Error('Inventory hold expired; resolve availability manually before approval');
        transfer.verificationStatus = 'approved'; transfer.verifiedBy = req.user._id; transfer.verifiedAt = new Date();
        booking.paymentStatus = 'paid'; booking.bookingStatus = 'confirmed';
      } else if (action === 'reject') {
        if (!req.body.reason) throw new Error('Rejection reason is required');
        transfer.verificationStatus = 'rejected'; transfer.rejectionReason = req.body.reason; transfer.verifiedBy = req.user._id; transfer.verifiedAt = new Date();
        booking.paymentStatus = 'rejected'; booking.bookingStatus = 'awaiting_payment';
      } else {
        transfer.verificationStatus = 'information_requested'; transfer.rejectionReason = req.body.reason || 'Additional payment information requested';
        booking.paymentStatus = 'awaiting_verification'; booking.bookingStatus = 'pending_payment_verification';
      }
      transfer.auditHistory = [...(transfer.auditHistory || []), { action, reason: req.body.reason || '', actor: String(req.user._id), at: new Date().toISOString() }];
      await transfer.save({ transaction }); await booking.save({ transaction }); return transfer;
    });
    await LinkupAuditLog.create({ actor: req.user._id, action: `payment_${action}`, entityType: 'transfer', entityId: req.params.id, details: { reason: req.body.reason || '' } });
    const reviewedTransfer = await LinkupBankTransfer.findById(req.params.id);
    const reviewedBooking = reviewedTransfer ? await LinkupBooking.findById(reviewedTransfer.booking) : null;
    if (reviewedBooking?.customer) {
      await createNotification({ userId: reviewedBooking.customer, type: 'system', title: action === 'approve' ? 'Linkup booking confirmed' : action === 'reject' ? 'Linkup payment rejected' : 'Linkup payment information requested', message: action === 'approve' ? `${reviewedBooking.bookingReference} is confirmed` : (req.body.reason || 'Please review your payment submission'), link: '/linkup', priority: action === 'approve' ? 'medium' : 'high', metadata: { bookingId: reviewedBooking._id } }).catch(error => console.error(`Linkup customer notification warning: ${error.message}`));
    }
    if (reviewedBooking) {
      const template = action === 'approve' ? 'payment_approved' : action === 'reject' ? 'payment_rejected' : 'payment_information_requested';
      await notifyBooking(reviewedBooking, template, { transitionKey: `${req.params.id}:${action}`, reason: req.body.reason || '' });
      if (action === 'approve') await notifyBooking(reviewedBooking, 'booking_confirmed', { transitionKey: String(req.params.id) });
    }
    res.json({ success: true, data: result });
  } catch (error) { fail(res, /not found/i.test(error.message) ? 404 : 409, error.message); }
};

const releaseBookingInventory = async (bookingId, nextStatus = 'cancelled', actor) => {
  const sequelize = connectDB.getSequelize();
  return sequelize.transaction(async transaction => {
    await Promise.all([LinkupBooking._ready(), LinkupPackage._ready(), LinkupSeating._ready(), LinkupFoodItem._ready(), LinkupAlcoholOption._ready(), LinkupPerformanceSlot._ready()]);
    const row = await LinkupBooking._sql.findByPk(String(bookingId), { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new Error('Booking not found');
    const booking = LinkupBooking._hydrate(row.get({ plain: true }));
    if (booking.inventoryReleased) return booking;
    if (booking.paymentStatus === 'paid' && nextStatus === 'expired') return booking;
    if (booking.paymentStatus === 'awaiting_verification' && nextStatus === 'expired') return booking;
    if (booking.package) {
      await LinkupPackage._sql.increment({ availableQuantity: 1 }, { where: { id: String(booking.package) }, transaction });
      const seat = (booking.items || []).find(item => item.itemType === 'seating');
      if (seat) await LinkupSeating._sql.increment({ availableQuantity: Number(seat.quantity || 1) }, { where: { id: String(seat.itemId) }, transaction });
    }
    if (booking.performanceSlot) await LinkupPerformanceSlot._sql.increment({ availableQuantity: 1 }, { where: { id: String(booking.performanceSlot) }, transaction });
    for (const item of (booking.items || []).filter(entry => ['food','alcohol'].includes(entry.itemType))) {
      const Model = item.itemType === 'food' ? LinkupFoodItem : LinkupAlcoholOption;
      await Model._sql.increment({ availableQuantity: Number(item.quantity || 1) }, { where: { id: String(item.itemId) }, transaction });
    }
    booking.inventoryReleased = true; booking.bookingStatus = nextStatus;
    await booking.save({ transaction });
    if (actor) await new LinkupAuditLog({ actor, action: `booking_${nextStatus}`, entityType: 'booking', entityId: booking._id }).save({ transaction });
    return booking;
  });
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await releaseBookingInventory(req.params.id, 'cancelled', req.user._id);
    await notifyBooking(booking, 'booking_cancelled', { transitionKey: String(booking.updatedAt || Date.now()) });
    res.json({ success: true, data: booking });
  } catch (error) { fail(res, /not found/i.test(error.message) ? 404 : 409, error.message); }
};

const expireHolds = async () => {
  const expired = await LinkupBooking.find({ bookingStatus: { $in: ['pending','awaiting_payment'] }, paymentStatus: 'unpaid', holdExpiresAt: { $lt: new Date() }, inventoryReleased: false });
  let count = 0;
  for (const booking of expired) {
    try { await releaseBookingInventory(booking._id, 'expired'); count += 1; } catch (error) { console.error(`Linkup hold expiry failed for ${booking._id}: ${error.message}`); }
  }
  return count;
};

const receipt = async (req, res) => {
  try {
    const transfer = await LinkupBankTransfer.findById(req.params.id);
    if (!transfer) return fail(res, 404, 'Receipt not found');
    const file = path.join(__dirname, '..', 'private_uploads', 'linkup_receipts', path.basename(transfer.receiptFile));
    if (!fs.existsSync(file)) return fail(res, 404, 'Receipt file missing');
    res.download(file, transfer.originalFileName || path.basename(file));
  } catch (error) { fail(res, 500, error.message); }
};

const bookingStatus = async (req, res) => {
  try {
    const booking = await LinkupBooking.findOne({ bookingReference: req.params.reference, customer: req.user._id }).select('bookingReference bookingStatus paymentStatus totalAmount currency paymentDueAt createdAt');
    if (!booking) return fail(res, 404, 'Booking not found');
    res.json({ success: true, data: booking });
  } catch (error) { fail(res, 500, error.message); }
};

const exportBookings = async (req, res) => {
  try {
    const filter = pick(req.query, ['event','package','bookingStatus','paymentStatus','paymentMethod']);
    const bookings = await LinkupBooking.find(filter).populate('event', 'title').populate('package', 'name').sort({ createdAt: -1 });
    const safe = value => {
      const text = String(value ?? '');
      const escaped = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${escaped.replaceAll('"', '""')}"`;
    };
    const rows = [['Reference','Customer','Email','Event','Package','Amount','Currency','Booking Status','Payment Status','Payment Method','Created']];
    for (const booking of bookings) rows.push([booking.bookingReference,booking.customerName,booking.email,booking.event?.title,booking.package?.name,booking.totalAmount,booking.currency,booking.bookingStatus,booking.paymentStatus,booking.paymentMethod,booking.createdAt?.toISOString?.() || booking.createdAt]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="linkup-bookings-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(`\uFEFF${rows.map(row => row.map(safe).join(',')).join('\n')}`);
  } catch (error) { fail(res, 500, error.message); }
};

const uploadImage = async (req, res) => {
  if (!req.file) return fail(res, 400, 'Select an image to upload.');
  try {
    const optimized = await optimizeImageBuffer(req.file.buffer);
    const destination = path.join(__dirname, '..', 'uploads', 'linkup');
    await fs.promises.mkdir(destination, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}.webp`;
    await fs.promises.writeFile(path.join(destination, filename), optimized.buffer, { flag: 'wx' });
    return res.status(201).json({
      success: true,
      message: 'Image optimized and uploaded successfully',
      data: {
        url: `/uploads/linkup/${filename}`,
        width: optimized.width,
        height: optimized.height,
        originalBytes: optimized.originalBytes,
        optimizedBytes: optimized.optimizedBytes,
      },
    });
  } catch (error) { return fail(res, 400, error.message || 'Image optimization failed'); }
};

module.exports = { list, getOne, create, update, remove, overview, publicEvents, publicEvent, publicPackage, createBooking, completePackageBooking, createSlotBooking, submitReceipt, verifyTransfer, cancelBooking, expireHolds, exportBookings, receipt, bookingStatus, uploadImage, _priceBooking: priceBooking, _preparePackageCheckout: preparePackageCheckout, _releaseBookingInventory: releaseBookingInventory };
