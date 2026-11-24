const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { test } = require("node:test");

const compiled = mkdtempSync(join(tmpdir(), "aoun-auth-links-"));
let authLinkKind;
let createAuthLinkHandler;
try {
  const config = join(compiled, "tsconfig.json");
  writeFileSync(
    config,
    JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        strict: true,
        types: [],
        outDir: join(compiled, "build"),
      },
      files: [resolve(__dirname, "../services/auth-links.ts")],
    }),
  );
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", config], {
    stdio: "pipe",
  });
  ({ authLinkKind, createAuthLinkHandler } = require(
    join(compiled, "build/auth-links.js")
  ));
} finally {
  rmSync(compiled, { recursive: true, force: true });
}

function fixture(overrides = {}) {
  const calls = { exchange: [], profile: [], signOut: 0 };
  const handle = createAuthLinkHandler({
    async exchange(code) {
      calls.exchange.push(code);
      return overrides.exchange ? overrides.exchange(code) : `user-${code}`;
    },
    async readProfile(id) {
      calls.profile.push(id);
      return overrides.readProfile
        ? overrides.readProfile(id)
        : { role: "member", status: "active" };
    },
    async signOut() {
      calls.signOut++;
      if (overrides.signOut) await overrides.signOut();
    },
  });
  return { handle, calls };
}

test("confirmation is the default; recovery must be explicit", () => {
  for (const flow of [undefined, "", "signup", "confirmation", "unknown"]) {
    assert.equal(authLinkKind(flow), "confirmation");
  }
  assert.equal(authLinkKind("recovery"), "recovery");
});

test("active members and admins reach the correct destination for each flow", async () => {
  for (const role of ["member", "admin"]) {
    for (const flow of [undefined, "recovery"]) {
      const { handle, calls } = fixture({
        readProfile: async () => ({ role, status: "active" }),
      });
      assert.deepEqual(await handle({ code: "valid", flow }), {
        status: "ready",
        kind: flow === "recovery" ? "recovery" : "confirmation",
        destination:
          flow === "recovery" ? "/update-password" : role === "admin" ? "/admin/places" : "/home",
      });
      assert.deepEqual(calls.exchange, ["valid"]);
      assert.deepEqual(calls.profile, ["user-valid"]);
      assert.equal(calls.signOut, 0);
    }
  }
});

test("concurrent and later calls for one code share the entire resolution", async () => {
  let releaseProfile;
  const profile = new Promise((resolveProfile) => { releaseProfile = resolveProfile; });
  const { handle, calls } = fixture({ readProfile: () => profile });
  const first = handle({ code: "once" });
  const second = handle({ code: "once", flow: "signup" });
  releaseProfile({ role: "member", status: "active" });
  assert.deepEqual(await first, await second);
  assert.deepEqual(await handle({ code: "once" }), await first);
  assert.deepEqual(calls.exchange, ["once"]);
  assert.deepEqual(calls.profile, ["user-once"]);
});

test("the exchange is shared across flow kinds while destinations stay separate", async () => {
  const { handle, calls } = fixture();
  const [confirmation, recovery] = await Promise.all([
    handle({ code: "shared" }),
    handle({ code: "shared", flow: "recovery" }),
  ]);
  assert.equal(confirmation.destination, "/home");
  assert.equal(recovery.destination, "/update-password");
  assert.deepEqual(calls.exchange, ["shared"]);
});

test("missing parameters do not prevent later or different codes from resolving", async () => {
  const { handle, calls } = fixture();
  assert.deepEqual(await handle({ flow: "recovery" }), {
    status: "link-error", kind: "recovery", reason: "missing",
  });
  assert.equal((await handle({ code: "later", flow: "recovery" })).status, "ready");
  assert.equal((await handle({ code: "new" })).status, "ready");
  assert.deepEqual(calls.exchange, ["later", "new"]);
});

test("an explicit server redirect error does not consume the code", async () => {
  const { handle, calls } = fixture();
  assert.deepEqual(await handle({ code: "valid", error: "access_denied" }), {
    status: "link-error", kind: "confirmation", reason: "invalid",
  });
  assert.deepEqual(calls.exchange, []);
  assert.deepEqual(calls.profile, []);
  assert.equal((await handle({ code: "valid" })).status, "ready");
});

test("failed exchanges are cached, including retries and another flow kind", async () => {
  const { handle, calls } = fixture({ exchange: async () => { throw new Error("expired"); } });
  const expected = { status: "link-error", kind: "confirmation", reason: "invalid" };
  const results = await Promise.all([handle({ code: "expired" }), handle({ code: "expired" })]);
  assert.deepEqual(results, [expected, expected]);
  assert.deepEqual(await handle({ code: "expired" }), expected);
  assert.deepEqual(await handle({ code: "expired", flow: "recovery" }), {
    ...expected, kind: "recovery",
  });
  assert.deepEqual(calls.exchange, ["expired"]);
  assert.deepEqual(calls.profile, []);
  assert.equal(calls.signOut, 0);
});

test("profile failures can be retried without exchanging the code again", async () => {
  let attempts = 0;
  const { handle, calls } = fixture({
    readProfile: async () => {
      if (++attempts === 1) throw new Error("offline");
      return { role: "member", status: "active" };
    },
  });
  const failures = await Promise.all([handle({ code: "retry" }), handle({ code: "retry" })]);
  assert.deepEqual(failures, [
    { status: "profile-error", kind: "confirmation" },
    { status: "profile-error", kind: "confirmation" },
  ]);
  assert.equal((await handle({ code: "retry" })).status, "ready");
  assert.deepEqual(calls.exchange, ["retry"]);
  assert.deepEqual(calls.profile, ["user-retry", "user-retry"]);
});

test("suspended accounts stay distinct even if local sign-out fails", async () => {
  for (const fails of [false, true]) {
    const { handle, calls } = fixture({
      readProfile: async () => ({ role: "member", status: "suspended" }),
      signOut: async () => { if (fails) throw new Error("sign-out failed"); },
    });
    const results = await Promise.all([
      handle({ code: "suspended", flow: "recovery" }),
      handle({ code: "suspended", flow: "recovery" }),
    ]);
    assert.deepEqual(results, [
      { status: "suspended", kind: "recovery" },
      { status: "suspended", kind: "recovery" },
    ]);
    assert.equal(calls.signOut, 1);
  }
});
