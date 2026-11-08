const test = require('node:test');
const assert = require('node:assert/strict');
const { LinkupFoodVendor, LinkupAuditLog } = require('../models/LinkupPlatform');
const { create, _validateWholeNumbers } = require('../controllers/linkupPlatformController');

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
