const test = require('ava');
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

// test.afterEach(async () => await fs.emptyDir(dir));

test('api.archive', async (t) => {
  await fs.writeFile(dir + '/a.text', 'test file');

  const { body } = await request
    .get(
      url({
        cmd: 'archive',
        name: 'Archive.zip',
        target: encodePath('/'),
        targets: [encodePath('/a.text')],
      })
    )
    .expect(200);
  const archive = body.added?.[0];

  t.truthy(archive?.name);
  t.truthy(archive?.hash);
});

test('api.open', async (t) => {
  const { body } = await request.get(url({ cmd: 'open', init: 1 })).expect(200);

  //   Verify response data
  t.is(body.api, '2.1');
  t.truthy(body.files.length);
  t.truthy(body.cwd.name === 'uploads');
  t.truthy(body.options);
});

test('api.upload', async (t) => {
  await request
    .post(url())
    .field('cmd', 'upload')
    .field('target', volume)
    .attach('upload[]', files.txt);

  // Check that file exists
  t.true(await fs.exists(dir + '/text.txt'));
});

test('api.rm', async (t) => {
  // Create file befor test
  await fs.writeFile(dir + '/text.txt', 'random file');

  await request.get(
    url({
      cmd: 'rm',
      'targets[]': encodePath('/text.txt'),
    })
  );

  //   Check file is deleted
  t.false(await fs.exists(dir + '/text.txt'));
});

test.skip('api.rename', async (t) => {
  await fs.writeFile(resolve(dir, 'rn.txt'), 'Random text');

  await request.get(
    url({
      cmd: 'rename',
      target: encodePath('/rn.txt'),
      name: 'random.txt',
    })
  );
  t.true(await fs.exists(dir + '/random.txt'));

  await fs.de;
});
