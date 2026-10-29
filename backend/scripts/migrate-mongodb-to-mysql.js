require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const connectDB = require('../config/db');
const orm = require('../lib/mysql-orm');

const batchSize = Math.max(10, Number.parseInt(process.env.DATA_MIGRATION_BATCH_SIZE || '250', 10));
const sourceUri = process.env.MONGODB_URI;
const reportPath = process.env.DATA_MIGRATION_REPORT || path.join(__dirname, '..', 'migration-report.json');
const orderedModels = ['User', 'Artist', 'Project', 'Song', 'Release', 'Contract', 'Campaign', 'Finance', 'RoyaltyLedger'];

const bsonToJs = value => {
  if (value == null) return value;
  if (value?._bsontype === 'ObjectId') return value.toHexString();
  if (value?._bsontype === 'Decimal128') return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(bsonToJs);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, bsonToJs(item)]));
  return value;
};

async function migrateModel(source, Model, report) {
  await Model._ready();
  const collection = source.collection(Model.collectionName);
  const mongoCount = await collection.countDocuments();
  const result = { collection: Model.collectionName, table: Model.collectionName, mongoCount, migrated: 0, failed: 0, failures: [], verification: 'pending' };
  const cursor = collection.find({}).batchSize(batchSize);
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    for (const raw of batch) {
      try {
        const data = bsonToJs(raw); const document = new Model({ ...data, _id: String(data._id) });
        await Model._sql.upsert(Model._serialize(document), { validate: false });
        result.migrated += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({ id: String(raw._id), reason: error.message });
      }
    }
    batch = [];
  };
  for await (const document of cursor) { batch.push(document); if (batch.length >= batchSize) await flush(); }
  await flush();
  const mysqlCount = await Model._sql.count();
  result.mysqlCount = mysqlCount;
  result.verification = result.failed === 0 && mysqlCount >= mongoCount ? 'verified' : 'review_required';
  report.collections.push(result);
  console.log(`${Model.collectionName}: ${result.migrated}/${mongoCount}, failed=${result.failed}, ${result.verification}`);
}

async function main() {
  if (!sourceUri) throw new Error('MONGODB_URI is required only for the standalone data migration utility.');
  for (const file of fs.readdirSync(path.join(__dirname, '..', 'models')).filter(name => name.endsWith('.js'))) require(path.join(__dirname, '..', 'models', file));
  await connectDB();
  const client = new MongoClient(sourceUri, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
  const report = { startedAt: new Date().toISOString(), source: 'MongoDB', destination: `${process.env.DB_HOST}/${process.env.DB_NAME}`, batchSize, collections: [] };
  try {
    await client.connect();
    const source = client.db();
    const models = [...orm.getModels().values()].sort((a, b) => {
      const ai = orderedModels.indexOf(a.modelName), bi = orderedModels.indexOf(b.modelName);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    });
    for (const Model of models) await migrateModel(source, Model, report);
    for (const Model of models) {
      const documents = await Model.find({});
      for (const document of documents) await Model._syncLinks(document);
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    await client.close();
    await connectDB.getSequelize()?.close();
    console.log(`Migration report: ${reportPath}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
