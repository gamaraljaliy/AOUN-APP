const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { setImmediate: flushRequests } = require("node:timers/promises");
const { runInThisContext } = require("node:vm");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");

function loadModule(path, dependencies = {}) {
  const filename = resolve(__dirname, path);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const run = runInThisContext("(function (exports, require) {\n" + outputText + "\n})", { filename });
  run(exports, (name) => {
    assert.ok(Object.hasOwn(dependencies, name), "unexpected dependency " + name);
    return dependencies[name];
  });
  return exports;
}

const { createFavoritesState } = loadModule("../favorites/state.ts");
const memberA = { user: { id: "member-a" }, access_token: "mock-a" };
const memberB = { user: { id: "member-b" }, access_token: "mock-b" };
const first = { id: 7, name_ar: "Place 7", category_ar: "Category", level: null };
const second = { ...first, id: 8 };

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture(t) {
  const calls = [];
  const replies = [];
  const client = createClient("https://example.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      async fetch(url, options) {
        calls.push({ url: new URL(url), ...options });
        const reply = replies.shift();
        if (!reply) throw new Error("unexpected fetch");
        const [status, body] = await reply;
        return new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const { listFavorites, setFavorite } = loadModule("../services/favorites.ts", {
    "./supabase": { db: () => client },
  });

  function start(member) {
    const snapshots = [];
    const state = createFavoritesState({
      load: (signal) => listFavorites(member, signal),
      write: (id, saved, signal) => setFavorite(member, id, saved, signal),
      publish: (snapshot) => snapshots.push(snapshot),
    });
    t.after(state.stop);
    return { ...state, snapshots, current: () => snapshots.at(-1) };
  }

  t.after(() => assert.equal(replies.length, 0, "all expected fetches occurred"));
  return { calls, replies, start };
}

test("adds and removes a favorite only after a confirmed write", async (t) => {
  const { calls, replies, start } = fixture(t);
  const add = deferred();
  replies.push([200, []], add.promise, [200, [{ place_id: first.id }]]);
  const state = start(memberA);
  await state.ready;

  const adding = state.toggle(first);
  await flushRequests();
  assert.equal(state.current().pendingId, first.id);
  assert.deepEqual(state.current().places, []);
  add.resolve([201]);
  await adding;
  assert.deepEqual(state.current().places, [first]);
  await state.toggle(first);
  assert.deepEqual(state.current().places, []);

  assert.equal(calls[1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1].body), { place_id: first.id });
  assert.equal(calls[2].method, "DELETE");
  assert.equal(calls[2].url.searchParams.get("place_id"), "eq.7");
  assert.equal(calls[2].url.searchParams.get("select"), "place_id");
});

test("treats a duplicate insert as already saved", async (t) => {
  const { replies, start } = fixture(t);
  replies.push([200, []], [409, { code: "23505", message: "duplicate key" }]);
  const state = start(memberA);
  await state.ready;
  await state.toggle(first);
  assert.deepEqual(state.current().places, [first]);
  assert.equal(state.current().failedIds.size, 0);
});

test("serializes rapid actions on different and repeated places", async (t) => {
  const { calls, replies, start } = fixture(t);
  const firstWrite = deferred();
  replies.push([200, []], firstWrite.promise, [201], [200, [{ place_id: first.id }]], [201]);
  const state = start(memberA);
  await state.ready;

  const actions = [first, second, first, first].map(state.toggle);
  await flushRequests();
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "POST"]);
  firstWrite.resolve([201]);
  await Promise.all(actions);
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "POST", "POST", "DELETE", "POST"]);
  assert.deepEqual(state.current().places, [first, second]);
});

test("keeps the favorite and surfaces an error when delete returns zero rows", async (t) => {
  const { replies, start } = fixture(t);
  replies.push([200, [{ place_id: first.id }]], [200, [first]], [200, []],
    [200, [{ place_id: first.id }]]);
  const state = start(memberA);
  await state.ready;
  await state.toggle(first);
  assert.deepEqual(state.current().places.map(({ id }) => id), [first.id]);
  assert.ok(state.current().failedIds.has(first.id));
  assert.equal(state.current().pendingId, undefined);

  await state.toggle(first);
  assert.deepEqual(state.current().places, []);
  assert.equal(state.current().failedIds.size, 0);
});

test("rejects permission errors without changing the list", async (t) => {
  const { replies, start } = fixture(t);
  replies.push([200, []], [403, { code: "42501", message: "RLS denied insert" }]);
  const state = start(memberA);
  await state.ready;
  await state.toggle(first);
  assert.deepEqual(state.current().places, []);
  assert.ok(state.current().failedIds.has(first.id));
});

test("ignores late writes and discards queued actions when switching accounts", async (t) => {
  const { calls, replies, start } = fixture(t);
  const oldWrite = deferred();
  replies.push([200, []], oldWrite.promise, [200, [{ place_id: second.id }]], [200, [second]]);
  const oldAccount = start(memberA);
  await oldAccount.ready;
  const writing = oldAccount.toggle(first);
  const queued = oldAccount.toggle(second);
  await flushRequests();
  const oldUpdates = oldAccount.snapshots.length;
  oldAccount.stop();
  assert.equal(calls[1].signal.aborted, true);

  const newAccount = start(memberB);
  await newAccount.ready;
  oldWrite.resolve([201]);
  await Promise.all([writing, queued]);
  assert.equal(oldAccount.snapshots.length, oldUpdates);
  assert.deepEqual(newAccount.current().places.map(({ id }) => id), [second.id]);
  assert.equal(calls.length, 4);
});

test("ignores a late load response after logout", async (t) => {
  const { calls, replies, start } = fixture(t);
  const oldRead = deferred();
  replies.push(oldRead.promise);
  const state = start(memberA);
  await flushRequests();
  state.stop();
  oldRead.resolve([200, []]);
  await state.ready;
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(state.snapshots.map(({ status }) => status), ["loading"]);
});

test("shows loading, can retry failed loads, and blocks writes until ready", async (t) => {
  const { calls, replies, start } = fixture(t);
  replies.push([403, { code: "42501" }], [403, { code: "42501" }], [200, []]);
  const state = start(memberA);
  assert.equal(state.current().status, "loading");
  await state.toggle(first);
  await state.ready;
  assert.equal(state.current().status, "error");
  await state.retry();
  assert.equal(state.current().status, "error");
  await state.retry();
  assert.deepEqual(state.snapshots.map(({ status }) => status), [
    "loading", "error", "loading", "error", "loading", "ready",
  ]);
  assert.deepEqual(calls.map(({ method }) => method), ["GET", "GET", "GET"]);
});

test("scopes reads and deletes to the owner and pins inserts to the owner token", async (t) => {
  const { calls, replies, start } = fixture(t);
  replies.push([200, [{ place_id: first.id }]], [200, [first]], [200, []],
    [201], [200, [{ place_id: first.id }]]);
  const a = start(memberA);
  await a.ready;
  const b = start(memberB);
  await b.ready;
  assert.deepEqual(b.current().places, []);
  await b.toggle(second);
  await a.toggle(first);

  assert.equal(calls[0].url.searchParams.get("user_id"), "eq.member-a");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer mock-a");
  assert.equal(calls[2].url.searchParams.get("user_id"), "eq.member-b");
  assert.equal(calls[2].headers.get("Authorization"), "Bearer mock-b");
  assert.equal(calls[3].headers.get("Authorization"), "Bearer mock-b");
  assert.equal(calls[4].url.searchParams.get("user_id"), "eq.member-a");
  assert.equal(calls[4].headers.get("Authorization"), "Bearer mock-a");
  assert.deepEqual(a.current().places, []);
  assert.deepEqual(b.current().places, [second]);
});
