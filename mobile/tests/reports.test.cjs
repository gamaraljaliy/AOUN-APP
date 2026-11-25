const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { runInThisContext } = require("node:vm");
const { createClient } = require("@supabase/supabase-js");
const ts = require("typescript");

function compile(path) {
  const filename = resolve(__dirname, path);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return runInThisContext("(function (exports, require) {\n" + outputText + "\n})", { filename });
}

const loadReports = compile("../services/reports.ts");
const { createReportSubmissions } = (() => {
  const moduleExports = {};
  compile("../ui/reportSubmission.ts")(moduleExports, () => assert.fail("unexpected dependency"));
  return moduleExports;
})();

const memberA = { user: { id: "member-a" }, access_token: "mock-a" };
const memberB = { user: { id: "member-b" }, access_token: "mock-b" };
const activeA = { userId: memberA.user.id, activeMember: true };
const draft = { issue: "incorrect", description: "  Verify the accessible entrance.  " };
const place = { id: 7, name_ar: "اسم المكان", name_en: "Place name" };
const signal = new AbortController().signal;

function fixture(t, ...replies) {
  const calls = [];
  const client = createClient("https://example.invalid", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      async fetch(url, options) {
        calls.push({ url: new URL(url), ...options });
        assert.ok(replies.length, "unexpected request");
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        const [status, body] = reply;
        return new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  const service = {};
  loadReports(service, (name) => {
    assert.equal(name, "./supabase");
    return { db: () => client };
  });
  t.after(() => assert.equal(replies.length, 0));
  return { ...service, calls };
}

test("maps the three report issue labels to the existing database values", (t) => {
  const { reportIssues, isReportIssue } = fixture(t);
  assert.deepEqual(reportIssues, [
    { value: "incorrect", label: "معلومة خاطئة" },
    { value: "missing", label: "معلومة ناقصة" },
    { value: "outdated", label: "معلومة قديمة" },
  ]);
  assert.ok(reportIssues.every(({ value }) => isReportIssue(value)));
  assert.equal(isReportIssue("toString"), false);
});

test("rejects invalid input and missing sessions without issuing a request", async (t) => {
  const { submitReport, calls } = fixture(t);
  assert.equal(await submitReport(memberA, 7, "", draft.description, signal), "rejected");
  assert.equal(await submitReport(memberA, 7, draft.issue, " \n ", signal), "rejected");
  for (const id of [0, -1, NaN, 3.5, 2147483648]) {
    assert.equal(await submitReport(memberA, id, draft.issue, draft.description, signal), "rejected");
  }
  assert.equal(await submitReport(null, 7, draft.issue, draft.description, signal), "rejected");
  assert.equal(calls.length, 0);
});

test("live routing resolves the real ID and rejects missing or invalid IDs", async (t) => {
  const { getReportPlace, calls } = fixture(t, [200, [place]], [200, []]);
  assert.deepEqual(await getReportPlace(7, undefined, signal), place);
  assert.equal(await getReportPlace(8, undefined, signal), null);
  assert.equal(await getReportPlace(0, undefined, signal), null);
  assert.equal(calls[0].url.pathname, "/rest/v1/places");
  assert.equal(calls[0].url.searchParams.get("id"), "eq.7");
});

test("a unique exact legacy name can resolve to a different real ID", async (t) => {
  const { getReportPlace, calls } = fixture(t, [200, [place]], [200, [place]]);
  assert.deepEqual(await getReportPlace(1, place.name_ar, signal), place);
  assert.equal(calls[0].url.searchParams.get("name_ar"), "eq." + place.name_ar);
  assert.equal(calls[1].url.searchParams.get("name_en"), "eq." + place.name_ar);
  assert.ok(calls.every(({ url }) => url.searchParams.get("id") === null));
});

test("rejects unmatched, unnamed, and ambiguous legacy targets", async (t) => {
  const { getReportPlace, calls } = fixture(t, [200, []], [200, []],
    [200, [place]], [200, [{ ...place, id: 8 }]]);
  assert.equal(await getReportPlace(2, "No matching place", signal), null);
  assert.equal(await getReportPlace(2, "", signal), null);
  assert.equal(await getReportPlace(2, "Ambiguous name", signal), null);
  assert.equal(calls.length, 4);
});

test("submits using the member token and leaves owner and status to database defaults", async (t) => {
  const { submitReport, calls } = fixture(t, [201, { id: 31, status: "submitted" }],
    [201, { id: 32, status: "submitted" }]);
  assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "submitted");
  assert.equal(await submitReport(memberB, 7, "missing", "Missing information", signal), "submitted");
  assert.equal(calls[0].url.pathname, "/rest/v1/reports");
  assert.equal(calls[0].url.searchParams.get("select"), "id,status");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("Authorization"), "Bearer mock-a");
  assert.equal(calls[1].headers.get("Authorization"), "Bearer mock-b");
  assert.deepEqual(JSON.parse(calls[0].body), {
    place_id: 7, issue_type: "incorrect", description: draft.description.trim(),
  });
});

test("does not show success without a returned submitted report", async (t) => {
  const { submitReport } = fixture(t, [201, { status: "submitted" }],
    [201, { id: 31, status: "under_review" }]);
  assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "uncertain");
  assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "uncertain");
});

test("recognizes explicit permission, session, and foreign-key failures as rejected", async (t) => {
  const { submitReport } = fixture(t, [403, { code: "42501" }],
    [401, { code: "PGRST301" }], [409, { code: "23503" }]);
  for (let count = 0; count < 3; count++) {
    assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "rejected");
  }
});

test("does not retry a network failure or uncertain server response", async (t) => {
  const { submitReport, calls } = fixture(t, new TypeError("network error"),
    [503, { code: "PGRST000" }]);
  assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "uncertain");
  assert.equal(await submitReport(memberA, 7, draft.issue, draft.description, signal), "uncertain");
  assert.equal(calls.length, 2);
});

const baseline = async () => 30;
const unexpected = () => assert.fail("should not request");

function activeStore() {
  const store = createReportSubmissions();
  store.setOwner(memberA.user.id);
  return store;
}

function deferred() {
  let resolve;
  const promise = new Promise((finish) => { resolve = finish; });
  return { promise, resolve };
}

test("reopening during submission attaches to the same attempt and receives confirmation", async () => {
  const store = activeStore();
  const original = store.forPlace(activeA.userId, place.id);
  const started = deferred();
  const response = deferred();
  const originalStates = [];
  const detach = original.subscribe(() => originalStates.push(original.getSnapshot()));
  const pending = original.submit(activeA, draft, baseline, () => {
    started.resolve();
    return response.promise;
  });
  await started.promise;
  detach();

  const reopened = store.forPlace(activeA.userId, place.id);
  assert.equal(reopened.getSnapshot(), "submitting");
  await reopened.submit(activeA, draft, unexpected, unexpected);
  const reopenedStates = [];
  const detachReopened = reopened.subscribe(() => reopenedStates.push(reopened.getSnapshot()));
  response.resolve("submitted");
  await pending;
  detachReopened();

  assert.deepEqual(originalStates, ["submitting"]);
  assert.deepEqual(reopenedStates, ["submitted"]);
  assert.equal(store.forPlace(activeA.userId, place.id).getSnapshot(), "submitted");
  await reopened.submit(activeA, draft, unexpected, unexpected);
  reopened.startNew();
  assert.equal(reopened.getSnapshot(), "editing");
});

test("an ambiguous write remains unresolved after reopening and cannot be resent", async () => {
  const store = activeStore();
  await store.forPlace(activeA.userId, place.id).submit(
    activeA, draft, baseline, async () => "uncertain",
  );
  const reopened = store.forPlace(activeA.userId, place.id);
  assert.equal(reopened.getSnapshot(), "uncertain");
  await reopened.submit(activeA, draft, unexpected, unexpected);
  reopened.startNew();
  assert.equal(reopened.getSnapshot(), "uncertain");

  await reopened.reconcile(activeA.userId, async ({ draft: original, previousId }) => {
    assert.equal(original.description, draft.description.trim());
    assert.equal(previousId, 30);
    return false;
  });
  assert.equal(reopened.getSnapshot(), "uncertain");
  await reopened.reconcile(activeA.userId, async () => { throw new Error("offline"); });
  assert.equal(reopened.getSnapshot(), "uncertain");
  await reopened.reconcile(activeA.userId, async () => true);
  assert.equal(reopened.getSnapshot(), "submitted");
});

test("rapid taps are blocked even while the baseline read is pending", async () => {
  const entry = activeStore().forPlace(activeA.userId, place.id);
  const starting = deferred();
  const first = entry.submit(activeA, draft, () => starting.promise, async () => "submitted");
  await entry.submit(activeA, draft, unexpected, unexpected);
  assert.equal(entry.getSnapshot(), "submitting");
  starting.resolve(30);
  await first;
  assert.equal(entry.getSnapshot(), "submitted");
});

test("confirmed failure or failed preflight permits an explicit retry", async () => {
  const entry = activeStore().forPlace(activeA.userId, place.id);
  await entry.submit(activeA, draft, async () => { throw new Error("offline"); }, unexpected);
  assert.equal(entry.getSnapshot(), "rejected");
  await entry.submit(activeA, draft, baseline, async () => "rejected");
  assert.equal(entry.getSnapshot(), "rejected");
  await entry.submit(activeA, draft, baseline, async () => "submitted");
  assert.equal(entry.getSnapshot(), "submitted");
});

test("inactive and mismatched accounts cannot write or reconcile an attempt", async () => {
  const entry = activeStore().forPlace(activeA.userId, place.id);
  await entry.submit({ ...activeA, activeMember: false }, draft, unexpected, unexpected);
  await entry.submit({ ...activeA, userId: memberB.user.id }, draft, unexpected, unexpected);
  assert.equal(entry.getSnapshot(), "editing");
  await entry.submit(activeA, draft, baseline, async () => "uncertain");
  await entry.reconcile(memberB.user.id, unexpected);
  assert.equal(entry.getSnapshot(), "uncertain");
});

test("same-account refresh keeps a valid submission pending until the response", async () => {
  const store = activeStore();
  const entry = store.forPlace(activeA.userId, place.id);
  const started = deferred();
  const response = deferred();
  const pending = entry.submit(activeA, draft, baseline, () => {
    started.resolve();
    return response.promise;
  });
  await started.promise;
  store.setOwner(activeA.userId);
  assert.equal(entry.getSnapshot(), "submitting");
  response.resolve("submitted");
  await pending;
  assert.equal(entry.getSnapshot(), "submitted");
});

test("logout and account switch isolate attempts and ignore the old response", async () => {
  const store = activeStore();
  const oldEntry = store.forPlace(activeA.userId, place.id);
  const started = deferred();
  const response = deferred();
  const pending = oldEntry.submit(activeA, draft, baseline, () => {
    started.resolve();
    return response.promise;
  });
  await started.promise;

  store.setOwner(undefined);
  assert.equal(oldEntry.getSnapshot(), "uncertain");
  await oldEntry.reconcile(activeA.userId, unexpected);
  store.setOwner(memberB.user.id);
  const otherEntry = store.forPlace(memberB.user.id, place.id);
  assert.equal(otherEntry.getSnapshot(), "editing");
  await oldEntry.submit(activeA, draft, unexpected, unexpected);
  await otherEntry.submit({ userId: memberB.user.id, activeMember: true },
    { issue: "outdated", description: "A separate member's report" },
    baseline, async () => "rejected");
  response.resolve("submitted");
  await pending;

  assert.equal(otherEntry.getSnapshot(), "rejected");
  store.setOwner(activeA.userId);
  assert.equal(store.forPlace(activeA.userId, place.id).getSnapshot(), "uncertain");
  assert.equal(store.forPlace(activeA.userId, place.id + 1).getSnapshot(), "editing");
});

test("logging out during the baseline lookup prevents an insert from starting", async () => {
  const store = activeStore();
  const entry = store.forPlace(activeA.userId, place.id);
  const preflight = deferred();
  const pending = entry.submit(activeA, draft, () => preflight.promise, unexpected);
  store.setOwner(undefined);
  preflight.resolve(0);
  await pending;
  assert.equal(entry.getSnapshot(), "rejected");
});

test("reconciliation queries only the member's later rows for the same place and issue", async (t) => {
  const match = { id: 31, description: draft.description.trim() };
  const { latestReportId, findSubmittedReport, calls } = fixture(t,
    [200, [{ id: 30 }]], [200, [match]], [200, []],
    [200, [match, { ...match, id: 32 }]],
  );
  const previous = await latestReportId(memberA, place.id);
  assert.equal(previous, 30);
  assert.equal(await findSubmittedReport(memberA, place.id, previous,
    { ...draft, description: draft.description.trim() }), true);
  assert.equal(await findSubmittedReport(memberA, place.id, previous,
    { ...draft, description: draft.description.trim() }), false);
  assert.equal(await findSubmittedReport(memberA, place.id, previous,
    { ...draft, description: draft.description.trim() }), false);
  for (const { url, headers, method } of calls) {
    assert.equal(url.pathname, "/rest/v1/reports");
    assert.equal(url.searchParams.get("user_id"), "eq.member-a");
    assert.equal(url.searchParams.get("place_id"), "eq.7");
    assert.equal(headers.get("Authorization"), "Bearer mock-a");
    assert.equal(method, "GET");
  }
  assert.equal(calls[1].url.searchParams.get("id"), "gt.30");
  assert.equal(calls[1].url.searchParams.get("issue_type"), "eq.incorrect");
});
