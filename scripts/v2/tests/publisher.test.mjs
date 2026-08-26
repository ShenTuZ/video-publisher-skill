import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const V2_DIR = path.dirname(DIR);

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout="",stderr="";
    child.stdout.on("data",chunk=>{stdout+=chunk}); child.stderr.on("data",chunk=>{stderr+=chunk});
    child.on("error",reject); child.on("close",code=>resolve({code,stdout,stderr}));
  });
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
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(Math.round(durationSeconds * timescale), 16);
  return Buffer.concat([box("ftyp", Buffer.alloc(4)), box("moov", box("mvhd", payload))]);
}

test("publisher waits for every upload process before serial UI mutation", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-test-"));
  const log=path.join(root,"events.ndjson");
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({
    schemaVersion:1,
    onboarding:{completed:true},
    sourceDirectory:root,
    defaultPlatforms:["xiaohongshu","douyin","wechat_channels"]
  }));
  await fs.promises.writeFile(packagePath,JSON.stringify({
    videoPath,
    title:"Automation test",
    douyinTopics:["Automation","Tutorial"],
    xhsTopics:["Automation","Tutorial"],
    wechatDescription:"Automation test\n\n#Automation #Tutorial",
    wechatShortTitle:"Automation test",
    wechatTags:["Automation","Tutorial"],
    wechatPublish:{mode:"immediate"},
    wechatLink:{type:"none"},
    wechatAiGenerated:false,
    cover:{uploadCustomCover:false}
  }));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"test","--confirm-original-rights","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  const lastInjectEnd=Math.max(...events.filter(item=>item.phase==="inject"&&item.event==="end").map(item=>item.at));
  const firstPrefillStart=Math.min(...events.filter(item=>item.phase==="prefill"&&item.event==="start").map(item=>item.at));
  assert.ok(lastInjectEnd<=firstPrefillStart,{lastInjectEnd,firstPrefillStart});
  const lastPrefillEnd=Math.max(...events.filter(item=>item.phase==="prefill"&&item.event==="end").map(item=>item.at));
  const firstUploadWaitStart=Math.min(...events.filter(item=>["upload","wait_upload"].includes(item.phase)&&item.event==="start").map(item=>item.at));
  assert.ok(lastPrefillEnd<=firstUploadWaitStart,{lastPrefillEnd,firstUploadWaitStart});
  const lastUploadEnd=Math.max(...events.filter(item=>["upload","wait_upload"].includes(item.phase)&&item.event==="end").map(item=>item.at));
  const firstMutationStart=Math.min(...events.filter(item=>item.phase==="mutate"&&item.event==="start").map(item=>item.at));
  assert.ok(lastUploadEnd<=firstMutationStart,{lastUploadEnd,firstMutationStart});
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.ready,true);
  assert.equal(summary.scheduler.uiConcurrency,1);
});

test("publisher serializes two health inspections before the first upload injection", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-health-check-test-"));
  const log=path.join(root,"events.ndjson");
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu","douyin"],defaultPlatforms:["xiaohongshu","douyin"],execution:{checkConcurrency:2,uploadConcurrency:2}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Health check",xhsTopics:["Test"],douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"health-check","xiaohongshu","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const publisherSource=await fs.promises.readFile(path.join(V2_DIR,"publisher.mjs"),"utf8");
  assert.match(publisherSource,/const HEALTH_CHECK_CONCURRENCY = 1/);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  const inspections=events.filter(item=>item.phase==="inspect"&&item.event==="start");
  assert.equal(inspections.length,4,"every selected platform must pass two read-only health inspections");
  const healthEvents=events.filter(item=>item.phase==="inspect").map(item=>`${item.event}:${item.platform}`);
  assert.deepEqual(healthEvents,["start:xiaohongshu","end:xiaohongshu","start:douyin","end:douyin","start:xiaohongshu","end:xiaohongshu","start:douyin","end:douyin"]);
  const lastInspectEnd=Math.max(...events.filter(item=>item.phase==="inspect"&&item.event==="end").map(item=>item.at));
  const firstInjectStart=Math.min(...events.filter(item=>item.phase==="inject"&&item.event==="start").map(item=>item.at));
  assert.ok(lastInspectEnd<=firstInjectStart,{lastInspectEnd,firstInjectStart});
});

test("fast wrapper retries the same job once after a shared Ego channel failure", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-wrapper-recovery-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const markerPath=path.join(root,"first-publisher.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu"],defaultPlatforms:["xiaohongshu"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Wrapper recovery",xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
  const wrapper=path.join(V2_DIR,"..","run-fast-platforms.sh");
  const wrapperSource=await fs.promises.readFile(wrapper,"utf8");
  assert.match(wrapperSource,/recovery_delays=\(5 10\)/);
  assert.match(wrapperSource,/item\?\.history.*INPUT_CHANNEL_BROKEN/);
  const result=await run("bash",[wrapper,packagePath,"wrapper-recovery","xiaohongshu","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_BROKEN_ONCE:"xiaohongshu:*",VIDEO_PUBLISHER_V2_MOCK_BROKEN_ONCE_MARKER:markerPath,VIDEO_PUBLISHER_INPUT_RECOVERY_DELAYS:"0,0"}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  assert.match(result.stderr,/retrying the same job in 0s \(1\/2\)/);
  assert.equal(fs.existsSync(markerPath),true);
  const stateDirs=(await fs.promises.readdir(root,{withFileTypes:true})).filter(item=>item.isDirectory()&&item.name!=='.publisher');
  assert.equal(stateDirs.length,1,"recovery must reuse the original job directory");
  const state=JSON.parse(await fs.promises.readFile(path.join(root,stateDirs[0].name,"state.json"),"utf8"));
  assert.equal(state.status,"ready");
});

test("publisher circuit-breaks all UI mutation after an upload loses Ego", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-channel-break-test-"));
  const log=path.join(root,"events.ndjson");
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu","douyin"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:2,uploadConcurrency:2}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Circuit breaker",xhsTopics:["Test"],douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"channel-break","xiaohongshu","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log,VIDEO_PUBLISHER_V2_MOCK_BROKEN_CHANNEL:"douyin:inject"}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  assert.match(result.stderr,/UI serial: none \(input channel broken\)/);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.equal(events.some(item=>item.phase==="mutate"),false,"no platform may mutate after a shared Ego channel failure");
  assert.equal(events.filter(item=>item.phase==="verify"&&item.event==="start").length,2,"read-only final verification still records page truth");
});

test("publisher stops the serial UI queue when a mutator loses Ego", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-mutation-break-test-"));
  const log=path.join(root,"events.ndjson");
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu","douyin","wechat_channels"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:3,uploadConcurrency:3}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Mutation break",xhsTopics:["Test"],douyinTopics:["Test"],wechatDescription:"Mutation circuit breaker\n\n#Test",wechatShortTitle:"Mutation break",wechatTags:["Test"],wechatPublish:{mode:"immediate"},wechatLink:{type:"none"},wechatAiGenerated:false,cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"mutation-break","xiaohongshu","douyin","wechat_channels","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log,VIDEO_PUBLISHER_V2_MOCK_BROKEN_CHANNEL:"douyin:mutate"}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  const mutationStarts=events.filter(item=>item.phase==="mutate"&&item.event==="start").map(item=>item.platform);
  assert.deepEqual(mutationStarts,["xiaohongshu","douyin"],"platforms queued after the broken mutator must never start UI mutation");
  assert.equal(events.filter(item=>item.phase==="verify"&&item.event==="start").length,3,"final read-only verification still records every platform");
});

test("publisher blocks browser work when onboarding is incomplete", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-onboarding-test-"));
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(configPath,"{}");
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),path.join(root,"missing-package.json")],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath}});
  assert.equal(result.code,1);
  assert.match(result.stderr,/onboarding is incomplete/);
});

test("publisher rejects platforms that were not configured as available", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-platform-availability-test-"));
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu"],defaultPlatforms:["xiaohongshu"]}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),path.join(root,"missing-package.json"),"availability-test","douyin"],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,2);
  assert.match(result.stderr,/Platform is not configured as available: douyin/);
  assert.equal(fs.existsSync(log),false,"unavailable platforms must be rejected before browser work");
  await fs.promises.rm(root,{recursive:true,force:true});
});

test("publisher allows an available non-default platform when explicitly selected", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-platform-override-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Availability override",douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu","douyin"],defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:2,uploadConcurrency:2}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"availability-override","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.deepEqual(new Set(events.map(item=>item.platform)),new Set(["douyin"]));
  await fs.promises.rm(root,{recursive:true,force:true});
});

test("publisher requires current-run confirmation when onboarding policy asks each run", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-rights-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Rights test",xhsTopics:["Test"],xhsOriginal:true,cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"xiaohongshu"],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,2);
  assert.match(result.stderr,/Originality confirmation is required/);
  assert.equal(fs.existsSync(log),false,"browser runner must not start without current-run rights confirmation");
});

test("Xiaohongshu defaults do not require originality confirmation", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-xhs-no-rights-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu"],defaultPlatforms:["xiaohongshu"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"XHS defaults",xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"xhs-no-rights","xiaohongshu","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  assert.equal(fs.existsSync(log),true,"Xiaohongshu default browser runner should start without originality confirmation");
  assert.equal(JSON.parse(result.stdout).ready,true);
});

test("WeChat mutation does not require originality confirmation", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-wechat-no-rights-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["wechat_channels"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"WeChat defaults",wechatDescription:"WeChat defaults\n\n#Test",wechatTags:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"wechat-no-rights","wechat_channels","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  assert.equal(fs.existsSync(log),true,"WeChat browser runner should start without originality confirmation");
  assert.equal(JSON.parse(result.stdout).ready,true);
});

test("single-platform WeChat uses one persistent prepare runner plus independent verify", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-wechat-persistent-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["wechat_channels"],defaultPlatforms:["wechat_channels"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Persistent WeChat",wechatDescription:"Persistent WeChat\n\n#Test",wechatTags:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"wechat-persistent","wechat_channels","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.deepEqual(events.filter(item=>item.event==="start").map(item=>item.phase),["inspect","inspect","prepare","verify"]);
  assert.equal(JSON.parse(result.stdout).ready,true);
});

test("single-platform WeChat auto-publishes only after independent READY verification", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-wechat-auto-publish-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["wechat_channels"],defaultPlatforms:["wechat_channels"],execution:{checkConcurrency:1,uploadConcurrency:1,autoPublishOnReady:true}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Auto publish WeChat",wechatDescription:"Auto publish WeChat\n\n#Test",wechatTags:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"wechat-auto-publish","wechat_channels","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.deepEqual(events.filter(item=>item.event==="start").map(item=>item.phase),["inspect","inspect","prepare","verify","publish"]);
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.status,"published");
  assert.equal(summary.platforms.wechat_channels.published,true);
});

test("Xiaohongshu auto-publishes only after persistent prepare and independent READY verification", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-xhs-auto-publish-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu"],defaultPlatforms:["xiaohongshu"],execution:{checkConcurrency:1,uploadConcurrency:1,autoPublishOnReady:true}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"XHS auto publish",xhsDescription:"XHS description",xhsTopics:["One","Two","Three"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"xhs-auto-publish","xiaohongshu","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const phases=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line)).filter(item=>item.event==="start").map(item=>item.phase);
  assert.deepEqual(phases,["inspect","inspect","prepare","verify","publish"]);
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.status,"published");
  assert.equal(summary.platforms.xiaohongshu.published,true);
});

test("configured automatic publishing includes the live-accepted Douyin flow", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-douyin-explicit-publish-test-"));
  const log=path.join(root,"events.ndjson");
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["douyin"],defaultPlatforms:["douyin"],declarations:{originalityPolicy:"ask_each_run"},execution:{checkConcurrency:1,uploadConcurrency:1,autoPublishOnReady:true}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Douyin explicit publish",douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"douyin-auto","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.deepEqual(events.filter(item=>item.event==="start").map(item=>item.phase),["inspect","inspect","inject","prefill","wait_upload","mutate","publish"]);
  assert.equal(JSON.parse(result.stdout).platforms.douyin.published,true);
});

test("a retry never re-enters a platform that already published", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-partial-publish-retry-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const firstLog=path.join(root,"first.ndjson");
  const retryLog=path.join(root,"retry.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:2,onboarding:{completed:true},sourceDirectory:root,availablePlatforms:["xiaohongshu","wechat_channels"],defaultPlatforms:["xiaohongshu","wechat_channels"],execution:{checkConcurrency:2,uploadConcurrency:2,autoPublishOnReady:true}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Partial publish",xhsDescription:"XHS description",xhsTopics:["One","Two","Three"],wechatDescription:"WeChat description\n\n#One #Two #Three",wechatTags:["One","Two","Three"],cover:{uploadCustomCover:false}}));
  const args=[path.join(V2_DIR,"publisher.mjs"),packagePath,"partial-publish","xiaohongshu","wechat_channels","--state-root",root];
  const baseEnv={...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs")};
  const first=await run(process.execPath,args,{env:{...baseEnv,VIDEO_PUBLISHER_V2_MOCK_LOG:firstLog,VIDEO_PUBLISHER_V2_MOCK_BROKEN_CHANNEL:"wechat_channels:publish"}});
  assert.equal(first.code,10,`${first.stderr}\n${first.stdout}`);
  const firstSummary=JSON.parse(first.stdout);
  assert.equal(firstSummary.platforms.xiaohongshu.published,true);
  assert.equal(firstSummary.platforms.wechat_channels.published,false);
  const retry=await run(process.execPath,args,{env:{...baseEnv,VIDEO_PUBLISHER_V2_MOCK_LOG:retryLog}});
  assert.equal(retry.code,0,`${retry.stderr}\n${retry.stdout}`);
  const retryEvents=(await fs.promises.readFile(retryLog,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.equal(retryEvents.some(item=>item.platform==="xiaohongshu"),false,"published Xiaohongshu must be skipped completely on retry");
  assert.equal(JSON.parse(retry.stdout).platforms.wechat_channels.published,true);
});

test("WeChat opt-in originality requires current-run confirmation", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-wechat-rights-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["wechat_channels"],execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"WeChat original",wechatDescription:"WeChat original\n\n#Test",wechatTags:["Test"],wechatOriginal:true,cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"wechat-rights","wechat_channels","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,2);
  assert.match(result.stderr,/Originality confirmation is required/);
  assert.equal(fs.existsSync(log),false,"WeChat browser runner must not start when opt-in originality lacks confirmation");
});

test("publisher accepts onboarded all-videos-original policy without a one-run flag", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-standing-rights-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Standing rights test",xhsTopics:["Test"],xhsOriginal:true,cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"xiaohongshu","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,0,`${result.stderr}\n${result.stdout}`);
  assert.equal(fs.existsSync(log),true,"browser runner should start under the standing originality policy");
  assert.equal(JSON.parse(result.stdout).ready,true);
});

test("publisher blocks an over-15-minute Douyin video before browser work", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-duration-test-"));
  const videoPath=path.join(root,"too-long.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,mp4WithDuration(901));
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["douyin"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Duration test",douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"duration-test","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,1);
  assert.match(result.stderr,/DOUYIN_DURATION_LIMIT/);
  assert.equal(fs.existsSync(log),false,"browser runner must not start for over-limit media");
});

test("publisher isolates a Douyin duration blocker and still prepares eligible platforms", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-partial-preflight-test-"));
  const videoPath=path.join(root,"too-long-for-douyin.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,mp4WithDuration(901));
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu","douyin"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:2,uploadConcurrency:2}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Partial preflight",xhsTopics:["Test"],douyinTopics:["Test"],cover:{uploadCustomCover:false}}));
  const result=await run(process.execPath,[path.join(V2_DIR,"publisher.mjs"),packagePath,"partial-preflight","xiaohongshu","douyin","--state-root",root],{env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}});
  assert.equal(result.code,10,`${result.stderr}\n${result.stdout}`);
  const summary=JSON.parse(result.stdout);
  assert.equal(summary.platforms.xiaohongshu.ready,true);
  assert.equal(summary.platforms.douyin.ready,false);
  assert.equal(summary.platforms.douyin.blocker.code,"PLATFORM_REJECTED_ASSET");
  assert.match(summary.platforms.douyin.blocker.message,/DOUYIN_DURATION_LIMIT/);
  const events=(await fs.promises.readFile(log,"utf8")).trim().split(/\n/).map(line=>JSON.parse(line));
  assert.deepEqual(new Set(events.map(item=>item.platform)),new Set(["xiaohongshu"]));
});

test("publisher invalidates receipts and checkpoints when Ego recreates a task space", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-task-recreate-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const jobId="task-recreate-job";
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Task recreate",xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
  const args=[path.join(V2_DIR,"publisher.mjs"),packagePath,"task-recreate","xiaohongshu","--job-id",jobId,"--state-root",root];
  const baseEnv={...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs")};
  const first=await run(process.execPath,args,{env:baseEnv});
  assert.equal(first.code,0,`${first.stderr}\n${first.stdout}`);
  const statePath=path.join(root,jobId,"state.json");
  const state=JSON.parse(await fs.promises.readFile(statePath,"utf8"));
  state.platforms.xiaohongshu.receipts.legacyOnly={stale:true};
  state.platforms.xiaohongshu.receiptTaskSpaceId=11;
  await fs.promises.writeFile(statePath,JSON.stringify(state,null,2));
  const checkpointPath=path.join(root,jobId,"checkpoints","xiaohongshu.receipts.json");
  await fs.promises.writeFile(checkpointPath,JSON.stringify({schemaVersion:2,platform:"xiaohongshu",fingerprint:state.fingerprint,taskSpaceId:11,receipts:{legacyOnly:{stale:true}}}));
  const second=await run(process.execPath,args,{env:{...baseEnv,VIDEO_PUBLISHER_V2_MOCK_TASK_SPACE_ID:"99"}});
  assert.equal(second.code,0,`${second.stderr}\n${second.stdout}`);
  const recovered=JSON.parse(await fs.promises.readFile(statePath,"utf8"));
  assert.equal(recovered.platforms.xiaohongshu.taskSpaceId,99);
  assert.equal(recovered.platforms.xiaohongshu.receiptTaskSpaceId,99);
  assert.equal(recovered.platforms.xiaohongshu.receipts.cover.taskSpaceId,99);
  assert.equal(recovered.platforms.xiaohongshu.receipts.legacyOnly,undefined);
  assert.equal(fs.existsSync(checkpointPath),false);

  recovered.platforms.xiaohongshu.receipts.legacyOnly={stale:true};
  await fs.promises.writeFile(statePath,JSON.stringify(recovered,null,2));
  await fs.promises.writeFile(checkpointPath,JSON.stringify({schemaVersion:2,platform:"xiaohongshu",fingerprint:recovered.fingerprint,taskSpaceId:99,receipts:{legacyOnly:{stale:true}}}));
  const recycled=await run(process.execPath,args,{env:{...baseEnv,VIDEO_PUBLISHER_V2_MOCK_TASK_SPACE_ID:"99",VIDEO_PUBLISHER_V2_MOCK_TASK_SPACE_RECREATED:"1"}});
  assert.equal(recycled.code,0,`${recycled.stderr}\n${recycled.stdout}`);
  const recycledState=JSON.parse(await fs.promises.readFile(statePath,"utf8"));
  assert.equal(recycledState.platforms.xiaohongshu.taskSpaceId,99);
  assert.equal(recycledState.platforms.xiaohongshu.receipts.legacyOnly,undefined,"a recreated space must invalidate receipts even when Ego reuses the same numeric id");
  assert.equal(fs.existsSync(checkpointPath),false);
});

test("publisher preserves the recorded task-space name when a retry changes its display suffix", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-task-name-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const jobId="stable-task-name-job";
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Stable task name",xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
  const base=[path.join(V2_DIR,"publisher.mjs"),packagePath];
  const tail=["xiaohongshu","--job-id",jobId,"--state-root",root];
  const env={...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs")};
  const first=await run(process.execPath,[...base,"original-suffix",...tail],{env});
  assert.equal(first.code,0,`${first.stderr}\n${first.stdout}`);
  const statePath=path.join(root,jobId,"state.json");
  const firstState=JSON.parse(await fs.promises.readFile(statePath,"utf8"));
  const recordedName=firstState.platforms.xiaohongshu.taskSpaceName;
  assert.equal(recordedName,`video publisher v2 xiaohongshu original-suffix-${jobId}`);
  delete firstState.platforms.xiaohongshu.taskSpaceName;
  await fs.promises.writeFile(statePath,JSON.stringify(firstState,null,2));
  const second=await run(process.execPath,[...base,"changed-suffix",...tail],{env});
  assert.equal(second.code,0,`${second.stderr}\n${second.stdout}`);
  const recovered=JSON.parse(await fs.promises.readFile(statePath,"utf8"));
  assert.equal(recovered.platforms.xiaohongshu.taskSpaceName,recordedName,"legacy state should recover the stable name from its last evidence");
});

test("two publishers for the same job produce one winner and one immediate refusal", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-double-run-test-"));
  const videoPath=path.join(root,"sample-video.mp4");
  const packagePath=path.join(root,"package.json");
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(videoPath,"test video fixture");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:"Double run",xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
  const args=[path.join(V2_DIR,"publisher.mjs"),packagePath,"double-run","xiaohongshu","--job-id","shared-job","--state-root",root];
  const options={env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}};
  const results=await Promise.all([run(process.execPath,args,options),run(process.execPath,args,options)]);
  assert.deepEqual(results.map(item=>item.code).sort(),[0,1]);
  const winner=results.find(item=>item.code===0);
  const refused=results.find(item=>item.code===1);
  assert.equal(JSON.parse(winner.stdout).ready,true);
  assert.match(refused.stderr,/already running.+refusing a second orchestrator/);
  assert.equal(fs.existsSync(path.join(root,"shared-job","orchestrator.lock")),false);
});

test("two different jobs under one state root cannot split platform ownership", async () => {
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),"video-publisher-v2-global-lock-test-"));
  const configPath=path.join(root,"config.json");
  const log=path.join(root,"events.ndjson");
  await fs.promises.writeFile(configPath,JSON.stringify({schemaVersion:1,onboarding:{completed:true},sourceDirectory:root,defaultPlatforms:["xiaohongshu"],declarations:{originalityPolicy:"all_videos_original"},execution:{checkConcurrency:1,uploadConcurrency:1}}));
  const packagePaths=[];
  for (const suffix of ["a","b"]) {
    const videoPath=path.join(root,`sample-${suffix}.mp4`);
    const packagePath=path.join(root,`package-${suffix}.json`);
    await fs.promises.writeFile(videoPath,`test video fixture ${suffix}`);
    await fs.promises.writeFile(packagePath,JSON.stringify({videoPath,title:`Global lock ${suffix}`,xhsTopics:["Test"],cover:{uploadCustomCover:false}}));
    packagePaths.push(packagePath);
  }
  const options={env:{...process.env,VIDEO_PUBLISHER_CONFIG:configPath,VIDEO_PUBLISHER_V2_RUNNER:path.join(DIR,"mock-runner.mjs"),VIDEO_PUBLISHER_V2_MOCK_LOG:log}};
  const argsFor=(packagePath,jobId)=>[path.join(V2_DIR,"publisher.mjs"),packagePath,"global-lock","xiaohongshu","--job-id",jobId,"--state-root",root];
  const results=await Promise.all([
    run(process.execPath,argsFor(packagePaths[0],"job-a"),options),
    run(process.execPath,argsFor(packagePaths[1],"job-b"),options),
  ]);
  assert.deepEqual(results.map(item=>item.code).sort(),[0,1]);
  const winner=results.find(item=>item.code===0);
  const refused=results.find(item=>item.code===1);
  assert.equal(JSON.parse(winner.stdout).ready,true);
  assert.match(refused.stderr,/Another video publishing job is already running/);
  const stateFiles=["job-a","job-b"].filter(jobId=>fs.existsSync(path.join(root,jobId,"state.json")));
  assert.equal(stateFiles.length,1,"the refused job must not write state");
  assert.equal(fs.existsSync(path.join(root,".publisher","orchestrator.lock")),false);
});
