const test = require('tape');
const app = require('../app');
const qs = require('qs');
const fs = require('fs-extra');
const { resolve } = require('path');

const request = require('supertest')(app);
const volume = 'v0_Lw';
const dir = resolve(__dirname, '../../media/uploads');

const files = {
  txt: resolve(__dirname, '../files/text.txt'),
  img: resolve(__dirname, '../files/img.jpg'),
};

const encodePath = (path) => 'v0_' + btoa(path);
const decodePath = (string) => atob(string.split('_').pop());

const url = (query = {}) => {
  return `/connector?${qs.stringify(query)}`;
};

test('api.open', async (t) => {
  const res = await request.get(url({ cmd: 'open', init: 1 }));
  t.equal(res.status, 200);
});

test('api.upload', async (t) => {
  await request
    .post(url())
    .field('cmd', 'upload')
    .field('target', volume)
    .attach('upload[]', files.txt);

  t.true(await fs.exists(dir + '/text.txt'));
});

test('api.rm', async (t) => {
  await request.get(
    url({
      cmd: 'rm',
      'targets[]': encodePath('/text.txt'),
    })
  );
  t.false(await fs.exists(dir + '/text.txt'));
});

test('api.rename', async (t) => {
  await fs.writeFile(resolve(dir, 'rn.txt'), 'Random text');

  await request.get(
    url({
      cmd: 'rename',
      target: encodePath('/rn.txt'),
      name: 'random.txt',
    })
  );
  t.true(await fs.exists(dir + '/random.txt'));
});
