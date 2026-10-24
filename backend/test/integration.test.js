import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-thirty-two-characters';
const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/stockroom_test';
process.env.MONGO_URI = mongoUri;
if (!new URL(mongoUri).pathname.endsWith('_test')) throw new Error('TEST_MONGO_URI database name must end in _test. Never run against a real inventory database.');
const runUri = new URL(mongoUri);
runUri.pathname += `_${randomUUID().replaceAll('-', '')}`;
const { default: app } = await import('../src/app.js');
const { default: User } = await import('../src/models/User.js');
const { default: Product } = await import('../src/models/Product.js');
const { default: Supplier } = await import('../src/models/Supplier.js');
const admin = request.agent(app);
const manager = request.agent(app);
const viewer = request.agent(app);
let adminUser, managerUser, viewerUser, product, supplier;
let connected = false;
const password = 'Test-password-123!';
const productBody = { name: 'Test keyboard', sku: 'TEST-KB-01', category: 'Electronics', price: 45.50, quantity: 10, reorderLevel: 5, supplier: null, description: 'Test item' };

before(async () => {
  await mongoose.connect(runUri.toString(), { serverSelectionTimeoutMS: 5000 });
  connected = true;
  await Promise.all([User.init(), Product.init(), Supplier.init()]);
  const hash = await bcrypt.hash(password, 4);
  [adminUser, managerUser, viewerUser] = await User.create([
    { name: 'Test Admin', email: 'admin@test.example', password: hash, role: 'admin' },
    { name: 'Test Manager', email: 'manager@test.example', password: hash, role: 'manager' },
    { name: 'Test Viewer', email: 'viewer@test.example', password: hash, role: 'viewer' },
  ]);
  for (const [agent, email] of [[admin, adminUser.email], [manager, managerUser.email], [viewer, viewerUser.email]]) {
    const res = await agent.post('/api/auth/login').send({ email, password });
    assert.equal(res.status, 200);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
    assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);
    assert.equal(res.body.user.password, undefined);
  }
});
after(async () => { if (connected) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });

test('health endpoint works; inventory requires authentication', async () => {
  assert.equal((await request(app).get('/api/health')).status, 200);
  assert.equal((await request(app).get('/api/products')).status, 401);
});
test('wrong passwords, forged JWTs and expired JWTs are rejected', async () => {
  assert.equal((await request(app).post('/api/auth/login').send({ email: adminUser.email, password: 'incorrect' })).status, 401);
  const forged = jwt.sign({ version: 0 }, 'a-different-secret', { subject: String(adminUser._id), issuer: 'stockroom', audience: 'stockroom-web' });
  assert.equal((await request(app).get('/api/products').set('Cookie', `access_token=${forged}`)).status, 401);
  const expired = jwt.sign({ version: 0 }, process.env.JWT_SECRET, { subject: String(adminUser._id), issuer: 'stockroom', audience: 'stockroom-web', expiresIn: -1 });
  assert.equal((await request(app).get('/api/products').set('Cookie', `access_token=${expired}`)).status, 401);
});
test('registration is viewer-only and cannot accept an injected role', async () => {
  const data = { name: 'New Member', email: 'new@test.example', password };
  assert.equal((await request(app).post('/api/auth/register').send({ ...data, role: 'admin' })).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({ ...data, password: 'short' })).status, 400);
  const res = await request(app).post('/api/auth/register').send(data);
  assert.equal(res.status, 201);
  assert.equal(res.body.user.role, 'viewer');
  assert.equal((await request(app).post('/api/auth/register').send(data)).status, 409);
});
test('cross-origin browser mutations are blocked', async () => {
  assert.equal((await admin.post('/api/products').set('Origin', 'https://untrusted.example').send(productBody)).status, 403);
  assert.equal((await admin.post('/api/products').set('Sec-Fetch-Site', 'cross-site').send(productBody)).status, 403);
});
test('viewers can read but cannot create products or suppliers or list users', async () => {
  assert.equal((await viewer.get('/api/products')).status, 200);
  assert.equal((await viewer.get('/api/suppliers')).status, 200);
  assert.equal((await viewer.get('/api/products/activity')).status, 200);
  assert.equal((await viewer.post('/api/products').send(productBody)).status, 403);
  assert.equal((await viewer.post('/api/suppliers').send({ name: 'Blocked', email: 'test@supplier.example' })).status, 403);
  assert.equal((await viewer.get('/api/users')).status, 403);
});
test('managers can create suppliers and products with validated fields', async () => {
  const s = await manager.post('/api/suppliers').send({ name: 'Test supplier', email: 'supplier@test.example', phone: '', location: 'Colombo' });
  assert.equal(s.status, 201); supplier = s.body.supplier;
  const res = await manager.post('/api/products').send({ ...productBody, supplier: supplier._id });
  assert.equal(res.status, 201); product = res.body.product;
  assert.equal(product.quantity, 10);
  assert.equal(product.supplier.name, 'Test supplier');
  assert.equal(product.movements[0].reason, 'Opening stock');
  assert.equal((await manager.post('/api/products').send(productBody)).status, 409);
  assert.equal((await manager.post('/api/products').send({ ...productBody, sku: 'OTHER-SKU', quantity: -1 })).status, 400);
  assert.equal((await manager.post('/api/products').send({ ...productBody, sku: 'OTHER-SKU', price: 1.111 })).status, 400);
  assert.equal((await manager.post('/api/products').send({ ...productBody, sku: 'OTHER-SKU', supplier: new mongoose.Types.ObjectId().toString() })).status, 400);
});
test('stock updates record balance and actor; negative stock and stale writes fail', async () => {
  const body = { delta: -3, reason: 'Order fulfilled', version: product.__v };
  assert.equal((await viewer.post(`/api/products/${product._id}/stock`).send(body)).status, 403);
  const res = await manager.post(`/api/products/${product._id}/stock`).send(body);
  assert.equal(res.status, 200);
  assert.equal(res.body.product.quantity, 7);
  assert.equal(res.body.product.movements.at(-1).balance, 7);
  assert.equal(res.body.product.movements.at(-1).actor, 'Test Manager');
  assert.equal((await manager.post(`/api/products/${product._id}/stock`).send(body)).status, 409);
  product = res.body.product;
  assert.equal((await manager.post(`/api/products/${product._id}/stock`).send({ delta: -8, reason: 'Too much', version: product.__v })).status, 400);
  assert.equal((await manager.post(`/api/products/${product._id}/stock`).send({ delta: 0, reason: 'No change', version: product.__v })).status, 400);
});
test('only one of two simultaneous stock edits succeeds', async () => {
  const responses = await Promise.all([
    manager.post(`/api/products/${product._id}/stock`).send({ delta: 2, reason: 'Shipment A', version: product.__v }),
    manager.post(`/api/products/${product._id}/stock`).send({ delta: 4, reason: 'Shipment B', version: product.__v }),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  product = responses.find(r => r.status === 200).body.product;
  const saved = await Product.findById(product._id);
  assert.equal(saved.quantity, product.quantity);
  assert.equal(saved.movements.at(-1).balance, product.quantity);
});
test('product edits cannot bypass stock history and must use the current version', async () => {
  const { quantity, ...fields } = productBody;
  const body = { ...fields, name: 'Updated keyboard', supplier: supplier._id, version: product.__v };
  assert.equal((await manager.put(`/api/products/${product._id}`).send({ ...body, quantity: 999 })).status, 400);
  const res = await manager.put(`/api/products/${product._id}`).send(body);
  assert.equal(res.status, 200);
  assert.equal(res.body.product.name, 'Updated keyboard');
  assert.equal(res.body.product.quantity, product.quantity);
  assert.equal((await manager.put(`/api/products/${product._id}`).send(body)).status, 409);
  product = res.body.product;
});
test('admin role changes are enforced immediately and invalidate old sessions', async () => {
  assert.equal((await manager.get('/api/users')).status, 403);
  const res = await admin.get('/api/users');
  assert.equal(res.status, 200);
  assert.ok(res.body.users.every(u => !('password' in u) && !('tokenVersion' in u)));
  assert.equal((await admin.patch(`/api/users/${adminUser._id}/role`).send({ role: 'viewer' })).status, 400);
  assert.equal((await manager.patch(`/api/users/${viewerUser._id}/role`).send({ role: 'admin' })).status, 403);
  assert.equal((await admin.patch(`/api/users/${viewerUser._id}/role`).send({ role: 'manager' })).status, 200);
  assert.equal((await viewer.get('/api/products')).status, 401);
});
test('archive requires admin access and retains history', async () => {
  const url = `/api/products/${product._id}`;
  assert.equal((await manager.delete(url).send({ version: product.__v })).status, 403);
  assert.equal((await admin.delete(url).send({ version: 0 })).status, 409);
  assert.equal((await admin.delete(url).send({ version: product.__v })).status, 204);
  assert.equal((await admin.get('/api/products')).body.products.length, 0);
  assert.ok((await admin.get('/api/products/activity')).body.movements.length > 0);
  assert.equal((await admin.post(`${url}/stock`).send({ delta: 1, reason: 'Should fail', version: product.__v + 1 })).status, 404);
});
test('invalid IDs and malformed JSON return controlled errors', async () => {
  assert.equal((await manager.post('/api/products/bad-id/stock').send({ delta: 1, reason: 'Invalid', version: 0 })).status, 400);
  assert.equal((await manager.post('/api/products').set('Content-Type', 'application/json').send('{oops')).status, 400);
  assert.equal((await manager.get('/api/unknown')).status, 404);
});
test('logout revokes the JWT even if its cookie is copied', async () => {
  const response = await request(app).post('/api/auth/login').send({ email: managerUser.email, password });
  const cookie = response.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status, 204);
  assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookie)).status, 401);
});
