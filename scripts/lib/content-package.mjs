import fs from "node:fs";
import { loadConfig } from "./config.mjs";

export function stripHash(tag) {
  return String(tag || "").trim().replace(/^#+\s*/, "").trim();
}

export function uniqueCleanTags(tags = []) {
  const seen = new Set();
  const result = [];
  for (const raw of tags) {
    const tag = stripHash(raw);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

export function hasLiteralEscapedNewline(value) {
  return String(value || "").includes("\\n");
}

export function normalizeDescription(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export const WECHAT_SHORT_TITLE_PLATFORM_MAX = 16;
export const WECHAT_SHORT_TITLE_TARGET = 10;

export function shortTitleLength(value) {
  return Array.from(String(value || "")).length;
}

export function sanitizeShortTitle(value, { maxLength = WECHAT_SHORT_TITLE_TARGET } = {}) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, maxLength).join("").trim();
}

export function getImageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 24
    && buffer[0] === 0x89
    && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      format: "png",
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (size < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
          format: "jpeg",
        };
      }
      offset += 2 + size;
    }
  }
  return { width: 0, height: 0, format: "unknown" };
}

export function ratioOk(dimensions, expected) {
  if (!dimensions.width || !dimensions.height) return false;
  const actual = dimensions.width / dimensions.height;
  const target = expected === "3:4" ? 3 / 4 : 4 / 3;
  return Math.abs(actual - target) < 0.01;
}

export function coverUploadEnabled(cover = {}) {
  return cover.uploadCustomCover === true;
}

export function coverAssetsForPlatform(pkg, platform) {
  const cover = pkg.cover || {};
  const verticalPath = String(cover.vertical3x4Path || "").trim();
  const horizontalPath = String(cover.horizontal4x3Path || "").trim();
  const mapping = {
    xiaohongshu: verticalPath ? [{ slot: "portrait", ratio: "3:4", path: verticalPath }] : [],
    wechat_channels: [
      ...(verticalPath ? [{ slot: "portrait", ratio: "3:4", path: verticalPath }] : []),
      ...(horizontalPath ? [{ slot: "landscape", ratio: "4:3", path: horizontalPath }] : []),
    ],
    douyin: [
      ...(verticalPath ? [{ slot: "portrait", ratio: "3:4", path: verticalPath }] : []),
      ...(horizontalPath ? [{ slot: "landscape", ratio: "4:3", path: horizontalPath }] : []),
    ],
  };
  return mapping[platform] || [];
}

export function readPackage(packagePath, { config: suppliedConfig } = {}) {
  if (!packagePath) {
    throw new Error("Missing package JSON path");
  }
  const parsed = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const config = suppliedConfig || loadConfig();
  const title = String(parsed.title || "").trim();
  const platformTitle = {
    xiaohongshu: String(parsed.xhsTitle || parsed.xiaohongshuTitle || title).trim(),
    douyin: String(parsed.douyinTitle || title).trim(),
    wechat_channels: String(parsed.wechatTitle || parsed.wechatChannelsTitle || title).trim(),
  };
  const description = normalizeDescription(parsed.description || "");
  const douyinDescription = normalizeDescription(parsed.douyinDescription || parsed.description || "");
  const wechatDescription = normalizeDescription(parsed.wechatDescription || parsed.description || "");
  const wechatShortTitle = sanitizeShortTitle(parsed.wechatShortTitle || platformTitle.wechat_channels || title);
  const rawWechatPublish = parsed.wechatPublish && typeof parsed.wechatPublish === "object"
    ? parsed.wechatPublish
    : {};
  const wechatPublish = {
    mode: String(rawWechatPublish.mode || "immediate").trim(),
    publishAt: String(rawWechatPublish.publishAt || "").trim(),
  };
  const rawWechatLink = parsed.wechatLink && typeof parsed.wechatLink === "object"
    ? parsed.wechatLink
    : {};
  const wechatLink = {
    type: String(rawWechatLink.type || "none").trim(),
    selection: String(rawWechatLink.selection || (rawWechatLink.query ? "search" : "none")).trim(),
    query: String(rawWechatLink.query || "").trim(),
    expectedName: String(rawWechatLink.expectedName || "").trim(),
  };
  const wechatAiGenerated = typeof parsed.wechatAiGenerated === "boolean"
    ? parsed.wechatAiGenerated
    : false;
  const xhsOriginal = parsed.xhsOriginal === true;
  const wechatOriginal = parsed.wechatOriginal === true;
  const wechatPolicies = {
    location: String(parsed.wechatPolicies?.location || config.platforms.wechat_channels.locationPolicy).trim(),
    collection: String(parsed.wechatPolicies?.collection || config.platforms.wechat_channels.collectionPolicy).trim(),
    activity: String(parsed.wechatPolicies?.activity || config.platforms.wechat_channels.activityPolicy).trim(),
  };
  const cover = {
    uploadCustomCover: parsed.cover?.uploadCustomCover === true,
    vertical3x4Path: String(parsed.cover?.vertical3x4Path || "").trim(),
    horizontal4x3Path: String(parsed.cover?.horizontal4x3Path || "").trim(),
  };
  const douyinTopicSource = Array.isArray(parsed.douyinTopics)
    ? parsed.douyinTopics
    : Array.isArray(parsed.topics)
      ? parsed.topics
      : Array.isArray(parsed.tags)
        ? parsed.tags
        : config.platforms.douyin.defaultTopics;
  const douyinTopics = uniqueCleanTags(douyinTopicSource);
  const xhsTopics = uniqueCleanTags(parsed.xhsTopics || parsed.topics || parsed.tags || []);
  const wechatTags = uniqueCleanTags(parsed.wechatTags || parsed.topics || parsed.tags || []);
  return {
    ...parsed,
    title,
    platformTitle,
    description,
    douyinDescription,
    wechatDescription,
    wechatShortTitle,
    wechatPublish,
    wechatLink,
    wechatAiGenerated,
    xhsOriginal,
    wechatOriginal,
    wechatPolicies,
    cover,
    douyinTopics,
    xhsTopics,
    wechatTags
  };
}

export function validateCommonPackage(pkg) {
  const errors = [];
  if (!pkg.title) errors.push("title is required");
  if (hasLiteralEscapedNewline(pkg.title)) errors.push("title contains literal escaped newline");
  for (const key of ["description", "douyinDescription", "wechatDescription"]) {
    if (hasLiteralEscapedNewline(pkg[key])) errors.push(`${key} contains literal escaped newline; use real newlines`);
  }
  return errors;
}

export function validateCoverPackage(pkg, platform) {
  const errors = [];
  const cover = pkg.cover || {};
  if (!coverUploadEnabled(cover)) return errors;
  const assets = coverAssetsForPlatform(pkg, platform);
  if (!assets.length) {
    errors.push(`custom cover upload enabled, but no cover asset is mapped for ${platform}`);
    return errors;
  }
  if (platform === "douyin" && assets.length !== 2) {
    errors.push("douyin custom cover upload requires both 3:4 portrait and 4:3 landscape covers");
  }
  if (platform === "wechat_channels" && assets.length !== 2) {
    errors.push("wechat_channels custom cover upload requires both 3:4 personal-profile and 4:3 share-card covers");
  }
  for (const asset of assets) {
    if (!asset.path || !fs.existsSync(asset.path)) {
      errors.push(`custom cover file not found for ${platform} ${asset.slot}: ${asset.path || "(missing path)"}`);
      continue;
    }
    const dimensions = getImageDimensions(asset.path);
    if (!ratioOk(dimensions, asset.ratio)) {
      errors.push(`custom cover ratio mismatch for ${platform} ${asset.slot}: expected ${asset.ratio}, got ${dimensions.width}x${dimensions.height || 0}`);
    }
  }
  return errors;
}

export function validateDouyinPackage(pkg) {
  const errors = validateCommonPackage(pkg);
  errors.push(...validateCoverPackage(pkg, "douyin"));
  const douyinTitle = String(pkg.platformTitle?.douyin || pkg.title || "");
  if (douyinTitle.length > 30) errors.push(`douyin title is ${douyinTitle.length}/30`);
  if ((pkg.douyinDescription.match(/#[^\s#]+/g) || []).length) {
    errors.push("douyinDescription must not contain inline hashtags; use douyinTopics");
  }
  if (!pkg.douyinTopics.length) errors.push("douyinTopics are required");
  if (pkg.douyinTopics.length > 5) errors.push("douyin supports at most 5 topics");
  return errors;
}

export function validateXiaohongshuPackage(pkg) {
  const errors = validateCommonPackage(pkg);
  errors.push(...validateCoverPackage(pkg, "xiaohongshu"));
  const xhsTitle = String(pkg.platformTitle?.xiaohongshu || pkg.xhsTitle || pkg.xiaohongshuTitle || pkg.title || "").trim();
  if (xhsTitle.length > 20) errors.push(`xiaohongshu title is ${xhsTitle.length}/20`);
  if (!pkg.xhsTopics.length) errors.push("xhsTopics are required");
  return errors;
}

export function validateWechatChannelsPackage(pkg) {
  const errors = validateCommonPackage(pkg);
  errors.push(...validateCoverPackage(pkg, "wechat_channels"));
  if (!pkg.wechatDescription) errors.push("wechatDescription is required");
  if (!pkg.wechatTags.length) errors.push("wechatTags are required");
  if (!pkg.wechatShortTitle) errors.push("wechatShortTitle is empty after removing special characters");
  if (shortTitleLength(pkg.wechatShortTitle) > WECHAT_SHORT_TITLE_PLATFORM_MAX) {
    errors.push(`wechatShortTitle exceeds the platform limit of ${WECHAT_SHORT_TITLE_PLATFORM_MAX} characters`);
  }
  if (shortTitleLength(pkg.wechatShortTitle) > WECHAT_SHORT_TITLE_TARGET) {
    errors.push(`wechatShortTitle exceeds the configured target of ${WECHAT_SHORT_TITLE_TARGET} characters`);
  }
  if (!["immediate", "scheduled"].includes(pkg.wechatPublish?.mode)) {
    errors.push("wechatPublish.mode must be immediate or scheduled");
  }
  if (pkg.wechatPublish?.mode === "scheduled" && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(pkg.wechatPublish.publishAt || "")) {
    errors.push("wechatPublish.publishAt must use YYYY-MM-DD HH:mm when scheduled");
  }
  if (!["none", "product"].includes(pkg.wechatLink?.type)) {
    errors.push("wechatLink.type must be none or product");
  }
  if (pkg.wechatLink?.type === "none" && pkg.wechatLink.selection !== "none") {
    errors.push("wechatLink.selection must be none when link type is none");
  }
  if (pkg.wechatLink?.type === "product" && !["search", "first"].includes(pkg.wechatLink.selection)) {
    errors.push("wechatLink.selection must be search or first for a product link");
  }
  if (pkg.wechatLink?.type === "product" && pkg.wechatLink.selection === "search" && !pkg.wechatLink.query) {
    errors.push("wechatLink.query is required when product selection is search");
  }
  if (pkg.wechatPolicies?.location !== "preserve") errors.push("wechatPolicies.location must be preserve");
  if (pkg.wechatPolicies?.collection !== "leave_unselected") errors.push("wechatPolicies.collection must be leave_unselected");
  if (pkg.wechatPolicies?.activity !== "none") errors.push("wechatPolicies.activity must be none");
  return errors;
}

export function assertPackage(errors) {
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
}
