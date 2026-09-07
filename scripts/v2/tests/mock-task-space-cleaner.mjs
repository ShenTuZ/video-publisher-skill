#!/usr/bin/env node
import fs from "node:fs";

const [taskSpaceId, taskSpaceName = ""] = process.argv.slice(2);
if (process.env.VIDEO_PUBLISHER_V2_MOCK_CLEANER_LOG) {
  fs.appendFileSync(process.env.VIDEO_PUBLISHER_V2_MOCK_CLEANER_LOG, JSON.stringify({ taskSpaceId: Number(taskSpaceId), taskSpaceName }) + "\n");
}
if (process.env.VIDEO_PUBLISHER_V2_MOCK_CLEANER_FAIL === "1") process.exit(1);
