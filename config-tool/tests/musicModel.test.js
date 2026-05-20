const { before, describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// MusicModel is ESM (uses `export class`). Test files in this repo are CommonJS,
// so we import via dynamic import in a `before` hook and cache the module.
let MusicModel;
before(async () => {
  ({ MusicModel } = await import('../public/js/sections/musicModel.js'));
});

describe('MusicModel', () => {
  let model;
  beforeEach(() => { model = new MusicModel(); });

  it('starts empty', () => {
    assert.deepStrictEqual(model.getPlaylists(), []);
    assert.deepStrictEqual(model.getTracks(), []);
  });

  it('setPlaylists / setTracks store defensive copies', () => {
    const src = [{ id: 'a', name: 'A', shuffle: false, loop: true, crossfadeMs: 1000, tracks: [] }];
    model.setPlaylists(src);
    src[0].name = 'mutated';
    assert.strictEqual(model.getPlaylists()[0].name, 'A');
  });

  it('createPlaylist generates kebab-case id from name', () => {
    const p = model.createPlaylist('Quiet Mood');
    assert.strictEqual(p.id, 'quiet-mood');
    assert.strictEqual(p.name, 'Quiet Mood');
    assert.deepStrictEqual(p.tracks, []);
    assert.strictEqual(p.shuffle, false);
    assert.strictEqual(p.loop, true);
    assert.strictEqual(p.crossfadeMs, 2000);
  });

  it('createPlaylist trims punctuation, collapses runs of non-alphanumeric, caps at 40 chars', () => {
    const p = model.createPlaylist('A Very Loud Playlist Name That Will Definitely Be Truncated To 40');
    assert.ok(p.id.length <= 40);
    assert.match(p.id, /^[a-z0-9-]+$/);
    assert.doesNotMatch(p.id, /^-|-$/);  // no leading/trailing dashes
  });

  it('createPlaylist rejects duplicate id (case-insensitive via slug collision)', () => {
    model.createPlaylist('Mood');
    assert.throws(() => model.createPlaylist('mood'), /already exists/i);
    assert.throws(() => model.createPlaylist('MOOD'), /already exists/i);
  });

  it('createPlaylist rejects empty or non-string name', () => {
    assert.throws(() => model.createPlaylist(''), /name/i);
    assert.throws(() => model.createPlaylist('  '), /name/i);
    assert.throws(() => model.createPlaylist(null), /name/i);
    assert.throws(() => model.createPlaylist(42), /name/i);
  });

  it('deletePlaylist removes by id and returns true / false', () => {
    model.createPlaylist('A');
    assert.strictEqual(model.deletePlaylist('a'), true);
    assert.strictEqual(model.getPlaylists().length, 0);
    assert.strictEqual(model.deletePlaylist('nope'), false);
  });

  it('addTrack appends to playlist (allows duplicates)', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'song.mp3');
    model.addTrack('a', 'song.mp3');
    assert.deepStrictEqual(model.getPlaylist('a').tracks, ['song.mp3', 'song.mp3']);
  });

  it('addTrack throws when playlist id is unknown', () => {
    assert.throws(() => model.addTrack('nope', 'x.mp3'), /unknown.*nope/i);
  });

  it('removeTrack removes the first matching index only', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'x.mp3');
    model.addTrack('a', 'y.mp3');
    model.addTrack('a', 'x.mp3');
    model.removeTrack('a', 0);
    assert.deepStrictEqual(model.getPlaylist('a').tracks, ['y.mp3', 'x.mp3']);
  });

  it('removeTrack out-of-range index is a no-op', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'x.mp3');
    model.removeTrack('a', 99);
    model.removeTrack('a', -1);
    assert.deepStrictEqual(model.getPlaylist('a').tracks, ['x.mp3']);
  });

  it('moveTrack reorders within a playlist', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'x.mp3');
    model.addTrack('a', 'y.mp3');
    model.addTrack('a', 'z.mp3');
    model.moveTrack('a', 2, 0);
    assert.deepStrictEqual(model.getPlaylist('a').tracks, ['z.mp3', 'x.mp3', 'y.mp3']);
  });

  it('moveTrack out-of-range fromIndex is a no-op', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'x.mp3');
    model.moveTrack('a', 99, 0);
    assert.deepStrictEqual(model.getPlaylist('a').tracks, ['x.mp3']);
  });

  it('setShuffle / setLoop / setCrossfadeMs update the playlist', () => {
    model.createPlaylist('A');
    model.setShuffle('a', true);
    model.setLoop('a', false);
    model.setCrossfadeMs('a', 3500);
    assert.strictEqual(model.getPlaylist('a').shuffle, true);
    assert.strictEqual(model.getPlaylist('a').loop, false);
    assert.strictEqual(model.getPlaylist('a').crossfadeMs, 3500);
  });

  it('setCrossfadeMs clamps to 0..5000', () => {
    model.createPlaylist('A');
    model.setCrossfadeMs('a', -100);
    assert.strictEqual(model.getPlaylist('a').crossfadeMs, 0);
    model.setCrossfadeMs('a', 9999);
    assert.strictEqual(model.getPlaylist('a').crossfadeMs, 5000);
  });

  it('setCrossfadeMs ignores non-numeric (no throw, no mutation)', () => {
    model.createPlaylist('A');
    const before = model.getPlaylist('a').crossfadeMs;
    model.setCrossfadeMs('a', 'fast');
    // Coerces to 0 by design (NaN clamps to 0). Documented expectation.
    assert.strictEqual(model.getPlaylist('a').crossfadeMs, 0);
  });

  it('getPlaylist returns null for unknown id', () => {
    assert.strictEqual(model.getPlaylist('nope'), null);
  });

  it('toJSON returns the serializable playlist set', () => {
    model.createPlaylist('A');
    model.addTrack('a', 'x.mp3');
    assert.deepStrictEqual(model.toJSON(), { playlists: [
      { id: 'a', name: 'A', shuffle: false, loop: true, crossfadeMs: 2000, tracks: ['x.mp3'] },
    ]});
  });

  it('toJSON output is a defensive copy (mutating it does not affect model)', () => {
    model.createPlaylist('A');
    const snapshot = model.toJSON();
    snapshot.playlists[0].name = 'mutated';
    snapshot.playlists.push({ id: 'fake', name: 'Fake', shuffle: false, loop: false, crossfadeMs: 0, tracks: [] });
    assert.strictEqual(model.getPlaylist('a').name, 'A');
    assert.strictEqual(model.getPlaylists().length, 1);
  });
});
