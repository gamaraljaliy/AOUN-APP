const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { runInThisContext } = require("node:vm");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");

function compile(path) {
  const filename = resolve(__dirname, path);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return runInThisContext(
    "(function (exports, require) {\n" + outputText + "\n})",
    { filename },
  );
}

const load = compile("../services/reviews.ts");
const draftModule = {};
compile("../ui/reviewDraft.ts")(draftModule, () => {
  assert.fail("unexpected draft runtime dependency");
});
const { createReviewDraft, ratingOwner } = draftModule;

const member = { user: { id: "member-a" }, access_token: "mock-a" };
const other = { user: { id: "member-b" }, access_token: "mock-b" };
const placeId = 7;
const ratingId = 12;
const signal = new AbortController().signal;

function fixture(t, ...replies) {
  const calls = [];
  const client = createClient("https://example.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      async fetch(url, options) {
        calls.push({ url: new URL(url), ...options });
        assert.ok(replies.length, "unexpected request");
        const [status, body] = replies.shift();
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const service = {};
  load(service, (name) => {
    assert.equal(name, "./supabase");
    return { db: () => client };
  });
  t.after(() => assert.equal(replies.length, 0));
  return { ...service, calls };
}

function assertOwnedRequest(call, session, method, withRatingId = false) {
  assert.equal(call.method, method);
  assert.equal(call.url.pathname, "/rest/v1/ratings");
  assert.equal(call.headers.get("Authorization"), "Bearer " + session.access_token);
  assert.equal(call.url.searchParams.get("user_id"), "eq." + session.user.id);
  assert.equal(call.url.searchParams.get("place_id"), "eq." + placeId);
  assert.equal(call.url.searchParams.get("id"), withRatingId ? "eq." + ratingId : null);
  assert.equal(call.signal, signal);
}

test("loads only the current member's rating and returns null for another member", async (t) => {
  const row = { id: ratingId, score: 4, review_text: "Accessible entry" };
  const { getOwnRating, calls } = fixture(t, [200, [row]], [200, []]);
  assert.deepEqual(await getOwnRating(member, placeId, signal), row);
  assert.equal(await getOwnRating(other, placeId, signal), null);
  assertOwnedRequest(calls[0], member, "GET");
  assertOwnedRequest(calls[1], other, "GET");
  assert.equal(calls[0].url.searchParams.get("select"), "id,score,review_text,photo_paths");
});

test("creates a score-only rating with the member token and no explicit owner or photos", async (t) => {
  const { saveRating, calls } = fixture(t, [201, [{ id: ratingId }]]);
  await saveRating(member, placeId, undefined, 1, "  ", signal);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer mock-a");
  assert.deepEqual(JSON.parse(calls[0].body), {
    place_id: placeId, score: 1, review_text: null,
  });
});

test("edits a confirmed member-owned row and trims review text", async (t) => {
  const { saveRating, calls } = fixture(t, [200, [{ id: ratingId }]]);
  await saveRating(member, placeId, ratingId, 5, "  Updated review  ", signal);
  assertOwnedRequest(calls[0], member, "PATCH", true);
  assert.deepEqual(JSON.parse(calls[0].body), { score: 5, review_text: "Updated review" });
});

test("deletes only a confirmed member-owned row", async (t) => {
  const { deleteRating, calls } = fixture(t, [200, [{ id: ratingId }]]);
  await deleteRating(member, placeId, ratingId, signal);
  assertOwnedRequest(calls[0], member, "DELETE", true);
});

test("rejects invalid scores before requesting Supabase", async (t) => {
  const { saveRating, calls } = fixture(t);
  for (const score of [0, 6, 2.5, NaN, Infinity]) {
    await assert.rejects(saveRating(member, placeId, undefined, score, "", signal), RangeError);
  }
  assert.equal(calls.length, 0);
});

test("detects a duplicate create without overwriting the existing review", async (t) => {
  const { saveRating, ReviewConflict, calls } = fixture(t, [409, { code: "23505" }]);
  await assert.rejects(
    saveRating(member, placeId, undefined, 3, "", signal),
    (error) => error instanceof ReviewConflict && error.reason === "duplicate",
  );
  assert.deepEqual(calls.map(({ method }) => method), ["POST"]);
});

test("treats zero-row edits and deletes as unconfirmed", async (t) => {
  const { saveRating, deleteRating, ReviewConflict } = fixture(t, [200, []], [200, []]);
  const unconfirmed = (error) => error instanceof ReviewConflict && error.reason === "unconfirmed";
  await assert.rejects(saveRating(other, placeId, ratingId, 3, "", signal), unconfirmed);
  await assert.rejects(deleteRating(other, placeId, ratingId, signal), unconfirmed);
});

test("surfaces permission and read errors", async (t) => {
  const { getOwnRating, saveRating } = fixture(t, [403, { code: "42501" }], [403, { code: "42501" }]);
  await assert.rejects(getOwnRating(member, placeId, signal), { code: "42501" });
  await assert.rejects(saveRating(member, placeId, undefined, 4, "", signal), { code: "42501" });
});

function draftHarness(t, initial = member) {
  let session = initial;
  let owner;
  let editor;
  let scope;

  function refresh(next, active, profileUnavailable) {
    session = next;
    const nextOwner = ratingOwner(session?.user.id, active, profileUnavailable, owner);
    if (nextOwner === owner) return;
    scope?.abort();
    owner = nextOwner;
    scope = owner ? new AbortController() : undefined;
    editor = owner ? createReviewDraft(null, false) : undefined;
  }

  refresh(initial, true, false);
  t.after(() => scope?.abort());
  return {
    refresh,
    get editor() { return editor; },
    get signal() { return scope?.signal; },
    requests(write, read = async () => null) {
      const ownScope = scope;
      const ownUser = owner;
      return {
        write,
        read,
        isCurrent: () => !ownScope.signal.aborted && session?.user.id === ownUser,
      };
    },
  };
}

test("same-user profile and token refresh preserve the unsaved score and text", (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  const signal = form.signal;
  editor.setScore(4);
  editor.setText("My draft");
  const renewed = { ...member, access_token: "renewed" };

  form.refresh(renewed, false, true);
  assert.equal(form.editor, editor);
  assert.equal(signal.aborted, false);
  editor.setText("Updated while the profile reloads");
  form.refresh(renewed, true, false);
  assert.equal(form.editor.getSnapshot().score, 4);
  assert.equal(form.editor.getSnapshot().text, "Updated while the profile reloads");
});

test("same-user refresh does not cancel an in-flight save", async (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  const signal = form.signal;
  editor.setScore(5);
  editor.setText("Pending review");
  let finish;
  const requests = form.requests((intent) => {
    assert.equal(intent.text, "Pending review");
    return new Promise((resolve) => { finish = resolve; });
  });
  const saving = editor.submit(requests);
  form.refresh({ ...member, access_token: "renewed" }, false, true);
  assert.equal(form.editor, editor);
  assert.equal(signal.aborted, false);
  assert.equal(editor.getSnapshot().status, "pending");
  finish();
  assert.equal(await saving, true);
  assert.equal(editor.getSnapshot().status, "complete");
});

test("switching accounts and logging out discard private drafts", (t) => {
  const form = draftHarness(t);
  const firstSignal = form.signal;
  form.editor.setScore(5);
  form.editor.setText("Account A draft");

  form.refresh(other, false, true);
  assert.equal(firstSignal.aborted, true);
  assert.equal(form.editor, undefined);
  form.refresh(other, true, false);
  assert.equal(form.editor.getSnapshot().score, 0);
  assert.equal(form.editor.getSnapshot().text, "");
  form.editor.setText("Account B draft");
  const secondSignal = form.signal;
  form.refresh(null, false, true);
  assert.equal(secondSignal.aborted, true);
  assert.equal(form.editor, undefined);
  form.refresh(member, true, false);
  assert.equal(form.editor.getSnapshot().text, "");
});

test("a late save response after logout cannot mark the old editor complete", async (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  let finish;
  const saving = editor.submit(form.requests(() => new Promise((resolve) => { finish = resolve; })));
  form.refresh(null, false, true);
  finish();
  assert.equal(await saving, undefined);
  assert.equal(editor.getSnapshot().status, "pending");
  assert.equal(form.editor, undefined);
});

test("pending saves block input and duplicate submits; confirmed failure restores the draft", async (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  let fail;
  let writes = 0;
  editor.setScore(4);
  editor.setText("Keep this draft");
  const requests = form.requests(() => {
    writes++;
    return new Promise((_, reject) => { fail = reject; });
  });
  const saving = editor.submit(requests);
  editor.setScore(2);
  editor.setText("Ignore late input");
  await editor.submit(requests);
  assert.equal(writes, 1);
  assert.equal(editor.getSnapshot().score, 4);
  assert.equal(editor.getSnapshot().text, "Keep this draft");
  fail(new Error("write failed"));
  await saving;
  assert.equal(editor.getSnapshot().feedback, "failed");
  assert.equal(editor.getSnapshot().status, "editing");
  assert.equal(editor.getSnapshot().text, "Keep this draft");
  editor.setText("Now editable");
  editor.setScore(3);
  assert.equal(editor.getSnapshot().text, "Now editable");
  assert.equal(editor.getSnapshot().score, 3);
});

test("uncertain saves recheck the server without sending a second write", async (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  let writes = 0;
  let reads = 0;
  editor.setScore(4);
  editor.setText("  Stored review  ");
  const requests = form.requests(
    async () => { writes++; throw new Error("response lost"); },
    async () => {
      if (++reads === 1) throw new Error("offline");
      return { id: ratingId, score: 4, review_text: "Stored review" };
    },
  );
  await editor.submit(requests);
  assert.equal(editor.getSnapshot().status, "uncertain");
  editor.setText("No edits before verification");
  assert.equal(editor.getSnapshot().text, "  Stored review  ");
  assert.equal(await editor.submit(requests), true);
  assert.equal(writes, 1);
  assert.equal(reads, 2);
});

test("a different server rating after a duplicate create preserves the draft for explicit editing", async (t) => {
  const form = draftHarness(t);
  const editor = form.editor;
  editor.setScore(5);
  editor.setText("My current draft");
  const actual = { id: ratingId, score: 2, review_text: "Other device" };
  await editor.submit(form.requests(
    async () => { throw new Error("duplicate"); },
    async () => actual,
  ));
  assert.equal(editor.getSnapshot().feedback, "changed");
  assert.equal(editor.getSnapshot().rating, actual);
  assert.equal(editor.getSnapshot().text, "My current draft");
  await editor.submit(form.requests(async (intent) => {
    assert.equal(intent.rating.id, ratingId);
    assert.equal(intent.text, "My current draft");
  }));
  assert.equal(editor.getSnapshot().status, "complete");
});
