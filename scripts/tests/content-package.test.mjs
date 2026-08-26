import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  coverAssetsForPlatform,
  readPackage,
  sanitizeShortTitle,
  shortTitleLength,
  WECHAT_SHORT_TITLE_PLATFORM_MAX,
  WECHAT_SHORT_TITLE_TARGET,
  validateDouyinPackage,
  validateWechatChannelsPackage,
  validateXiaohongshuPackage,
} from "../lib/content-package.mjs";
import { defaultConfig, normalizeConfig } from "../lib/config.mjs";
import {
  DOUYIN_DURATION_CONTAINER_TOLERANCE_SECONDS,
  DOUYIN_MAX_DURATION_SECONDS,
  inspectMediaFile,
  readIsoBmffDuration,
  validateMediaForPlatform,
} from "../lib/media.mjs";

async function withTempDir(callback) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "video-publisher-package-test-"));
  try {
    await callback(root);
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
}

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  buffer[0] = 0x89;
  buffer.write("PNG", 1, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function box(type, payload) {
  const buffer = Buffer.alloc(8 + payload.length);
  buffer.writeUInt32BE(buffer.length, 0);
  buffer.write(type, 4, "ascii");
  payload.copy(buffer, 8);
  return buffer;
}

function mp4WithDuration(durationSeconds, timescale = 1000) {
  const payload = Buffer.alloc(20);
  payload[0] = 0;
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(Math.round(durationSeconds * timescale), 16);
  return Buffer.concat([box("ftyp", Buffer.alloc(4)), box("moov", box("mvhd", payload))]);
}

test("Douyin topics come from the package instead of account-specific defaults", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "Generic video",
      douyinTopics: ["Automation", "Tutorial"],
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(pkg.douyinTopics, ["Automation", "Tutorial"]);
    assert.equal(pkg.douyinOriginal, false);
    assert.equal(pkg.douyinAiGenerated, false);
    assert.deepEqual(validateDouyinPackage(pkg), []);
  });
});

test("Douyin declaration intent is explicit and opt-in", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({ title: "Declaration", douyinTopics: ["Test"], douyinOriginal: true, douyinAiGenerated: true }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.equal(pkg.douyinOriginal, true);
    assert.equal(pkg.douyinAiGenerated, true);
  });
});

test("Douyin defaults to immediate publish and validates scheduled timestamps", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({ title: "Douyin defaults", douyinTopics: ["Test"] }));
    let pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(pkg.douyinPublish, { mode: "immediate", publishAt: "" });
    assert.deepEqual(validateDouyinPackage(pkg), []);
    await fs.promises.writeFile(packagePath, JSON.stringify({ title: "Douyin schedule", douyinTopics: ["Test"], douyinPublish: { mode: "scheduled", publishAt: "2026/08/27 13:00" } }));
    pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.match(validateDouyinPackage(pkg).join("; "), /YYYY-MM-DD HH:mm/);
  });
});

test("an existing cover asset needs only its file path and ratio", async () => {
  await withTempDir(async root => {
    const coverPath = path.join(root, "cover-3x4.png");
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(coverPath, pngHeader(1080, 1440));
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "Generic video",
      xhsTopics: ["Automation"],
      cover: {
        uploadCustomCover: true,
        vertical3x4Path: coverPath,
      },
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(validateXiaohongshuPackage(pkg), []);
    assert.deepEqual(coverAssetsForPlatform(pkg, "xiaohongshu"), [
      { slot: "portrait", ratio: "3:4", path: coverPath },
    ]);
  });
});

test("Xiaohongshu originality is opt-in and defaults to false", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "XHS original policy",
      xhsTopics: ["Test"],
    }));
    let pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.equal(pkg.xhsOriginal, false);
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "XHS original policy",
      xhsTopics: ["Test"],
      xhsOriginal: true,
    }));
    pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.equal(pkg.xhsOriginal, true);
    assert.deepEqual(validateXiaohongshuPackage(pkg), []);
  });
});

test("Xiaohongshu applies description, AI, and immediate publish defaults", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "XHS defaults",
      xhsDescription: "A concise Xiaohongshu description",
      xhsTopics: ["One", "Two", "Three"],
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.equal(pkg.xhsDescription, "A concise Xiaohongshu description");
    assert.equal(pkg.xhsAiGenerated, false);
    assert.equal(pkg.xhsOriginal, false);
    assert.deepEqual(pkg.xhsPublish, { mode: "immediate", publishAt: "" });
    assert.deepEqual(validateXiaohongshuPackage(pkg), []);
  });
});

test("Xiaohongshu validates scheduled publish timestamps and topic count", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "XHS scheduled",
      xhsDescription: "Scheduled description",
      xhsTopics: ["One", "Two", "Three", "Four", "Five", "Six"],
      xhsAiGenerated: true,
      xhsPublish: { mode: "scheduled", publishAt: "2026/08/27 13:00" },
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    const errors = validateXiaohongshuPackage(pkg);
    assert.match(errors.join("; "), /at most 5 topics/);
    assert.match(errors.join("; "), /YYYY-MM-DD HH:mm/);
  });
});

test("account defaults fill only fields omitted from the package", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({ title: "Generic video" }));
    const config = normalizeConfig({
      platforms: {
        douyin: { defaultTopics: ["Default topic"] },
      },
    });
    const pkg = readPackage(packagePath, { config });
    assert.deepEqual(pkg.douyinTopics, ["Default topic"]);
  });
});

test("WeChat per-video controls are explicit and scheduled time uses a stable format", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "AI workflow",
      wechatDescription: "AI workflow\n\n#AI",
      wechatShortTitle: "AI workflow",
      wechatTags: ["AI"],
      wechatPublish: { mode: "scheduled", publishAt: "2026-08-27 13:00" },
      wechatLink: { type: "product", query: "SKU-123", expectedName: "Example product" },
      wechatAiGenerated: true,
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(validateWechatChannelsPackage(pkg), []);
    assert.equal(pkg.wechatAiGenerated, true);
    assert.deepEqual(pkg.wechatPublish, { mode: "scheduled", publishAt: "2026-08-27 13:00" });
    assert.deepEqual(pkg.wechatLink, { type: "product", selection: "search", query: "SKU-123", expectedName: "Example product" });
  });
});

test("WeChat applies fixed defaults when the user does not request overrides", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "Unspecified workflow",
      wechatDescription: "Unspecified workflow",
      wechatTags: ["Workflow"],
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(validateWechatChannelsPackage(pkg), []);
    assert.equal(pkg.wechatShortTitle, "Unspecifie");
    assert.equal(shortTitleLength(pkg.wechatShortTitle), WECHAT_SHORT_TITLE_TARGET);
    assert.deepEqual(pkg.wechatPublish, { mode: "immediate", publishAt: "" });
    assert.deepEqual(pkg.wechatLink, { type: "none", selection: "none", query: "", expectedName: "" });
    assert.equal(pkg.wechatAiGenerated, false);
    assert.equal(pkg.wechatOriginal, false);
  });
});

test("WeChat supports selecting the first available product without a search query", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "Product workflow",
      wechatDescription: "Product workflow",
      wechatTags: ["Product"],
      wechatLink: { type: "product", selection: "first" },
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.deepEqual(validateWechatChannelsPackage(pkg), []);
    assert.deepEqual(pkg.wechatLink, { type: "product", selection: "first", query: "", expectedName: "" });
  });
});

test("WeChat originality is opt-in and defaults to false", async () => {
  await withTempDir(async root => {
    const packagePath = path.join(root, "package.json");
    await fs.promises.writeFile(packagePath, JSON.stringify({
      title: "Original workflow",
      wechatDescription: "Original workflow",
      wechatTags: ["Original"],
      wechatOriginal: true,
    }));
    const pkg = readPackage(packagePath, { config: defaultConfig() });
    assert.equal(pkg.wechatOriginal, true);
    assert.deepEqual(validateWechatChannelsPackage(pkg), []);
  });
});

test("WeChat short titles remove punctuation, symbols, emoji, and hashtags", () => {
  assert.equal(sanitizeShortTitle("老板真正缺的，从来不是下属！#管理🚀"), "老板真正缺的从来不是");
  assert.equal(sanitizeShortTitle("AI + Management 2026"), "AI Managem");
  assert.equal(shortTitleLength(sanitizeShortTitle("老板真正缺的，从来不是下属！#管理🚀")), WECHAT_SHORT_TITLE_TARGET);
  assert.ok(WECHAT_SHORT_TITLE_TARGET < WECHAT_SHORT_TITLE_PLATFORM_MAX);
});

test("ISO BMFF duration parser reads mvhd without ffprobe", async () => {
  await withTempDir(async root => {
    const videoPath = path.join(root, "long.mp4");
    await fs.promises.writeFile(videoPath, mp4WithDuration(909.162));
    assert.equal(readIsoBmffDuration(videoPath), 909.162);
    const media = inspectMediaFile(videoPath);
    assert.equal(media.durationSource, "iso-bmff-mvhd");
    assert.equal(media.durationSeconds, 909.162);
  });
});

test("Douyin preflight accepts 15:00 container rounding and rejects longer media only for Douyin", async () => {
  await withTempDir(async root => {
    const acceptedPath = path.join(root, "accepted.mp4");
    const rejectedPath = path.join(root, "rejected.mp4");
    await fs.promises.writeFile(acceptedPath, mp4WithDuration(DOUYIN_MAX_DURATION_SECONDS + DOUYIN_DURATION_CONTAINER_TOLERANCE_SECONDS / 2));
    await fs.promises.writeFile(rejectedPath, mp4WithDuration(DOUYIN_MAX_DURATION_SECONDS + DOUYIN_DURATION_CONTAINER_TOLERANCE_SECONDS + 0.001));
    assert.deepEqual(validateMediaForPlatform({ videoPath: acceptedPath }, "douyin"), []);
    assert.match(validateMediaForPlatform({ videoPath: rejectedPath }, "douyin")[0], /DOUYIN_DURATION_LIMIT/);
    assert.deepEqual(validateMediaForPlatform({ videoPath: rejectedPath }, "xiaohongshu"), []);
  });
});
