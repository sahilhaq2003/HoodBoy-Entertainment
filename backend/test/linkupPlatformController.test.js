const test = require('node:test');
const assert = require('node:assert/strict');
const { LinkupFoodVendor, LinkupAuditLog, LinkupBooking, LinkupBankTransfer } = require('../models/LinkupPlatform');
const { create, customerBookings, _validateWholeNumbers } = require('../controllers/linkupPlatformController');

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
