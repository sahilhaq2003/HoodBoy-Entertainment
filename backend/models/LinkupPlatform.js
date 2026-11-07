const mongoose = require('../lib/mysql-orm');
const { encryptField } = require('../lib/fieldEncryption');

const objectId = mongoose.Schema.Types.ObjectId;
const money = { type: Number, min: 0, default: 0 };

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  banner: { type: String, default: '' },
  gallery: [{ type: String }],
  category: { type: String, default: 'Live Entertainment' },
  eventDate: { type: Date, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  venueName: { type: String, default: '' },
  location: { type: String, required: true },
  artists: [{ type: objectId, ref: 'Artist' }],
  bookingOpensAt: { type: Date },
  bookingClosesAt: { type: Date },
  status: { type: String, enum: ['draft', 'published', 'sold_out', 'completed', 'cancelled'], default: 'draft' },
  ageRestricted: { type: Boolean, default: false },
}, { timestamps: true, collection: 'linkup_events' });
eventSchema.index({ status: 1, eventDate: 1 });

const slotSchema = new mongoose.Schema({
  event: { type: objectId, ref: 'LinkupEvent', required: true },
  title: { type: String, required: true }, description: { type: String, default: '' },
  durationMinutes: { type: Number, min: 1, default: 30 }, scheduledAt: { type: Date },
  price: money, totalQuantity: { type: Number, min: 1, default: 1 },
  availableQuantity: { type: Number, min: 0, default: 1 }, bookingDeadline: { type: Date },
  status: { type: String, enum: ['available', 'pending', 'awaiting_payment', 'confirmed', 'cancelled'], default: 'available' },
  bankTransferEnabled: { type: Boolean, default: false }, bankAccounts: [{ type: objectId, ref: 'LinkupBankAccount' }],
  currency: { type: String, default: 'USD' }, paymentInstructions: { type: String, default: '' },
}, { timestamps: true, collection: 'linkup_performance_slots' });
slotSchema.index({ event: 1, status: 1 });

const seatingSchema = new mongoose.Schema({
  event: { type: objectId, ref: 'LinkupEvent', required: true },
  name: { type: String, required: true },
  seatingType: { type: String, enum: ['chair', 'table'], required: true },
  capacity: { type: Number, min: 1, default: 1 }, price: { type: Number, min: 0 },
  totalQuantity: { type: Number, min: 0, default: 0 }, availableQuantity: { type: Number, min: 0, default: 0 },
  description: { type: String, default: '' }, isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'linkup_seating' });
seatingSchema.pre('validate', function applyStartingPrice() {
  if (this.price == null) this.price = this.seatingType === 'table' ? 125 : 50;
});
seatingSchema.index({ event: 1, seatingType: 1, isActive: 1 });

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true }, contactPerson: { type: String, default: '' }, phone: { type: String, default: '' },
  email: { type: String, default: '' }, description: { type: String, default: '' }, logo: { type: String, default: '' },
  address: { type: String, default: '' }, events: [{ type: objectId, ref: 'LinkupEvent' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'linkup_food_vendors' });

const foodSchema = new mongoose.Schema({
  vendor: { type: objectId, ref: 'LinkupFoodVendor', required: true },
  events: [{ type: objectId, ref: 'LinkupEvent' }], category: { type: String, required: true },
  name: { type: String, required: true }, description: { type: String, default: '' }, image: { type: String, default: '' },
  price: money, availableQuantity: { type: Number, min: 0, default: 0 },
  dietaryInfo: { type: String, default: '' }, allergenInfo: { type: String, default: '' }, isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'linkup_food_items' });
foodSchema.index({ vendor: 1, isActive: 1 });

const alcoholSchema = new mongoose.Schema({
  events: [{ type: objectId, ref: 'LinkupEvent' }], name: { type: String, required: true },
  category: { type: String, default: '' }, description: { type: String, default: '' }, price: money,
  servingSize: { type: String, default: '' }, image: { type: String, default: '' },
  availableQuantity: { type: Number, min: 0, default: 0 }, pricingMode: { type: String, enum: ['per_person', 'per_table'], default: 'per_table' },
  isActive: { type: Boolean, default: true }, minimumAge: { type: Number, min: 0, default: 21 },
}, { timestamps: true, collection: 'linkup_alcohol_options' });

const bankSchema = new mongoose.Schema({
  bankName: { type: String, required: true }, accountHolderName: { type: String, required: true },
  accountNumber: { type: String, required: true }, branchName: { type: String, default: '' },
  routingNumber: { type: String, default: '' }, swiftCode: { type: String, default: '' }, iban: { type: String, default: '' },
  country: { type: String, default: '' }, currency: { type: String, required: true, default: 'USD' },
  instructions: { type: String, default: '' }, isActive: { type: Boolean, default: true },
}, { timestamps: true, collection: 'linkup_bank_accounts' });
bankSchema.pre('save', function encryptBankDetails() {
  for (const field of ['accountNumber','routingNumber','swiftCode','iban']) this[field] = encryptField(this[field]);
});

const packageSchema = new mongoose.Schema({
  event: { type: objectId, ref: 'LinkupEvent', required: true }, name: { type: String, required: true },
  description: { type: String, default: '' }, image: { type: String, default: '' },
  packageType: { type: String, enum: ['predefined', 'customizable'], default: 'predefined' },
  seating: { type: objectId, ref: 'LinkupSeating', required: true }, seatingCapacity: { type: Number, min: 1, default: 1 },
  basePrice: money, packagePrice: money, includedItems: { type: mongoose.Schema.Types.Mixed, default: [] }, optionalItems: { type: mongoose.Schema.Types.Mixed, default: [] },
  totalQuantity: { type: Number, min: 0, default: 0 }, availableQuantity: { type: Number, min: 0, default: 0 },
  status: { type: String, enum: ['draft', 'published', 'inactive'], default: 'draft' },
  bankTransferEnabled: { type: Boolean, default: false }, bankAccounts: [{ type: objectId, ref: 'LinkupBankAccount' }],
  defaultBankAccount: { type: objectId, ref: 'LinkupBankAccount' }, paymentInstructions: { type: String, default: '' },
  paymentDeadlineHours: { type: Number, min: 1, default: 24 }, checkoutHoldMinutes: { type: Number, min: 5, default: 30 },
  taxRate: { type: Number, min: 0, default: 0 }, serviceFeeRate: { type: Number, min: 0, default: 0 },
  currency: { type: String, default: 'USD' }, otherPaymentMethods: [{ type: String }],
}, { timestamps: true, collection: 'linkup_packages' });
packageSchema.index({ event: 1, status: 1 });

const bookingSchema = new mongoose.Schema({
  bookingReference: { type: String, required: true, unique: true }, customer: { type: objectId, ref: 'User' },
  event: { type: objectId, ref: 'LinkupEvent', required: true }, package: { type: objectId, ref: 'LinkupPackage' },
  performanceSlot: { type: objectId, ref: 'LinkupPerformanceSlot' }, bookingType: { type: String, enum: ['guest', 'performance_slot'], default: 'guest' },
  customerName: { type: String, required: true }, email: { type: String, required: true }, phone: { type: String, required: true },
  guestCount: { type: Number, min: 1, default: 1 }, notes: { type: String, default: '' }, artistDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  items: { type: mongoose.Schema.Types.Mixed, default: [] }, subtotal: money, taxAmount: money, serviceFeeAmount: money, totalAmount: money,
  currency: { type: String, default: 'USD' }, bookingStatus: { type: String, enum: ['pending', 'awaiting_payment', 'pending_payment_verification', 'confirmed', 'cancelled', 'completed', 'expired'], default: 'awaiting_payment' },
  paymentStatus: { type: String, enum: ['unpaid', 'awaiting_verification', 'paid', 'rejected', 'refunded', 'partially_refunded'], default: 'unpaid' },
  paymentMethod: { type: String, enum: ['bank_transfer', 'online', 'other'], default: 'bank_transfer' },
  holdExpiresAt: { type: Date }, paymentDueAt: { type: Date }, inventoryReleased: { type: Boolean, default: false },
}, { timestamps: true, collection: 'linkup_bookings' });
bookingSchema.index({ event: 1, bookingStatus: 1 });
bookingSchema.index({ email: 1, bookingReference: 1 });

const transferSchema = new mongoose.Schema({
  booking: { type: objectId, ref: 'LinkupBooking', required: true }, bankAccount: { type: objectId, ref: 'LinkupBankAccount', required: true },
  transferReference: { type: String, required: true }, receiptFile: { type: String, required: true }, originalFileName: { type: String, default: '' },
  paymentDate: { type: Date, required: true }, amount: money, currency: { type: String, required: true }, notes: { type: String, default: '' },
  verificationStatus: { type: String, enum: ['awaiting_verification', 'approved', 'rejected', 'information_requested'], default: 'awaiting_verification' },
  verifiedBy: { type: objectId, ref: 'User' }, verifiedAt: { type: Date }, rejectionReason: { type: String, default: '' },
  auditHistory: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: true, collection: 'linkup_bank_transfers' });
transferSchema.index({ booking: 1, verificationStatus: 1 });

const auditSchema = new mongoose.Schema({
  actor: { type: objectId, ref: 'User' }, action: { type: String, required: true }, entityType: { type: String, required: true },
  entityId: { type: String, required: true }, details: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, collection: 'linkup_audit_logs' });

module.exports = {
  LinkupEvent: mongoose.model('LinkupEvent', eventSchema),
  LinkupPerformanceSlot: mongoose.model('LinkupPerformanceSlot', slotSchema),
  LinkupSeating: mongoose.model('LinkupSeating', seatingSchema),
  LinkupFoodVendor: mongoose.model('LinkupFoodVendor', vendorSchema),
  LinkupFoodItem: mongoose.model('LinkupFoodItem', foodSchema),
  LinkupAlcoholOption: mongoose.model('LinkupAlcoholOption', alcoholSchema),
  LinkupBankAccount: mongoose.model('LinkupBankAccount', bankSchema),
  LinkupPackage: mongoose.model('LinkupPackage', packageSchema),
  LinkupBooking: mongoose.model('LinkupBooking', bookingSchema),
  LinkupBankTransfer: mongoose.model('LinkupBankTransfer', transferSchema),
  LinkupAuditLog: mongoose.model('LinkupAuditLog', auditSchema),
};
