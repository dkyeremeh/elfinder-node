const test = require('ava');
const app = require('../dynamic-app');
const qs = require('qs');
const fs = require('fs-extra');
const { resolve } = require('path');

const supertest = require('supertest')(app);

const usersDir = resolve(__dirname, '../../media/users');
const aliceDir = resolve(usersDir, 'alice');
const bobDir = resolve(usersDir, 'bob');

const encodePath = (path) => 'v0_' + btoa(path);

const request = (userId) =>
  supertest.get(`/connector?${qs.stringify({ cmd: 'open', init: 1 })}`).set('x-user-id', userId);

test.before(async () => {
  await fs.emptyDir(aliceDir);
  await fs.emptyDir(bobDir);
  await fs.writeFile(resolve(aliceDir, 'alice-file.txt'), 'alice content');
  await fs.writeFile(resolve(bobDir, 'bob-file.txt'), 'bob content');
});

test('dynamic.roots - alice sees only her files', async (t) => {
  const { body } = await request('alice').expect(200);

  const names = body.files.map((f) => f.name);
  t.true(names.includes('alice-file.txt'), 'alice should see her own file');
  t.false(names.includes('bob-file.txt'), 'alice should not see bob\'s file');
});

test('dynamic.roots - bob sees only his files', async (t) => {
  const { body } = await request('bob').expect(200);

  const names = body.files.map((f) => f.name);
  t.true(names.includes('bob-file.txt'), 'bob should see his own file');
  t.false(names.includes('alice-file.txt'), 'bob should not see alice\'s file');
});

test('dynamic.roots - missing user id returns 401', async (t) => {
  const { status } = await supertest.get(
    `/connector?${qs.stringify({ cmd: 'open', init: 1 })}`
  );
  t.is(status, 401);
});

test('dynamic.roots - writes go to the correct user directory', async (t) => {
  await supertest
    .get(`/connector?${qs.stringify({ cmd: 'mkfile', name: 'new.txt', target: encodePath('/') })}`)
    .set('x-user-id', 'alice')
    .expect(200);

  t.true(await fs.exists(resolve(aliceDir, 'new.txt')), 'file created in alice\'s dir');
  t.false(await fs.exists(resolve(bobDir, 'new.txt')), 'file not created in bob\'s dir');
});
