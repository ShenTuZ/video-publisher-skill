import test from "node:test";
import assert from "node:assert/strict";
import { BLOCKER, classifyVerdict, evaluateObservation, requiredGates } from "../lib/model.mjs";

function observation(platform, overrides = {}) {
  const gates = Object.fromEntries(requiredGates(platform).map(name => [name, {
    ok: true,
    evidence: name === "safety" ? { finalPublishClicked: false, guardArmed: true, blockedAttempts: 0 } : {},
  }]));
  return { platform, phase: "verify", taskSpaceId: 1, gates: { ...gates, ...(overrides.gates || {}) }, blocker: overrides.blocker || null };
}

test("READY is computed only when every required gate is verified", () => {
  const verdict = evaluateObservation(observation("xiaohongshu"));
  assert.equal(verdict.ready, true);
  assert.deepEqual(verdict.missing, []);
});

test("an action cannot claim READY when cover evidence is missing", () => {
  const verdict = evaluateObservation(observation("xiaohongshu", { gates: { cover: { ok: false, evidence: { receipt: null } } } }));
  assert.equal(verdict.ready, false);
  assert.deepEqual(verdict.missing, ["cover"]);
  assert.equal(verdict.blocker.code, BLOCKER.STATE_AMBIGUOUS);
  assert.equal(classifyVerdict(verdict), "needs_mutation");
});

test("foreign drafts remain blocked without entering an upload flow", () => {
  const verdict = evaluateObservation(observation("wechat_channels", { gates: { draftIdentity: { ok: false, evidence: { foreign: true } } } }));
  assert.equal(verdict.blocker.code, BLOCKER.FOREIGN_DRAFT);
  assert.equal(classifyVerdict(verdict), "blocked_foreign_draft");
});

test("typed risk-control blocker wins over otherwise missing gates", () => {
  const verdict = evaluateObservation(observation("wechat_channels", {
    gates: { video: { ok: false, evidence: { initToast: true } } },
    blocker: { code: BLOCKER.RISK_CONTROL, message: "SDK unavailable", retryable: true },
  }));
  assert.equal(verdict.ready, false);
  assert.equal(verdict.blocker.code, BLOCKER.RISK_CONTROL);
});

test("a broken Ego input channel blocks instead of scheduling a video upload", () => {
  const verdict = evaluateObservation(observation("douyin", {
    gates: { video: { ok: false, evidence: { reason: "ego runner unavailable" } } },
    blocker: { code: BLOCKER.INPUT_CHANNEL_BROKEN, message: "Ego Lite exited", retryable: true },
  }));
  assert.equal(verdict.ready, false);
  assert.equal(verdict.blocker.code, BLOCKER.INPUT_CHANNEL_BROKEN);
  assert.equal(classifyVerdict(verdict), "blocked");
});

test("READY rejects a self-reported safety gate without an armed page guard", () => {
  const verdict = evaluateObservation(observation("xiaohongshu", {
    gates: { safety: { ok: true, evidence: { finalPublishClicked: false, guardArmed: false, blockedAttempts: 0 } } },
  }));
  assert.equal(verdict.ready, false);
  assert.deepEqual(verdict.missing, ["safety"]);
});

test("READY rejects any attempted final-publish interaction even when it was blocked", () => {
  const verdict = evaluateObservation(observation("xiaohongshu", {
    gates: { safety: { ok: true, evidence: { finalPublishClicked: false, guardArmed: true, blockedAttempts: 1 } } },
  }));
  assert.equal(verdict.ready, false);
  assert.deepEqual(verdict.missing, ["safety"]);
});

test("fast profile ignores untouched default-item gates but keeps the timing gate", () => {
  const input = observation("douyin", {
    gates: Object.fromEntries(["settings", "defaults", "visibility", "download", "cover"]
      .map(name => [name, { ok: false, evidence: {} }])),
  });
  input.publishProfile = "fast";
  assert.equal(evaluateObservation(input).ready, true);
});

test("fast profile blocks publication when any platform timing differs from its package", () => {
  for (const platform of ["xiaohongshu", "douyin", "wechat_channels"]) {
    const input = observation(platform, { gates: { schedule: { ok: false, evidence: { expected: { mode: "scheduled", publishAt: "2026-08-27 20:00" }, actual: { mode: "immediate" } } } } });
    input.publishProfile = "fast";
    const verdict = evaluateObservation(input);
    assert.equal(verdict.ready, false, platform);
    assert.deepEqual(verdict.missing, ["schedule"], platform);
  }
});
