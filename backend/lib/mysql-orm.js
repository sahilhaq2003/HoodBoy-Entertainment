const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op, DataTypes, fn, col, literal, where: sqlExpression, json: jsonPath } = require('sequelize');

const registry = new Map();
let sequelize;
const linkTable = (collection, field) => `${collection}_${field}`.slice(0, 64);

const clone = value => value === undefined ? value : structuredClone(value);
const id = () => crypto.randomBytes(12).toString('hex');
const isPlain = value => value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp) && !(value instanceof ObjectId) && !(value instanceof Schema);
const get = (obj, path) => String(path).split('.').reduce((v, key) => v == null ? undefined : v[key], obj);
const set = (obj, path, value) => {
  const keys = String(path).split('.'); let cursor = obj;
  keys.slice(0, -1).forEach(key => { cursor[key] ||= {}; cursor = cursor[key]; });
  cursor[keys.at(-1)] = value;
};

class ObjectId {
  constructor(value) { this.value = value ? String(value) : id(); }
  toString() { return this.value; }
  valueOf() { return this.value; }
  toJSON() { return this.value; }
  static isValid(value) { return /^[a-f\d]{24}$/i.test(String(value || '')); }
}

class Schema {
  constructor(definition = {}, options = {}) {
    this.definition = definition;
    this.options = options;
    this._indexes = [];
    this._hooks = { save: [], validate: [] };
    this.methods = {};
    this.statics = {};
    this._virtuals = {};
  }
  index(fields, options = {}) { this._indexes.push([fields, options]); return this; }
  pre(name, handler) { (this._hooks[name] ||= []).push(handler); return this; }
  virtual(name) { return { get: getter => { this._virtuals[name] = getter; return this; } }; }
  set() { return this; }
}
Schema.Types = { ObjectId, Mixed: class Mixed {} };

const normalizeSpec = raw => {
  if (raw instanceof Schema) return { kind: 'json', schema: raw };
  if (Array.isArray(raw)) return { kind: 'json', array: true, item: raw[0], ref: raw[0]?.ref };
  if (raw === Schema.Types.Mixed) return { type: raw, kind: 'json' };
  if (raw === String || raw === Number || raw === Boolean || raw === Date || raw === ObjectId)
    return { type: raw };
  const descriptorType = raw?.type;
  const isDescriptor = Array.isArray(descriptorType) || descriptorType instanceof Schema ||
    [String, Number, Boolean, Date, ObjectId, Schema.Types.Mixed].includes(descriptorType);
  if (isPlain(raw) && Object.hasOwn(raw, 'type') && isDescriptor) {
    if (Array.isArray(raw.type)) return { ...raw, kind: 'json', array: true, item: raw.type[0], ref: raw.ref || raw.type[0]?.ref };
    if (raw.type instanceof Schema) return { ...raw, kind: 'json', schema: raw.type };
    if (raw.type === Schema.Types.Mixed) return { ...raw, kind: 'json' };
    return raw;
  }
  if (isPlain(raw)) return { kind: 'json', nested: raw };
  return { kind: 'json' };
};

const defaultFor = spec => {
  if (Object.hasOwn(spec, 'default')) return typeof spec.default === 'function' ? spec.default() : clone(spec.default);
  if (spec.array) return [];
  if (spec.nested) {
    const value = {};
    for (const [key, raw] of Object.entries(spec.nested)) {
      const child = normalizeSpec(raw); const fallback = defaultFor(child);
      if (fallback !== undefined) value[key] = fallback;
    }
    return value;
  }
  return undefined;
};

const validateValue = (raw, value, path, errors) => {
  const spec = normalizeSpec(raw);
  const fail = message => { errors[path] = new Error(message); };
  if (spec.required && (value === undefined || value === null || value === '')) fail(`Path ${path} is required`);
  if (value == null) return;
  if (spec.enum && !spec.enum.includes(value)) fail(`${value} is not a valid enum value for path ${path}`);
  if (spec.min != null && value < spec.min) fail(`Path ${path} is less than the minimum allowed value`);
  if (spec.max != null && value > spec.max) fail(`Path ${path} exceeds the maximum allowed value`);
  if (spec.minlength && String(value).length < spec.minlength) fail(`Path ${path} is shorter than the minimum allowed length`);
  if (spec.maxlength && String(value).length > spec.maxlength) fail(`Path ${path} is longer than the maximum allowed length`);
  if (spec.match && !spec.match.test(String(value))) fail(`Path ${path} is invalid`);
  if (spec.validate) {
    try {
      const ok = typeof spec.validate === 'function' ? spec.validate(value) : spec.validate.validator(value);
      if (!ok) fail(spec.validate.message || `Path ${path} is invalid`);
    } catch (error) { errors[path] = error; }
  }
  if (spec.array && Array.isArray(value) && spec.item) value.forEach((item, index) => {
    if (spec.item instanceof Schema) for (const [key, child] of Object.entries(spec.item.definition)) validateValue(child, item?.[key], `${path}.${index}.${key}`, errors);
    else validateValue(spec.item, item, `${path}.${index}`, errors);
  });
  if (spec.nested) for (const [key, child] of Object.entries(spec.nested)) validateValue(child, value?.[key], `${path}.${key}`, errors);
  if (spec.schema) for (const [key, child] of Object.entries(spec.schema.definition)) validateValue(child, value?.[key], `${path}.${key}`, errors);
};

const serialize = value => {
  if (value instanceof ObjectId) return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value.toObject === 'function') return value.toObject();
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
};

const specAtPath = (definition, segments) => {
  const raw = definition?.[segments[0]];
  if (!raw) return {};
  const spec = normalizeSpec(raw);
  if (segments.length === 1) return spec;
  const next = segments.slice(1);
  if (spec.schema) return specAtPath(spec.schema.definition, next);
  if (spec.array && spec.item instanceof Schema) return specAtPath(spec.item.definition, next);
  if (spec.array && isPlain(spec.item) && !Object.hasOwn(spec.item, 'type')) return specAtPath(spec.item, next);
  if (spec.nested) return specAtPath(spec.nested, next);
  return {};
};

const matches = (doc, filter = {}) => {
  const test = (actual, expected) => {
    if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
    if (!isPlain(expected) || expected instanceof Date) return String(actual ?? '') === String(expected ?? '');
    return Object.entries(expected).every(([operator, value]) => {
      if (!operator.startsWith('$')) return test(actual?.[operator], value);
      if (operator === '$in') return value.some(item => test(actual, item));
      if (operator === '$nin') return !value.some(item => test(actual, item));
      if (operator === '$ne') return !test(actual, value);
      if (operator === '$gt') return actual > value;
      if (operator === '$gte') return actual >= value;
      if (operator === '$lt') return actual < value;
      if (operator === '$lte') return actual <= value;
      if (operator === '$exists') return value ? actual !== undefined && actual !== null : actual === undefined || actual === null;
      if (operator === '$regex') return new RegExp(value, expected.$options || '').test(String(actual ?? ''));
      if (operator === '$options') return true;
      if (operator === '$size') return Array.isArray(actual) && actual.length === value;
      return true;
    });
  };
  return Object.entries(filter || {}).every(([key, expected]) => {
    if (key === '$or') return expected.some(part => matches(doc, part));
    if (key === '$and') return expected.every(part => matches(doc, part));
    return test(get(doc, key), expected);
  });
};

const sqlWhere = (filter = {}, definition = {}) => {
  const out = {};
  for (const [key, expected] of Object.entries(filter || {})) {
    if (key === '$or' || key === '$and') { out[key === '$or' ? Op.or : Op.and] = expected.map(x => sqlWhere(x, definition)); continue; }
    if (key.includes('.')) {
      const root=key.split('.')[0];
      if(!Object.hasOwn(definition,root))continue;
      const operators=isPlain(expected)?Object.fromEntries(Object.entries(expected).flatMap(([op,value])=>{const map={$in:Op.in,$nin:Op.notIn,$ne:Op.ne,$gt:Op.gt,$gte:Op.gte,$lt:Op.lt,$lte:Op.lte,$exists:value?Op.not:Op.is};if(op==='$regex')return[[Op.regexp,value]];if(op==='$options'||op==='$size')return[];return map[op]?[[map[op],op==='$exists'?null:serialize(value)]]:[];})):serialize(expected);
      (out[Op.and]||=[]).push(sqlExpression(jsonPath(key),operators));
      continue;
    }
    if (key !== '_id' && !Object.hasOwn(definition, key)) continue;
    const actual = expected instanceof RegExp ? { [Op.regexp]: expected.source } : isPlain(expected) ? Object.fromEntries(Object.entries(expected).flatMap(([op, value]) => {
      const map = { $in: Op.in, $nin: Op.notIn, $ne: Op.ne, $gt: Op.gt, $gte: Op.gte, $lt: Op.lt, $lte: Op.lte, $exists: value ? Op.not : Op.is };
      if (op === '$regex') return [[Op.regexp, value]];
      if (op === '$options' || op === '$size') return [];
      return map[op] ? [[map[op], op === '$exists' ? null : serialize(value)]] : [];
    })) : serialize(expected);
    out[key === '_id' ? 'id' : key] = actual;
  }
  return out;
};

const isSqlFilter = (filter, definition) => Object.entries(filter || {}).every(([key, value]) => {
  if (key === '$or' || key === '$and') return value.every(item => isSqlFilter(item, definition));
  if (key.includes('.')) { const root=key.split('.')[0]; if(!Object.hasOwn(definition,root))return false; }
  else if (key !== '_id' && !Object.hasOwn(definition, key)) return false;
  return !isPlain(value) || Object.keys(value).every(operator => ['$in','$nin','$ne','$gt','$gte','$lt','$lte','$exists','$regex','$options'].includes(operator));
});

const expression = (expr, doc, variables = {}) => {
  if (typeof expr === 'string' && expr.startsWith('$$')) {
    const [name, ...path] = expr.slice(2).split('.');
    return path.length ? get(variables[name], path.join('.')) : variables[name];
  }
  if (typeof expr === 'string' && expr.startsWith('$')) return get(doc, expr.slice(1));
  if (Array.isArray(expr)) return expr.map(x => expression(x, doc, variables));
  if (!isPlain(expr)) return expr;
  const entries = Object.entries(expr);
  if (entries.length !== 1 || !entries[0][0].startsWith('$')) return Object.fromEntries(entries.map(([k,v]) => [k, expression(v, doc, variables)]));
  const [op, arg] = entries[0];
  if (op === '$filter') {
    const input = expression(arg.input, doc, variables);
    const variableName = arg.as || 'this';
    return Array.isArray(input) ? input.filter(item => expression(arg.cond, doc, { ...variables, [variableName]: item })) : [];
  }
  const values = Array.isArray(arg) ? arg.map(x => expression(x, doc, variables)) : expression(arg, doc, variables);
  if (op === '$ifNull') return values[0] ?? values[1];
  if (op === '$size') return Array.isArray(values) ? values.length : 0;
  if (op === '$sum') return Array.isArray(values) ? values.reduce((a,b) => a + Number(b || 0), 0) : Number(values || 0);
  if (op === '$add') return values.reduce((a,b) => a + Number(b || 0), 0);
  if (op === '$subtract') return Number(values[0] || 0) - Number(values[1] || 0);
  if (op === '$multiply') return values.reduce((a,b) => a * Number(b || 0), 1);
  if (op === '$divide') return Number(values[1]) ? Number(values[0] || 0) / Number(values[1]) : 0;
  if (op === '$round') { const p = values[1] || 0; return Number(Number(values[0] || 0).toFixed(p)); }
  if (op === '$eq') return values[0] === values[1];
  if (op === '$ne') return values[0] !== values[1];
  if (op === '$gt') return values[0] > values[1];
  if (op === '$gte') return values[0] >= values[1];
  if (op === '$lt') return values[0] < values[1];
  if (op === '$lte') return values[0] <= values[1];
  if (op === '$and') return values.every(Boolean);
  if (op === '$or') return values.some(Boolean);
  if (op === '$cond') return expression(arg.if ?? arg[0], doc, variables) ? expression(arg.then ?? arg[1], doc, variables) : expression(arg.else ?? arg[2], doc, variables);
  if (op === '$month') return new Date(values).getUTCMonth() + 1;
  if (op === '$isoWeek') { const date=new Date(values);date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()+4-(date.getUTCDay()||7));const start=new Date(Date.UTC(date.getUTCFullYear(),0,1));return Math.ceil((((date-start)/86400000)+1)/7); }
  if (op === '$year' || op === '$isoWeekYear') return new Date(values).getUTCFullYear();
  return values;
};

async function aggregate(Model, pipeline) {
  const stages = [...pipeline];
  const initialFilter = stages[0]?.$match || {};
  if (stages[0]?.$match) stages.shift();
  let rows = (await Model.find(initialFilter).lean()).map(clone);
  for (const stage of stages) {
    const [op, arg] = Object.entries(stage)[0];
    if (op === '$match') rows = rows.filter(row => matches(row, arg));
    else if (op === '$sort') rows.sort((a,b) => Object.entries(arg).reduce((v,[k,d]) => v || ((get(a,k)>get(b,k)?1:get(a,k)<get(b,k)?-1:0)*d),0));
    else if (op === '$limit') rows = rows.slice(0, arg);
    else if (op === '$count') rows = [{ [arg]: rows.length }];
    else if (op === '$unwind') { const path = String(arg.path || arg).replace(/^\$/,''); const keep = arg.preserveNullAndEmptyArrays; rows = rows.flatMap(row => { const list=get(row,path); return Array.isArray(list)&&list.length ? list.map(item=>{const x=clone(row);set(x,path,item);return x;}) : keep?[row]:[]; }); }
    else if (op === '$addFields' || op === '$set') rows = rows.map(row => { const x=clone(row); for(const [k,v] of Object.entries(arg))set(x,k,expression(v,row)); return x; });
    else if (op === '$project') rows = rows.map(row => { const x=arg._id===0?{}:{_id:row._id}; for(const [k,v] of Object.entries(arg)){ if(k==='_id')continue; if(v===1)x[k]=get(row,k); else if(v!==0)x[k]=expression(v,row); } return x; });
    else if (op === '$lookup') { const foreign=[...registry.values()].find(m=>m.collectionName===arg.from); const all=foreign?await foreign.find({}).lean():[]; rows=rows.map(row=>({...row,[arg.as]:all.filter(item=>String(get(item,arg.foreignField))===String(get(row,arg.localField)))})); }
    else if (op === '$group') {
      const groups = new Map();
      for (const row of rows) { const key=expression(arg._id,row); const token=JSON.stringify(key); if(!groups.has(token))groups.set(token,{_id:key,__rows:[]}); groups.get(token).__rows.push(row); }
      rows=[...groups.values()].map(group=>{ const out={_id:group._id}; for(const [k,spec] of Object.entries(arg)){if(k==='_id')continue; const [acc,val]=Object.entries(spec)[0]; const vals=group.__rows.map(r=>expression(val,r)); if(acc==='$sum')out[k]=vals.reduce((a,b)=>a+Number(b||0),0); else if(acc==='$avg')out[k]=vals.reduce((a,b)=>a+Number(b||0),0)/(vals.length||1); else if(acc==='$first')out[k]=vals[0]; else if(acc==='$push')out[k]=vals; } return out; });
    }
  }
  return rows;
}

class Query {
  constructor(Model, filter = {}, one = false) { this.Model=Model; this.filter=filter||{}; this.one=one; this.options={}; this.populates=[]; this.plain=false; }
  sort(value) { this.sortValue=value; this.options.order = typeof value === 'string' ? value.trim().split(/\s+/).map(x=>[x.replace(/^-/,''),x.startsWith('-')?'DESC':'ASC']) : Object.entries(value).map(([k,v])=>[k,v<0?'DESC':'ASC']); this.options.order=this.options.order.map(([k,d])=>[k==='_id'?'id':k,d]); return this; }
  limit(value) { this.options.limit=Number(value); return this; }
  skip(value) { this.options.offset=Number(value); return this; }
  select(value) { this.selection=value; return this; }
  populate(path, select) { if (isPlain(path)) this.populates.push(path); else this.populates.push({path,select}); return this; }
  lean() { this.plain=true; return this; }
  session() { return this; }
  async exec() {
    await this.Model._ready();
    const sqlCompatible=isSqlFilter(this.filter,this.Model.schema.definition)&&(!this.options.order||this.options.order.every(([key])=>key==='id'||Object.hasOwn(this.Model.schema.definition,key)));
    const sqlOptions=sqlCompatible?this.options:{};
    let rows=await this.Model._sql.findAll({where:sqlWhere(this.filter,this.Model.schema.definition),...sqlOptions});
    let docs=rows.map(row=>this.Model._hydrate(row.get({plain:true}))).filter(doc=>matches(doc,this.filter));
    if(!sqlCompatible){if(this.sortValue){const order=typeof this.sortValue==='string'?this.sortValue.trim().split(/\s+/).map(x=>[x.replace(/^-/,''),x.startsWith('-')?-1:1]):Object.entries(this.sortValue);docs.sort((a,b)=>order.reduce((v,[k,d])=>v||((get(a,k)>get(b,k)?1:get(a,k)<get(b,k)?-1:0)*d),0));}if(this.options.offset)docs=docs.slice(this.options.offset);if(this.options.limit!=null)docs=docs.slice(0,this.options.limit);}
    if(this.one) docs=docs.slice(0,1);
    for(const pop of this.populates) await this.Model._populateBatch(docs,pop);
    if(this.selection) docs=docs.map(doc=>this.Model._select(doc,this.selection));
    const result=this.one?(docs[0]||null):docs;
    return this.plain ? (Array.isArray(result)?result.map(x=>x.toObject()):result?.toObject()||result) : result;
  }
  then(resolve,reject){return this.exec().then(resolve,reject);}
  catch(reject){return this.exec().catch(reject);}
}

function model(name, schema) {
  if (registry.has(name)) return registry.get(name);
  class Model {
    constructor(values = {}) {
      for(const [key,raw] of Object.entries(schema.definition)){ const fallback=defaultFor(normalizeSpec(raw)); if(fallback!==undefined)this[key]=fallback; }
      Object.assign(this, clone(serialize(values)));
      this._id=String(values._id || values.id || id());
      this.isNew=!values._persisted;
      this._original=values._persisted ? clone(this.toObject()) : null;
    }
    toObject(){ const out={}; for(const key of Object.keys(this)){if(!key.startsWith('_')||key==='_id')out[key]=serialize(this[key]);} for(const [k,getter] of Object.entries(schema._virtuals))out[k]=getter.call(this); return out; }
    toJSON(){ return this.toObject(); }
    async validate(){
      const errors={};
      this._validationErrors=errors;
      for(const [key,raw] of Object.entries(schema.definition)) validateValue(raw,this[key],key,errors);
      for(const hook of schema._hooks.validate||[]) await hook.call(this);
      delete this._validationErrors;
      if(Object.keys(errors).length){const error=new Error(Object.values(errors).map(e=>e.message).join(', '));error.name='ValidationError';error.errors=errors;throw error;} return this;
    }
    invalidate(path,message){(this._validationErrors||={})[path]=new Error(message);}
    async save(options={}){ await this.validate(); for(const hook of schema._hooks.save||[])await hook.call(this); await Model._ready(); const persist=async transaction=>{const values=Model._serialize(this);await Model._sql.upsert(values,{transaction});await Model._syncLinks(this,transaction);};if(options.transaction)await persist(options.transaction);else await sequelize.transaction(persist);this.isNew=false;this._original=clone(this.toObject());return this; }
    async deleteOne(){await Model.deleteOne({_id:this._id});}
    set(values){Object.assign(this,values);return this;}
    get(path){return get(this,path);}
    isModified(path){return this.isNew || JSON.stringify(get(this,path))!==JSON.stringify(get(this._original,path));}
  }
  Object.assign(Model.prototype,schema.methods); Object.assign(Model,schema.statics);
  const collectionOverrides = { Activity: 'activities', PerSongAnalytics: 'personganalytics' };
  Model.modelName=name; Model.schema=schema; Model.collectionName=schema.options.collection || collectionOverrides[name] || `${name.replace(/([a-z])([A-Z])/g,'$1$2').toLowerCase()}s`;
  Model._ready=async()=>{
    if(Model._sql)return;
    if(!sequelize)throw new Error('MySQL is not connected');
    const columns={id:{type:DataTypes.CHAR(24),primaryKey:true}};
    for(const [key,raw] of Object.entries(schema.definition)){
      const spec=normalizeSpec(raw);
      const options={allowNull:!spec.required};
      if(Object.hasOwn(spec,'default')&&typeof spec.default!=='function'&&spec.kind!=='json')options.defaultValue=spec.default;
      if(spec.kind==='json')options.type=DataTypes.JSON;
      else if(spec.type===Number)options.type=/(amount|balance|budget|revenue|income|expense|paid|value|rate|percentage|royalty|cost|fee|advance|spent|profit)/i.test(key)?DataTypes.DECIMAL(19,4):DataTypes.DOUBLE;
      else if(spec.type===Boolean)options.type=DataTypes.BOOLEAN;
      else if(spec.type===Date)options.type=DataTypes.DATE(3);
      else if(spec.type===ObjectId)options.type=DataTypes.CHAR(24);
      else if(spec.enum?.length&&spec.enum.every(value=>typeof value==='string'))options.type=DataTypes.ENUM(...spec.enum);
      else if(/path/i.test(key))options.type=DataTypes.STRING(512);
      else options.type=/(description|notes|bio|lyrics|content|details|terms|url)/i.test(key)?DataTypes.TEXT:DataTypes.STRING(191);
      if(spec.unique)options.unique=true;
      columns[key]=options;
    }
    Model._sql=sequelize.define(name,columns,{tableName:Model.collectionName,timestamps:schema.options.timestamps!==false,freezeTableName:true});
  };
  Model._serialize=doc=>{const out={id:String(doc._id)};for(const [key,raw] of Object.entries(schema.definition)){if(doc[key]===undefined)continue;const spec=normalizeSpec(raw),value=doc[key];if(spec.type===ObjectId)out[key]=value==null?value:String(value._id||value);else if(spec.array&&spec.ref)out[key]=(value||[]).map(item=>String(item?._id||item));else out[key]=serialize(value);}if(doc.createdAt)out.createdAt=doc.createdAt;if(doc.updatedAt)out.updatedAt=doc.updatedAt;return out;};
  Model._syncLinks=async(doc,transaction)=>{const query=sequelize.getQueryInterface();for(const [field,raw] of Object.entries(schema.definition)){const spec=normalizeSpec(raw);if(!spec.array||!spec.ref)continue;const table=linkTable(Model.collectionName,field);await query.bulkDelete(table,{ownerId:String(doc._id)},{transaction});const rows=(doc[field]||[]).map((targetId,position)=>({ownerId:String(doc._id),targetId:String(targetId?._id||targetId),position}));if(rows.length)await query.bulkInsert(table,rows,{transaction});}};
  Model._hydrate=row=>{const values={...row};for(const [key,raw] of Object.entries(schema.definition)){const spec=normalizeSpec(raw);if(spec.type===Number&&values[key]!=null)values[key]=Number(values[key]);}return new Model({...values,_id:row.id,_persisted:true});};
  Model._select=(doc,selection)=>{const tokens=(typeof selection==='string'?selection.split(/\s+/):Object.keys(selection)).filter(Boolean);const exclusion=tokens.some(x=>x.startsWith('-'));if(exclusion){for(const token of tokens)if(token.startsWith('-'))delete doc[token.slice(1)];return doc;}if(tokens.every(x=>x.startsWith('+')))return doc;const base={_id:doc._id};for(const token of tokens){const key=token.replace(/^\+/,'');if(doc[key]!==undefined)base[key]=doc[key];}return new Model({...base,_persisted:true});};
  Model._populate=async(doc,pop)=>{const path=pop.path,segments=path.split('.');const spec=specAtPath(schema.definition,segments);const ref=spec.ref||pop.model;if(!ref)return;const Foreign=registry.get(ref);if(!Foreign)return;const walk=async(container,parts)=>{if(container==null)return;if(Array.isArray(container)){await Promise.all(container.map(item=>walk(item,parts)));return;}const key=parts[0];if(parts.length>1)return walk(container[key],parts.slice(1));const value=container[key];if(!value)return;container[key]=Array.isArray(value)?await Promise.all(value.map(x=>Foreign.findById(x).select(pop.select||''))):await Foreign.findById(value).select(pop.select||'');};await walk(doc,segments);};
  Model._populateBatch=async(docs,pop)=>{if(!docs.length)return;const path=pop.path;if(path.includes('.')){for(const doc of docs)await Model._populate(doc,pop);return;}const spec=specAtPath(schema.definition,[path]);const ref=spec.ref||pop.model;const Foreign=ref&&registry.get(ref);if(!Foreign)return;const ids=[...new Set(docs.flatMap(doc=>Array.isArray(doc[path])?doc[path]:[doc[path]]).filter(Boolean).map(String))];if(!ids.length)return;let related=await Foreign.find({_id:{$in:ids}});if(pop.select)related=related.map(doc=>Foreign._select(doc,pop.select));const byId=new Map(related.map(doc=>[String(doc._id),doc]));for(const doc of docs)doc[path]=Array.isArray(doc[path])?doc[path].map(value=>byId.get(String(value))).filter(Boolean):byId.get(String(doc[path]))||null;};
  Model.find=filter=>new Query(Model,filter,false); Model.findOne=filter=>new Query(Model,filter,true); Model.findById=value=>new Query(Model,{_id:String(value)},true);
  Model.create=async values=>{if(Array.isArray(values))return Promise.all(values.map(v=>Model.create(v)));const doc=new Model(values);return doc.save();};
  Model.insertMany=values=>Promise.all(values.map(v=>Model.create(v)));
  Model.findByIdAndUpdate=(value,update,options={})=>Model.findOneAndUpdate({_id:String(value)},update,options);
  Model.findOneAndUpdate=async(filter,update,options={})=>{let doc=await Model.findOne(filter);if(!doc&&options.upsert)doc=new Model(filter);if(!doc)return null;const values=update.$set||update;for(const [k,v] of Object.entries(values))if(!k.startsWith('$'))set(doc,k,v);for(const [k,v] of Object.entries(update.$inc||{}))set(doc,k,Number(get(doc,k)||0)+Number(v));for(const [k,v] of Object.entries(update.$push||{}))(doc[k]||=[]).push(...(v.$each||[v]));for(const [k,v] of Object.entries(update.$addToSet||{})){const list=doc[k]||=[];for(const item of(v.$each||[v]))if(!list.some(x=>String(x)===String(item)))list.push(item);}for(const [k,v] of Object.entries(update.$pull||{}))doc[k]=(doc[k]||[]).filter(x=>!matches(x,v));for(const k of Object.keys(update.$unset||{}))set(doc,k,undefined);await doc.save();return doc;};
  Model.findByIdAndDelete=value=>Model.findOneAndDelete({_id:String(value)}); Model.findOneAndDelete=async filter=>{const doc=await Model.findOne(filter);if(doc)await Model.deleteOne({_id:doc._id});return doc;};
  Model.updateOne=async(filter,update,options)=>{const doc=await Model.findOneAndUpdate(filter,update,options);return{matchedCount:doc?1:0,modifiedCount:doc?1:0,upsertedId:doc?doc._id:null};};
  Model.updateMany=async(filter,update)=>{const docs=await Model.find(filter);for(const doc of docs)await Model.findOneAndUpdate({_id:doc._id},update);return{matchedCount:docs.length,modifiedCount:docs.length};};
  Model.deleteOne=async filter=>{const doc=await Model.findOne(filter);if(!doc)return{deletedCount:0};await Model._ready();await Model._sql.destroy({where:{id:String(doc._id)}});return{deletedCount:1};};
  Model.deleteMany=async filter=>{const docs=await Model.find(filter);await Model._ready();if(docs.length)await Model._sql.destroy({where:{id:{[Op.in]:docs.map(x=>String(x._id))}}});return{deletedCount:docs.length};};
  Model.countDocuments=async filter=>{await Model._ready();return isSqlFilter(filter,Model.schema.definition)?Model._sql.count({where:sqlWhere(filter,Model.schema.definition)}):(await Model.find(filter).lean()).length;};
  Model.exists=async filter=>Boolean(await Model.findOne(filter));
  Model.distinct=async(field,filter)=>[...new Set((await Model.find(filter).lean()).map(x=>get(x,field)).flat())];
  Model.aggregate=pipeline=>aggregate(Model,pipeline);
  registry.set(name,Model); return Model;
}

const configure = instance => { sequelize=instance; };
const getModels = () => registry;
const connect = async () => require('../config/db')();
const disconnect = async () => sequelize?.close();
const startSession = async () => { const transaction=await sequelize.transaction(); return { transaction, withTransaction:async fn=>{try{const result=await fn();await transaction.commit();return result;}catch(e){await transaction.rollback();throw e;}}, endSession(){} }; };

module.exports = { Schema, model, models: new Proxy({}, {get:(_,key)=>registry.get(key)}), Types:{ObjectId}, configure, getModels, linkTable, connect, disconnect, startSession, connection:{get readyState(){return sequelize?1:0;}}, bcrypt, Op, fn, col, literal };
