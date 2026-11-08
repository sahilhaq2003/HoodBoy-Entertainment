const test = require('node:test');
const assert = require('node:assert/strict');
const { LinkupFoodVendor, LinkupAuditLog, LinkupBooking, LinkupBankTransfer } = require('../models/LinkupPlatform');
const { create, remove, customerBookings, _validateWholeNumbers } = require('../controllers/linkupPlatformController');

test('Linkup people and inventory counts must be whole numbers', () => {
  assert.doesNotThrow(() => _validateWholeNumbers('seating', { capacity: 6, totalQuantity: '12' }));
  assert.throws(() => _validateWholeNumbers('seating', { capacity: 6.5 }), /capacity must be a whole number/i);
  assert.throws(() => _validateWholeNumbers('packages', { seatingCapacity: '4.2' }), /seating capacity must be a whole number/i);
});

test('creating a Linkup vendor does not require an existing record id', async () => {
  const originalFindById = LinkupFoodVendor.findById;
  const originalCreate = LinkupFoodVendor.create;
  const originalAuditCreate = LinkupAuditLog.create;
  const created = { _id: 'vendor-1', name: 'HBE Catering', isActive: true };
  let responseStatus = 200;
  let responseBody;

  LinkupFoodVendor.findById = async () => { throw new Error('create must not look up a record id'); };
  LinkupFoodVendor.create = async input => ({ ...created, ...input });
  LinkupAuditLog.create = async () => ({});

  try {
    await create(
      {
        params: { resource: 'vendors' },
        body: { name: created.name, isActive: true },
        user: { _id: 'admin-1', role: 'admin' },
      },
      {
        status(code) { responseStatus = code; return this; },
        json(body) { responseBody = body; return this; },
      },
    );

    assert.equal(responseStatus, 201);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data.name, created.name);
  } finally {
    LinkupFoodVendor.findById = originalFindById;
    LinkupFoodVendor.create = originalCreate;
    LinkupAuditLog.create = originalAuditCreate;
  }
});

test('customer booking history is scoped to the authenticated customer', async () => {
  const originalBookingFind = LinkupBooking.find;
  const originalTransferFind = LinkupBankTransfer.find;
  let bookingFilter;
  const bookings = [{
    _id: 'booking-1', bookingReference: 'LNK-1001', customerName: 'Customer', guestCount: 2,
    bookingStatus: 'confirmed', paymentStatus: 'paid', totalAmount: 250, currency: 'USD',
    event: { _id: 'event-1', title: 'Live Night' }, package: { _id: 'package-1', name: 'VIP Table' },
    toJSON() { return { ...this, toJSON: undefined }; },
  }];
  const chain = value => ({ populate() { return this; }, select() { return this; }, sort() { return Promise.resolve(value); } });
  LinkupBooking.find = filter => { bookingFilter = filter; return chain(bookings); };
  LinkupBankTransfer.find = () => chain([]);
  let responseBody;

  try {
    await customerBookings(
      { user: { _id: 'customer-42' } },
      { json(body) { responseBody = body; return this; }, status() { return this; } },
    );
    assert.deepEqual(bookingFilter, { customer: 'customer-42' });
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.data[0].bookingReference, 'LNK-1001');
    assert.equal(responseBody.data[0].event.title, 'Live Night');
    assert.equal(responseBody.data[0].email, undefined);
  } finally {
    LinkupBooking.find = originalBookingFind;
    LinkupBankTransfer.find = originalTransferFind;
  }
});

test('only administrators can permanently delete booking test records', async () => {
  let responseStatus;
  let responseBody;
  await remove(
    { params: { resource: 'bookings', id: 'booking-1' }, user: { _id: 'manager-1', role: 'manager' } },
    { status(code) { responseStatus = code; return this; }, json(body) { responseBody = body; return this; } },
  );
  assert.equal(responseStatus, 403);
  assert.match(responseBody.message, /only administrators/i);
});

test('deleting a booking test record also removes its payment verification records', async () => {
  const originals = {
    bookingFind: LinkupBooking.findById,
    bookingDelete: LinkupBooking.findByIdAndDelete,
    transferFind: LinkupBankTransfer.find,
    transferDelete: LinkupBankTransfer.deleteMany,
    auditCreate: LinkupAuditLog.create,
  };
  const booking = { _id: 'booking-1', inventoryReleased: true };
  let deletedTransferFilter;
  LinkupBooking.findById = async () => booking;
  LinkupBooking.findByIdAndDelete = async () => booking;
  LinkupBankTransfer.find = async () => [{ _id: 'transfer-1', receiptFile: 'missing-test-receipt.png' }];
  LinkupBankTransfer.deleteMany = async filter => { deletedTransferFilter = filter; return { deletedCount: 1 }; };
  LinkupAuditLog.create = async () => ({});
  let responseBody;
  try {
    await remove(
      { params: { resource: 'bookings', id: 'booking-1' }, user: { _id: 'admin-1', role: 'admin' } },
      { status() { return this; }, json(body) { responseBody = body; return this; } },
    );
    assert.deepEqual(deletedTransferFilter, { booking: 'booking-1' });
    assert.equal(responseBody.success, true);
  } finally {
    LinkupBooking.findById = originals.bookingFind;
    LinkupBooking.findByIdAndDelete = originals.bookingDelete;
    LinkupBankTransfer.find = originals.transferFind;
    LinkupBankTransfer.deleteMany = originals.transferDelete;
    LinkupAuditLog.create = originals.auditCreate;
  }
});
