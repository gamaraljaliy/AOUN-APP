const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { runInThisContext } = require("node:vm");
const { createClient } = require("@supabase/supabase-js");
const ts = require("typescript");

function load(file, imports, fetch = () => assert.fail("unexpected backend request")) {
  const filename = resolve(__dirname, file);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const run = runInThisContext(
    "(function (exports, require, fetch, process) {\n" + outputText + "\n})", { filename },
  );
  const exports = {};
  run(exports, (name) => {
    assert.ok(Object.hasOwn(imports, name), "Unexpected runtime import " + name);
    return imports[name];
  }, fetch, { env: { EXPO_PUBLIC_API_URL: "https://api.example.invalid" } });
  return exports;
}

const { createReviewPhotoWorkflow } = load("../ui/reviewPhotoWorkflow.ts", {});
const jpeg = Uint8Array.of(255, 216, 255, 217).buffer;
const png = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10).buffer;
const proof = "d".repeat(64);
const ratingId = 42;
const key = "42/00000000-0000-4000-8000-000000000001.jpg";
const secondKey = "42/00000000-0000-4000-8000-000000000002.jpg";
const legacy = "https://legacy.example.invalid/photo.jpg";
const selected = { uri: "file:///private/preview.jpg", bytes: jpeg };
const prepared = { key, proof, mime: "image/jpeg", bytes: jpeg };
const member = { user: { id: "member-a" }, access_token: "mock-a" };
const signal = new AbortController().signal;

function fixture(t, options = {}) {
  const calls = [];
  const replies = [...(options.replies ?? [])];
  const client = createClient("https://supabase.example.invalid", "mock-public", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      async fetch(url, init) {
        calls.push({ url: new URL(url), ...init });
        assert.ok(replies.length, "Unexpected Supabase request");
        const [status, body] = replies.shift();
        return new Response(body === undefined ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const service = load("../services/reviewPhotos.ts", {
    "./supabase": { db: () => client },
    "react-native": { Platform: { OS: options.platform ?? "web" } },
    "expo-file-system": { File: class {
      constructor(uri) { assert.equal(uri, selected.uri); this.size = jpeg.byteLength; }
      async arrayBuffer() { return jpeg; }
    } },
  }, options.backend);
  t.after(() => assert.equal(replies.length, 0));
  return { ...service, calls };
}

test("web and native picker payloads are read as bytes and screened before upload", async (t) => {
  const web = fixture(t);
  const native = fixture(t, { platform: "ios" });
  const android = fixture(t, { platform: "android" });
  const browserFile = new Blob([png], { type: "application/octet-stream" });
  assert.deepEqual(await web.readSelectedPhoto({ uri: "blob:preview", file: browserFile }),
    { uri: "blob:preview", bytes: png });
  assert.deepEqual(await native.readSelectedPhoto({ uri: selected.uri }), selected);
  assert.deepEqual(await android.readSelectedPhoto({ uri: selected.uri }), selected);
  await assert.rejects(web.readSelectedPhoto({ uri: "blob:fake", file: new Blob(["not a JPEG"], { type: "image/jpeg" }) }));
  await assert.rejects(native.readSelectedPhoto({ uri: selected.uri, fileSize: 5 * 1024 * 1024 + 1 }));
});

test("managed display uses the backend and legacy public URLs are preserved", (t) => {
  const { reviewPhotoUri } = fixture(t);
  assert.equal(reviewPhotoUri(ratingId, legacy), legacy);
  assert.equal(reviewPhotoUri(ratingId, key), "https://api.example.invalid/review-photos/42?key=" + encodeURIComponent(key));
  assert.equal(reviewPhotoUri(43, key), undefined);
  assert.equal(reviewPhotoUri(ratingId, selected.uri), undefined);
});

test("photo preparation sends member auth and only accepts a proof for the current rating", async (t) => {
  let expectedKey = key;
  const { prepareReviewPhoto } = fixture(t, {
    backend: async (url, options) => {
      assert.equal(url, "https://api.example.invalid/review-photos/42/prepare");
      assert.equal(options.headers.Authorization, "Bearer mock-a");
      assert.equal(options.body, jpeg);
      assert.equal(options.signal, signal);
      return new Response(jpeg, { headers: {
        "Content-Type": "image/jpeg", "X-Review-Photo-Key": expectedKey, "X-Review-Photo-Proof": proof,
      } });
    },
  });
  assert.deepEqual(await prepareReviewPhoto(member, ratingId, selected, signal), prepared);
  expectedKey = "43/" + key.split("/")[1];
  await assert.rejects(prepareReviewPhoto(member, ratingId, selected, signal));
});

test("upload uses immutable keys and a lost response is confirmed against Storage info", async (t) => {
  const { uploadReviewPhoto, calls } = fixture(t, { replies: [
    [400, { message: "object exists" }],
    [200, { name: key, bucket_id: "review-photos", metadata: { aoun_proof: proof },
      size: jpeg.byteLength, content_type: "image/jpeg" }],
  ] });
  await uploadReviewPhoto(member, prepared);
  assert.equal(calls[0].url.pathname, "/storage/v1/object/review-photos/" + key);
  const headers = new Headers(calls[0].headers);
  assert.equal(headers.get("authorization"), "Bearer mock-a");
  assert.equal(headers.get("x-upsert"), "false");
  assert.deepEqual(JSON.parse(Buffer.from(headers.get("x-metadata"), "base64")), { aoun_proof: proof });
  assert.equal(calls[1].url.pathname, "/storage/v1/object/info/review-photos/" + key);
});

test("an ambiguous upload with mismatched proof cannot become an attachment", async (t) => {
  const { uploadReviewPhoto } = fixture(t, { replies: [
    [400, { message: "upload failed" }],
    [200, { name: key, bucket_id: "review-photos", metadata: { aoun_proof: "wrong" },
      size: jpeg.byteLength, content_type: "image/jpeg" }],
  ] });
  await assert.rejects(uploadReviewPhoto(member, prepared), /could not be confirmed/);
});

test("attachment compares the original list and stores confirmed keys alongside legacy URLs", async (t) => {
  const { attachReviewPhotos, calls } = fixture(t, { replies: [
    [200, [{ id: ratingId, photo_paths: [legacy, key] }]],
    [200, []],
  ] });
  await attachReviewPhotos(member, ratingId, [legacy], [legacy, key], signal);
  await assert.rejects(attachReviewPhotos(member, ratingId, [legacy], [legacy, key], signal));
  assert.equal(calls[0].url.searchParams.get("id"), "eq.42");
  assert.equal(calls[0].url.searchParams.get("user_id"), "eq.member-a");
  assert.equal(calls[0].url.searchParams.get("photo_paths"), 'eq.{"' + legacy + '"}');
  assert.deepEqual(JSON.parse(calls[0].body), { photo_paths: [legacy, key] });
});

test("cleanup uses retirement before removal and leaves external legacy URLs alone", async (t) => {
  const { retireAndRemoveReviewPhoto, calls } = fixture(t, { replies: [
    [204], [200, [{ name: key }]], [403, { message: "denied" }],
  ] });
  await retireAndRemoveReviewPhoto(member, ratingId, legacy, signal);
  await retireAndRemoveReviewPhoto(member, ratingId, key, signal);
  await assert.rejects(retireAndRemoveReviewPhoto(member, ratingId, secondKey, signal));
  assert.deepEqual(calls.map(({ method }) => method), ["POST", "DELETE", "POST"]);
  assert.equal(calls[0].url.pathname, "/rest/v1/rpc/retire_review_photo");
  assert.deepEqual(JSON.parse(calls[0].body), { target_key: key });
  assert.deepEqual(JSON.parse(calls[1].body), { prefixes: [key] });
});

test("a hidden or missing object is not reported as a confirmed removal", async (t) => {
  const { retireAndRemoveReviewPhoto } = fixture(t, { replies: [
    [204], [404, { message: "not found" }],
  ] });
  await assert.rejects(retireAndRemoveReviewPhoto(member, ratingId, key, signal), /could not be confirmed/);
});

function workflowRequests(overrides = {}) {
  return {
    current: () => true,
    prepare: async () => prepared,
    upload: async () => {},
    verify: async () => true,
    read: async () => [],
    attach: async () => {},
    cleanup: async () => {},
    ...overrides,
  };
}

test("partial upload retries the unconfirmed file and never attaches a partial list", async () => {
  const calls = [];
  const workflow = createReviewPhotoWorkflow([legacy], [], [selected, { ...selected, uri: "second" }], false);
  let failSecond = true;
  const requests = workflowRequests({
    read: async () => [legacy],
    prepare: async (photo) => ({ ...prepared, key: photo.uri === "second" ? secondKey : key }),
    upload: async (photo) => {
      calls.push(photo.key);
      if (photo.key === secondKey && failSecond) throw new Error("offline");
    },
    attach: async (before, after) => {
      calls.push("attach");
      assert.deepEqual(before, [legacy]);
      assert.deepEqual(after, [legacy, key, secondKey]);
    },
  });
  assert.equal(await workflow.run(requests), "retry");
  assert.deepEqual(calls, [key, secondKey]);
  failSecond = false;
  assert.equal(await workflow.run(requests), "saved");
  assert.deepEqual(calls, [key, secondKey, secondKey, "attach"]);
});

test("lost attachment response is reconciled before another write", async () => {
  const workflow = createReviewPhotoWorkflow([legacy], [], [selected], false);
  let reads = 0;
  let writes = 0;
  const requests = workflowRequests({
    read: async () => {
      if (++reads === 1) return [legacy];
      if (reads === 2) throw new Error("unconfirmed read");
      return [legacy, key];
    },
    attach: async () => { writes++; throw new Error("response lost"); },
  });
  assert.equal(await workflow.run(requests), "retry");
  assert.equal(await workflow.run(requests), "saved");
  assert.equal(writes, 1);
});

test("replacement attaches first and cleanup retries without changing the review again", async () => {
  const workflow = createReviewPhotoWorkflow([secondKey, legacy], [secondKey], [selected], false);
  const order = [];
  const requests = workflowRequests({
    read: async () => [secondKey, legacy],
    attach: async (_before, after) => {
      assert.deepEqual(after, [legacy, key]);
      order.push("attach");
    },
    cleanup: async (path) => {
      assert.equal(path, secondKey);
      order.push("cleanup");
      if (order.length === 2) throw new Error("remove failed");
    },
  });
  assert.equal(await workflow.run(requests), "cleanup-pending");
  assert.equal(await workflow.run(requests), "saved");
  assert.deepEqual(order, ["attach", "cleanup", "cleanup"]);
});

test("duplicate saves and account switches cannot attach a late upload", async () => {
  const workflow = createReviewPhotoWorkflow([], [], [selected], false);
  let current = true;
  let completeUpload;
  let started;
  const uploading = new Promise((resolve) => { started = resolve; });
  const requests = workflowRequests({
    current: () => current,
    upload: () => new Promise((resolve) => { completeUpload = resolve; started(); }),
    attach: () => assert.fail("late upload must not attach"),
  });
  const pending = workflow.run(requests);
  await uploading;
  assert.equal(await workflow.run(requests), "stopped");
  current = false;
  completeUpload();
  assert.equal(await pending, "stopped");
});

test("concurrent photo edits are preserved and only unreferenced staged files are retired", async () => {
  const workflow = createReviewPhotoWorkflow([], [], [selected], false);
  let reads = 0;
  const removed = [];
  const requests = workflowRequests({
    read: async () => ++reads === 1 ? [] : [secondKey],
    attach: async () => { throw new Error("compare-and-swap lost"); },
    cleanup: async (path) => { removed.push(path); },
  });
  assert.equal(await workflow.run(requests), "retry");
  assert.equal(await workflow.run(requests), "conflict");
  assert.deepEqual(removed, [key]);
});

test("confirmed rating deletion cleans managed photos without an attachment write", async () => {
  const workflow = createReviewPhotoWorkflow([key], [key], [], true);
  const removed = [];
  assert.equal(await workflow.run(workflowRequests({
    read: () => assert.fail("deletion has been confirmed"),
    attach: () => assert.fail("rating was deleted"),
    cleanup: async (path) => { removed.push(path); },
  })), "saved");
  assert.deepEqual(removed, [key]);
});

test("temporary preparation or verification failures remain retryable", async (t) => {
  const statuses = [503, 422, 503, 204];
  const { prepareReviewPhoto, verifyUploadedReviewPhoto } = fixture(t, {
    backend: async (url, init) => {
      assert.equal(init.headers.Authorization, "Bearer mock-a");
      assert.equal(init.method, "POST");
      if (url.includes("/verify")) assert.equal(new URL(url).searchParams.get("key"), key);
      return new Response(null, { status: statuses.shift() });
    },
  });
  await assert.rejects(prepareReviewPhoto(member, ratingId, selected, signal));
  assert.equal(await prepareReviewPhoto(member, ratingId, selected, signal), null);
  await assert.rejects(verifyUploadedReviewPhoto(member, ratingId, key, signal));
  assert.equal(await verifyUploadedReviewPhoto(member, ratingId, key, signal), true);
});

test("permanently rejected bytes are never retried and can be replaced in the saved review", async () => {
  const valid = { ...selected, uri: "good" };
  const invalid = { ...selected, uri: "bad" };
  const replacement = { ...selected, uri: "replacement" };
  const workflow = createReviewPhotoWorkflow([legacy], [], [valid, invalid], false);
  const order = [];
  const requests = workflowRequests({
    read: async () => [legacy],
    prepare: async (photo) => {
      order.push(photo.uri);
      return photo === invalid ? null : { ...prepared, key: photo === valid ? key : secondKey };
    },
    upload: async (photo) => { order.push("upload " + photo.key); },
    verify: async (photo) => { order.push("verify " + photo.key); return true; },
    attach: async (before, after) => {
      assert.deepEqual(before, [legacy]);
      assert.deepEqual(after, [legacy, key, secondKey]);
      order.push("attach");
    },
  });
  assert.equal(await workflow.run(requests), "invalid");
  assert.ok(workflow.isRejected(invalid));
  assert.equal(await workflow.run(requests), "invalid");
  assert.equal(workflow.removeRejected(valid), false);
  assert.equal(workflow.removeRejected(invalid), true);
  workflow.addReplacement(replacement);
  assert.equal(await workflow.run(requests), "saved");
  assert.deepEqual(order, ["good", "upload " + key, "verify " + key, "bad",
    "replacement", "upload " + secondKey, "verify " + secondKey, "attach"]);
});

test("a lost verification response is retried without uploading or attaching again", async () => {
  const workflow = createReviewPhotoWorkflow([], [], [selected], false);
  const events = [];
  let verifyAttempts = 0;
  const requests = workflowRequests({
    upload: async () => { events.push("upload"); },
    verify: async () => {
      events.push("verify");
      if (++verifyAttempts === 1) throw new Error("lost verification response");
      return true;
    },
    attach: async () => { events.push("attach"); },
  });
  assert.equal(await workflow.run(requests), "retry");
  assert.equal(await workflow.run(requests), "saved");
  assert.deepEqual(events, ["upload", "verify", "verify", "attach"]);
});

test("an uploaded object rejected by the verifier is not attached and can be cleaned up", async () => {
  const workflow = createReviewPhotoWorkflow([], [], [selected], false);
  const removed = [];
  const requests = workflowRequests({
    verify: async () => false,
    cleanup: async (path) => { removed.push(path); },
    attach: () => assert.fail("rejected object must not be attached"),
  });
  assert.equal(await workflow.run(requests), "invalid");
  assert.ok(workflow.removeRejected(selected));
  assert.equal(await workflow.run(requests), "saved");
  assert.deepEqual(removed, [key]);
});
