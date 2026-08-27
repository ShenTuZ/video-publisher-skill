const wechatDescription = pkg.wechatDescription;
const wechatShortTitle = pkg.wechatShortTitle;
const wechatPublish = pkg.wechatPublish;
const wechatLink = pkg.wechatLink;
const wechatAiGenerated = pkg.wechatAiGenerated;
const wechatOriginal = pkg.wechatOriginal === true;
const wechatPolicies = pkg.wechatPolicies;
const wechatExpectedAiLabel = wechatAiGenerated ? '含AI生成内容' : '无需标注';
const wechatCustomCover = pkg.cover?.uploadCustomCover === true;
const wechatCoverAssets = [
  {slot:'vertical',ratio:'3:4',path:String(pkg.cover?.vertical3x4Path||''),wrap:'.vertical-cover-wrap',image:'img.vertical-img-size',dialogTitle:'编辑个人主页卡片'},
  {slot:'horizontal',ratio:'4:3',path:String(pkg.cover?.horizontal4x3Path||''),wrap:'.horizon-cover-wrap',image:'img.horizon-img-size',dialogTitle:'编辑分享卡片'},
];

async function inspectWechatChannels() {
  const state=await js(String.raw`((expectedDescription,expectedShortTitle,expectedPublishMode,expectedPublishAt,expectedAiLabel,expectedLinkType,expectedProductName) => {
    const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>4&&r.height>4&&s.display!=='none'&&s.visibility!=='hidden'};const text=compact(roots.map(root=>root.body?.innerText||root.host?.innerText||'').join('\n'));
    const descEditors=roots.flatMap(root=>[...root.querySelectorAll('[contenteditable="true"],[contenteditable=""],textarea')]).filter(visible).filter(el=>/input-editor|视频描述|editor/i.test(String(el.className||''))&&!/chatInput/.test(String(el.className||'')));
    const description=compact(descEditors[0]?.innerText||descEditors[0]?.value||descEditors[0]?.textContent||'');
    const shortInput=roots.flatMap(root=>[...root.querySelectorAll('input')]).find(el=>(el.placeholder||'').includes('短标题'));const shortTitle=String(shortInput?.value||'').trim();
    const formItems=roots.flatMap(root=>[...root.querySelectorAll('.form-item')]);const sectionFor=label=>formItems.find(el=>compact(el.querySelector('.label')?.innerText||el.querySelector('.label')?.textContent||'')===label);
    const locationText=compact(sectionFor('位置')?.innerText||sectionFor('位置')?.textContent||'');const collectionText=compact(sectionFor('添加到合集')?.innerText||sectionFor('添加到合集')?.textContent||'');
    const activityText=compact(sectionFor('活动')?.innerText||sectionFor('活动')?.textContent||'');const activityNone=/不参与活动/.test(activityText);
    const scheduleSection=sectionFor('定时发表');const scheduleRadios=[...(scheduleSection?.querySelectorAll('input[type="radio"]')||[])];const scheduled=Boolean(scheduleRadios.find(input=>String(input.value)==='1')?.checked);const actualPublishMode=scheduled?'scheduled':'immediate';const publishAtInput=roots.flatMap(root=>[...root.querySelectorAll('input')]).find(el=>(el.placeholder||'')==='请选择发表时间');const actualPublishAt=String(publishAtInput?.value||'').trim();
    const markSection=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-mark-tag')])[0];const aiLabel=compact(markSection?.querySelector('.select-display')?.innerText||markSection?.querySelector('.select-display')?.textContent||'');
    const linkSection=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link')])[0];const linkText=compact(linkSection?.innerText||linkSection?.textContent||'');const productLinkOk=expectedLinkType==='none'?/选择链接/.test(linkText):Boolean(linkText)&&/商品/.test(linkText)&&!/(选择链接|选择需要添加的商品)/.test(linkText)&&(!expectedProductName||linkText.includes(expectedProductName));
    const originalInput=roots.flatMap(root=>[...root.querySelectorAll('.declare-original-checkbox input[type="checkbox"]')])[0];const originalEnabled=Boolean(originalInput?.checked||/ant-checkbox-checked/.test(String(originalInput?.closest('.ant-checkbox')?.className||'')));
    const initToast=/页面初始化中/.test(text);const coverCards=/封面预览/.test(text)&&/个人主页卡片|分享卡片/.test(text);const uploading=/上传中|正在上传|处理中|剩余时间|上传进度|取消上传|(?:^|\s)\d{1,3}%(?:\s|$)/.test(text);const uploaded=coverCards&&!uploading;const failed=/上传失败|网络错误|文件格式不支持/.test(text);
    const loginRequired=/扫码登录|请登录|登录后|安全验证|验证码/.test(text)&&!/视频管理|发表动态/.test(text);const identityMatches=!uploaded||!description||description===compact(expectedDescription)||description.includes(compact(expectedDescription).slice(0,18));
    const coverUrlsBySlot={vertical:roots.flatMap(root=>[...root.querySelectorAll('.vertical-cover-wrap img.vertical-img-size')]).map(el=>el.currentSrc||el.src||'').filter(Boolean),horizontal:roots.flatMap(root=>[...root.querySelectorAll('.horizon-cover-wrap img.horizon-img-size')]).map(el=>el.currentSrc||el.src||'').filter(Boolean)};const coverUrls=[...new Set([...coverUrlsBySlot.vertical,...coverUrlsBySlot.horizontal])];
    const dialogs=roots.flatMap(root=>[...root.querySelectorAll('[role="dialog"],[class*="modal"],.weui-desktop-dialog__wrp,[class*="dialog-mask"]')]).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:compact(el.innerText||el.textContent||'').slice(0,500),cls:String(el.className||''),w:r.width,h:r.height,display:s.display,visibility:s.visibility,opacity:s.opacity}}).filter(item=>item.w>20&&item.h>20&&item.display!=='none'&&item.visibility!=='hidden'&&!/popover/i.test(item.cls)&&!(/leave-active/.test(item.cls)&&Number(item.opacity)===0));
    const videoInputs=roots.flatMap(root=>[...root.querySelectorAll('input[type=file]')]).filter(el=>/video/.test(el.accept||'')).map(el=>({accept:el.accept,files:el.files?.length||0}));
    return {text:text.slice(0,3000),description,shortTitle,locationText,collectionText,activityText,activityNone,actualPublishMode,actualPublishAt,aiLabel,linkText,productLinkOk,originalEnabled,originalFound:Boolean(originalInput),initToast,uploaded,uploading,failed,loginRequired,identityMatches,coverUrls,coverUrlsBySlot,dialogs,videoInputs,rootCount:roots.length}
  })(${JSON.stringify(wechatDescription)},${JSON.stringify(wechatShortTitle)},${JSON.stringify(wechatPublish.mode)},${JSON.stringify(wechatPublish.publishAt)},${JSON.stringify(wechatExpectedAiLabel)},${JSON.stringify(wechatLink.type)},${JSON.stringify(wechatLink.expectedName)})`);
  const buttons=await inspectFinalButtons(/^发表$/);const finalButton=buttons.find(button=>button.buttonish)||buttons[0]||null;const receipt=expectedReceipts.cover||null;
  const customCoverOk=Boolean(wechatCustomCover&&receipt?.slots&&wechatCoverAssets.every(asset=>{const item=receipt.slots[asset.slot];return item?.assetPath===asset.path&&item?.ratio===asset.ratio&&item?.afterUrl&&(state.coverUrlsBySlot[asset.slot]||[]).includes(item.afterUrl)}));const defaultCoverOk=!wechatCustomCover&&state.uploaded;
  return {gates:{
    authenticated:state.loginRequired?failedGate({loginRequired:true}):okGate({url:PLATFORM_URLS.wechat_channels}),
    draftIdentity:state.identityMatches?okGate({description:state.description}):failedGate({foreign:true,description:state.description,expected:wechatDescription}),
    video:state.uploaded&&!state.uploading&&!state.failed?okGate({stable:true,coverCards:true}):failedGate({uploaded:state.uploaded,uploading:state.uploading,failed:state.failed,initToast:state.initToast,videoInputs:state.videoInputs}),
    description:state.description===compactText(wechatDescription)?okGate({expected:wechatDescription,actual:state.description}):failedGate({expected:wechatDescription,actual:state.description}),
    shortTitle:state.shortTitle===wechatShortTitle?okGate({expected:wechatShortTitle,actual:state.shortTitle}):failedGate({expected:wechatShortTitle,actual:state.shortTitle}),
    activity:wechatPolicies.activity==='none'&&state.activityNone?okGate({expected:'不参与活动',actual:state.activityText}):failedGate({expected:wechatPolicies.activity,actual:state.activityText}),
    schedule:state.actualPublishMode===wechatPublish.mode&&(wechatPublish.mode!=='scheduled'||state.actualPublishAt===wechatPublish.publishAt)?okGate({expected:wechatPublish,actual:{mode:state.actualPublishMode,publishAt:state.actualPublishAt}}):failedGate({expected:wechatPublish,actual:{mode:state.actualPublishMode,publishAt:state.actualPublishAt}}),
    aiLabel:state.aiLabel===wechatExpectedAiLabel?okGate({expected:wechatExpectedAiLabel,actual:state.aiLabel}):failedGate({expected:wechatExpectedAiLabel,actual:state.aiLabel}),
    productLink:state.productLinkOk?okGate({expected:wechatLink,actual:state.linkText}):failedGate({expected:wechatLink,actual:state.linkText}),
    original:wechatOriginal?(state.originalFound&&state.originalEnabled?okGate({expected:true,enabled:true,found:true}):failedGate({expected:true,enabled:state.originalEnabled,found:state.originalFound})):(!state.originalEnabled?okGate({expected:false,enabled:false,found:state.originalFound}):failedGate({expected:false,enabled:true,found:state.originalFound})),
    cover:customCoverOk||defaultCoverOk?okGate({custom:wechatCustomCover,urls:state.coverUrls,urlsBySlot:state.coverUrlsBySlot,receipt}):failedGate({custom:wechatCustomCover,urls:state.coverUrls,urlsBySlot:state.coverUrlsBySlot,receipt,reason:wechatCustomCover&&!receipt?'custom cover receipt missing':'cover not verified'}),
    noBlockingDialog:state.dialogs.length===0?okGate({active:[]}):failedGate({active:state.dialogs}),
    finalButton:finalButton&&!finalButton.disabled?okGate(finalButton):failedGate({buttons}),
  },evidence:{pageSample:state.text,initToast:state.initToast,rootCount:state.rootCount,locationPreserved:state.locationText,collectionUntouched:state.collectionText}};
}

async function getWechatUploadProbe(){return await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const text=compact(roots.map(root=>root.body?.innerText||root.host?.innerText||'').join('\n'));const input=roots.flatMap(root=>[...root.querySelectorAll('input[type=file]')]).find(el=>/video/.test(el.accept||''));const coverCards=/封面预览/.test(text)&&/个人主页卡片|分享卡片/.test(text);const uploading=/上传中|正在上传|处理中|剩余时间|上传进度|取消上传|(?:^|\s)\d{1,3}%(?:\s|$)/.test(text);const failed=/上传失败|网络错误|文件格式不支持/.test(text);return {initToast:/页面初始化中/.test(text),hasInput:Boolean(input),uploaded:coverCards,coverCards,uploading,failed,completed:coverCards&&!uploading&&!failed,sample:text.slice(0,1000)}})()`)}

async function activateWechatLifecycle(){await cdp('Page.bringToFront',{}).catch(()=>null);await cdp('Page.setWebLifecycleState',{state:'active'}).catch(()=>null);await cdp('Emulation.setFocusEmulationEnabled',{enabled:true}).catch(()=>null)}

async function waitWechatSdkReady(seconds){for(let i=0;i<seconds;i+=2){await activateWechatLifecycle();const probe=await getWechatUploadProbe();if(probe.uploaded||(!probe.initToast&&probe.hasInput))return {ok:true,probe};await wait(2)}return {ok:false,probe:await getWechatUploadProbe()}}

async function injectWechatVideo(){const evaluated=await cdp('Runtime.evaluate',{expression:String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];return roots.flatMap(root=>[...root.querySelectorAll('input[type=file]')]).find(el=>/video/.test(el.accept||''))})()`,objectGroup:'video-publisher-v2-wechat',includeCommandLineAPI:true});const objectId=evaluated?.result?.objectId;if(!objectId)return {ok:false,reason:'wechat video input objectId missing'};await cdp('DOM.setFileInputFiles',{objectId,files:[videoPath]});return {ok:true,objectId}}

async function waitWechatUploadCompletion(){let stableSamples=0;for(let i=0;i<900;i+=1){await activateWechatLifecycle();const probe=await getWechatUploadProbe();if(probe.failed){const after=await inspectWechatChannels();return {...after,blocker:typedBlocker('PLATFORM_REJECTED_ASSET','视频号明确拒绝了上传文件',{retryable:true,evidence:probe})}}stableSamples=probe.completed?stableSamples+1:0;if(stableSamples>=3){const current=await inspectWechatChannels();if(current.gates.video.ok)return current;stableSamples=0}await wait(1)}const after=await inspectWechatChannels();return {...after,blocker:typedBlocker('UPLOAD_STALLED','视频号上传没有在等待窗口内稳定完成',{retryable:true,evidence:after.gates.video.evidence})}}

async function waitWechatUploadStart(){
  let fallbackDispatched=false;
  for(let attempt=0;attempt<20;attempt+=1){
    await activateWechatLifecycle();
    const current=await inspectWechatChannels();
    if(current.gates.video.ok||current.gates.video.evidence?.uploading)return current;
    if(current.gates.video.evidence?.failed)return {...current,blocker:typedBlocker('PLATFORM_REJECTED_ASSET','视频号明确拒绝了上传文件',{retryable:true,evidence:current.gates.video.evidence})};
    if(attempt===6&&!fallbackDispatched){
      await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const input=roots.flatMap(root=>[...root.querySelectorAll('input[type=file]')]).find(el=>/video/.test(el.accept||''));if(input)input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));return {files:input?.files?.length||0}})()`);
      fallbackDispatched=true;
    }
    await wait(1);
  }
  const after=await inspectWechatChannels();
  return {...after,blocker:typedBlocker('UPLOAD_NOT_STARTED','视频号文件注入后没有出现上传状态',{retryable:true,evidence:after.gates.video.evidence})};
}

async function startWechatUpload(){
  const before=await inspectWechatChannels();
  if(before.gates.video.ok)return {...before,actions:{upload:{mode:'already_ready'}}};
  if(!before.gates.draftIdentity.ok)return {...before,blocker:typedBlocker('FOREIGN_DRAFT','视频号当前编辑器属于其他视频草稿',{evidence:before.gates.draftIdentity.evidence})};
  if(before.gates.video.evidence?.uploading)return {...before,actions:{upload:{mode:'resume_existing'}}};
  let ready=await waitWechatSdkReady(publishProfile==='fast'?8:30);
  if(!ready.ok){await gotoAndWait(PLATFORM_URLS.wechat_channels,{timeout:45,settle:2});ready=await waitWechatSdkReady(publishProfile==='fast'?20:90)}
  if(!ready.ok){const after=await inspectWechatChannels();return {...after,blocker:typedBlocker('RISK_CONTROL','视频号 Wujie 上传 SDK 没有在激活页面生命周期后完成初始化',{retryable:true,evidence:ready.probe})}}
  const injected=await injectWechatVideo();
  if(!injected.ok)return {...before,blocker:typedBlocker('UPLOAD_NOT_STARTED',injected.reason,{retryable:true})};
  const started=await waitWechatUploadStart();
  return {...started,actions:{upload:{mode:'injected'}}};
}

async function waitWechatUploadOnly(){
  const before=await inspectWechatChannels();
  if(before.gates.video.ok)return {...before,actions:{upload:{mode:'already_ready'}}};
  if(!before.gates.video.evidence?.uploading)return {...before,blocker:typedBlocker('UPLOAD_NOT_STARTED','视频号没有可等待的上传任务',{retryable:true,evidence:before.gates.video.evidence})};
  const current=await waitWechatUploadCompletion();
  return {...current,actions:{upload:{mode:'resume_existing'}}};
}

async function uploadWechatChannels(){
  const started=await startWechatUpload();
  if(started.blocker||started.gates.video.ok)return started;
  return await waitWechatUploadOnly();
}

async function setWechatTextFields({description=true,shortTitle=true}={}){return await js(String.raw`((descriptionValue,shortTitleValue,setDescription,setShortTitle) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const result={ok:true};if(setDescription){const editor=roots.flatMap(root=>[...root.querySelectorAll('[contenteditable="true"],[contenteditable=""]')]).find(el=>/input-editor|视频描述|editor/i.test(String(el.className||''))&&!/chatInput/.test(String(el.className||'')));if(!editor)return {ok:false,reason:'wechat description editor missing'};editor.focus();const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(editor);sel.removeAllRanges();sel.addRange(range);document.execCommand('delete',false);document.execCommand('insertText',false,descriptionValue);editor.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:descriptionValue}));editor.dispatchEvent(new Event('change',{bubbles:true,composed:true}));result.description={ok:compact(editor.innerText||editor.textContent||'')===compact(descriptionValue),actual:editor.innerText||editor.textContent||''};result.ok&&=result.description.ok}if(setShortTitle){const input=roots.flatMap(root=>[...root.querySelectorAll('input')]).find(el=>(el.placeholder||'').includes('短标题'));if(!input)return {...result,ok:false,reason:'wechat short-title input missing'};const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)return {...result,ok:false,reason:'wechat short-title setter missing'};setter.call(input,shortTitleValue);input.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:shortTitleValue}));input.dispatchEvent(new Event('change',{bubbles:true,composed:true}));result.shortTitle={ok:input.value===shortTitleValue,actual:input.value};result.ok&&=result.shortTitle.ok}return result})(${JSON.stringify(wechatDescription)},${JSON.stringify(wechatShortTitle)},${JSON.stringify(description)},${JSON.stringify(shortTitle)})`)}

async function setWechatDescription(){const result=await setWechatTextFields({description:true,shortTitle:false});return result.description||result}

async function setWechatShortTitle(){const result=await setWechatTextFields({description:false,shortTitle:true});return result.shortTitle||result}

async function ensureWechatNoActivity(currentGate=null){const gate=currentGate||(await inspectWechatChannels()).gates.activity;if(gate.ok)return {ok:true,already:true};const target=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item')]).find(el=>compact(el.querySelector('.label')?.innerText||'')==='活动');const control=section&&[...section.querySelectorAll('div,span')].find(el=>compact(el.innerText||el.textContent||'')===compact(section.innerText||section.textContent||'').replace(/^活动\s*/,''));if(!control)return {ok:false,reason:'wechat activity control missing'};control.scrollIntoView({block:'center'});const r=control.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!target.ok)return target;await click([target.x,target.y],{label:'open activity choices'});await wait(1);const option=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('div,span,li')]).filter(visible).find(el=>compact(el.innerText||el.textContent||'')==='不参与活动');if(!el)return {ok:false,reason:'wechat no-activity option missing'};const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!option.ok)return option;await click([option.x,option.y],{label:'select no activity'});await wait(1);const after=await inspectWechatChannels();return {ok:after.gates.activity.ok,evidence:after.gates.activity.evidence}}

async function ensureWechatSchedule(currentGate=null){
  const gate=currentGate||(await inspectWechatChannels()).gates.schedule;
  if(gate.ok)return {ok:true,already:true};
  const modeValue=wechatPublish.mode==='scheduled'?'1':'0';
  const target=await js(String.raw`((value) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item')]).find(el=>compact(el.querySelector('.label')?.innerText||'')==='定时发表');const input=section?.querySelector('input[type="radio"][value="'+value+'"]');const el=input?.closest('label')||input;if(!el)return {ok:false,reason:'wechat schedule radio missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})(${JSON.stringify(modeValue)})`);
  if(!target.ok)return target;
  await click([target.x,target.y],{label:'set publish timing'});
  await wait(1);
  if(wechatPublish.mode==='scheduled'){
    const [expectedDate,expectedTime]=String(wechatPublish.publishAt||'').split(' ');
    const picker=await js(String.raw`((expectedDate) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const main=roots.flatMap(root=>[...root.querySelectorAll('input')]).find(el=>(el.placeholder||'')==='请选择发表时间');if(!main)return {ok:false,reason:'wechat scheduled-time input missing'};main.scrollIntoView({block:'center'});const currentDate=String(main.value||'').split(' ')[0];if(currentDate&&currentDate!==expectedDate)return {ok:false,reason:'wechat scheduled date differs from the picker default',expectedDate,currentDate};const r=main.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,current:main.value}})(${JSON.stringify(expectedDate)})`);
    if(!picker.ok)return picker;
    await click([picker.x,picker.y],{label:'open schedule picker'});
    await wait(1);
    const timeInput=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const input=roots.flatMap(root=>[...root.querySelectorAll('input')]).find(el=>(el.placeholder||'')==='请选择时间');if(!input)return {ok:false,reason:'wechat schedule time sub-input missing'};input.focus();input.select();const r=input.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,value:input.value,selectionStart:input.selectionStart,selectionEnd:input.selectionEnd}})()`);
    if(!timeInput.ok)return timeInput;
    await typeText(expectedTime);
    const commit=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const label=roots.flatMap(root=>[...root.querySelectorAll('.form-item .label')]).find(el=>compact(el.innerText||el.textContent||'')==='视频标注');if(!label)return {ok:false,reason:'wechat schedule commit target missing'};label.scrollIntoView({block:'center'});const r=label.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    if(!commit.ok)return commit;
    await click([commit.x,commit.y],{label:'commit scheduled time'});
    await wait(1);
  }
  const after=await inspectWechatChannels();
  return {ok:after.gates.schedule.ok,evidence:after.gates.schedule.evidence};
}

async function ensureWechatAiLabel(currentGate=null){const gate=currentGate||(await inspectWechatChannels()).gates.aiLabel;if(gate.ok)return {ok:true,already:true};const target=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-mark-tag')])[0];const el=section?.querySelector('.mark-tag-select')||section?.querySelector('.select-display');if(!el)return {ok:false,reason:'wechat video-label control missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!target.ok)return target;await click([target.x,target.y],{label:'open video labels'});await wait(1);const option=await js(String.raw`((label) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('.mark-tag-option')]).filter(visible).find(el=>compact(el.querySelector('.option-main')?.innerText||el.innerText||'')===label);if(!el)return {ok:false,reason:'wechat requested video label missing'};const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})(${JSON.stringify(wechatExpectedAiLabel)})`);if(!option.ok)return option;await click([option.x,option.y],{label:'select video label'});await wait(1);const after=await inspectWechatChannels();return {ok:after.gates.aiLabel.ok,evidence:after.gates.aiLabel.evidence}}

async function ensureWechatProductLink(currentGate=null){
  const poll=async(read,{attempts=25,interval=.2}={})=>{let state=null;for(let attempt=0;attempt<attempts;attempt+=1){state=await read();if(state?.ok)return state;if(attempt<attempts-1)await wait(interval)}return state};
  const pendingTiming=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.5};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.weui-desktop-dialog__wrp,[role="dialog"]')]).filter(visible).find(el=>/选择商品出现时机/.test(compact(el.innerText||el.textContent||'')));const button=[...(dialog?.querySelectorAll('button,[role="button"]')||[])].find(el=>compact(el.innerText||el.textContent||'')==='确认'&&!el.disabled);if(!button)return {ok:false};const r=button.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  if(pendingTiming.ok){await click([pendingTiming.x,pendingTiming.y],{label:'confirm pending product timing'});const closed=await poll(()=>js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const active=roots.flatMap(root=>[...root.querySelectorAll('.weui-desktop-dialog__wrp,[role="dialog"]')]).some(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.1&&/选择商品出现时机/.test(el.innerText||el.textContent||'')});return active?{ok:false}:{ok:true}})()`));if(!closed.ok)return {ok:false,reason:'wechat pending product timing dialog did not close'};const after=await inspectWechatChannels();return {ok:after.gates.productLink.ok&&after.gates.noBlockingDialog.ok,evidence:after.gates.productLink.evidence}}
  const gate=currentGate||(await inspectWechatChannels()).gates.productLink;if(gate.ok)return {ok:true,already:true};if(wechatLink.type!=='product')return {ok:false,reason:'wechat existing link cannot be safely cleared'};
  const target=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link')])[0];if(!section)return {ok:false,reason:'wechat link control missing'};const pending=section.querySelector('.post-component-choose-wrap');const choose=[...section.querySelectorAll('div,span,button')].find(el=>compact(el.innerText||el.textContent||'')==='选择链接');const display=section.querySelector('.link-display-wrap');const el=pending||choose||display;if(!el)return {ok:false,reason:'wechat link control missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,mode:pending?'product_pending':'choose_type',x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!target.ok)return target;
  if(target.mode==='choose_type'){const opened=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link')])[0];const el=section?.querySelector('.link-display-wrap')||[...(section?.querySelectorAll('div,span,button')||[])].find(el=>compact(el.innerText||el.textContent||'')==='选择链接');if(!el)return {ok:false,reason:'wechat link type menu trigger missing'};el.click();return {ok:true,native:true}})()`);if(!opened.ok)return opened;const productOption=await poll(()=>js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('.link-option-item')]).filter(visible).find(el=>compact(el.innerText||el.textContent||'')==='商品');if(!el)return {ok:false,reason:'wechat product link option unavailable for this page/account'};return {ok:true}})()`));if(!productOption.ok)return productOption;const chosen=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('.link-option-item')]).filter(visible).find(el=>compact(el.innerText||el.textContent||'')==='商品');if(!el)return {ok:false,reason:'wechat stable product option disappeared'};el.click();return {ok:true,native:true}})()`);if(!chosen.ok)return chosen;}
  const chooser=await poll(()=>js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const el=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link .post-component-choose-wrap')])[0];return el?{ok:true}:{ok:false,reason:'wechat product chooser missing'}})()`));if(!chooser.ok)return chooser;const chooserOpened=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const el=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link .post-component-choose-wrap')])[0];if(!el)return {ok:false,reason:'wechat stable product chooser disappeared'};el.click();return {ok:true,native:true}})()`);if(!chooserOpened.ok)return chooserOpened;
  let candidate;
  if(wechatLink.selection==='first'){candidate=await poll(()=>js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'};const rows=roots.flatMap(root=>[...root.querySelectorAll('.ant-table-tbody tr.ant-table-row,tbody tr,[class*="product-item"],[class*="goods-item"]')]).filter(visible).filter(el=>{const text=compact(el.innerText||el.textContent||'');return text&&!/停业中|不可添加|已失效|暂无商品/.test(text)});const row=rows[0];if(!row)return {ok:false,reason:'wechat first selectable product missing'};const radio=row.querySelector('input[type="radio"]');const button=[...row.querySelectorAll('button,[role="button"],a')].find(el=>visible(el)&&/^(添加|选择)$/.test(compact(el.innerText||el.textContent||'')));const el=radio?.closest('label')||radio||button||row;const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,text:compact(row.innerText||row.textContent||'').slice(0,500),selection:radio?'radio':button?'button':'row'}})()`),{attempts:35});}else{const search=await poll(()=>js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const input=roots.flatMap(root=>[...root.querySelectorAll('input')]).filter(visible).find(el=>/商品名称|商品ID|关键词/.test(el.placeholder||''));if(!input)return {ok:false,reason:'wechat product search input missing'};input.focus();input.select();return {ok:true}})()`));if(!search.ok)return search;await typeText(wechatLink.query);candidate=await poll(()=>js(String.raw`((needle) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const matches=roots.flatMap(root=>[...root.querySelectorAll('li,[role="option"],div')]).filter(visible).filter(el=>compact(el.innerText||el.textContent||'').includes(needle)).sort((a,b)=>compact(a.innerText||a.textContent||'').length-compact(b.innerText||b.textContent||'').length);const el=matches[0];if(!el)return {ok:false,reason:'wechat requested product not found'};const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,text:compact(el.innerText||el.textContent||'')}})(${JSON.stringify(wechatLink.expectedName||wechatLink.query)})`),{attempts:35});}
  if(!candidate.ok)return candidate;
  const selected=wechatLink.selection==='first'?await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const dialog=roots.flatMap(root=>[...root.querySelectorAll('.weui-desktop-dialog__wrp,[role="dialog"]')]).find(el=>/从橱窗添加商品/.test(compact(el.innerText||el.textContent||'')));const radio=dialog?.querySelector('input[type="radio"]');if(!radio)return {ok:false};radio.click();return {ok:radio.checked===true,native:true}})()`):{ok:false};
  if(!selected.ok)await click([candidate.x,candidate.y],{label:'select requested product'});
  const add=await poll(()=>js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('button,[role="button"]')]).filter(visible).find(el=>/^添加(?:\(\d+\))?$/.test(compact(el.innerText||el.textContent||''))&&!el.disabled&&!/disabled/.test(String(el.className||'')));if(!el)return {ok:false,reason:'wechat selected-product add button missing'};el.click();return {ok:true,native:true,text:compact(el.innerText||el.textContent||'')}})()`));if(!add.ok)return add;
  let timing={ok:false,reason:'wechat product timing state not ready'};for(let attempt=0;attempt<30;attempt+=1){timing=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.5};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.weui-desktop-dialog__wrp,[role="dialog"]')]).filter(visible).find(el=>/选择商品出现时机/.test(compact(el.innerText||el.textContent||'')));if(dialog){const button=[...dialog.querySelectorAll('button,[role="button"]')].find(el=>compact(el.innerText||el.textContent||'')==='确认'&&!el.disabled);if(!button)return {ok:false,reason:'wechat product timing confirm missing'};const r=button.getBoundingClientRect();return {ok:true,needed:true,x:r.left+r.width/2,y:r.top+r.height/2}}const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link')])[0];const text=compact(section?.innerText||section?.textContent||'');return text&&!/(选择链接|选择需要添加的商品)/.test(text)?{ok:true,needed:false,actual:text}:{ok:false,reason:'wechat product timing state not ready'}})()`);if(timing.ok&&(timing.needed||attempt>=5))break;await wait(.2)}if(!timing.ok)return timing;if(timing.needed)await click([timing.x,timing.y],{label:'confirm product timing'});
  const finalState=await poll(()=>js(String.raw`((expectedName) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const section=roots.flatMap(root=>[...root.querySelectorAll('.form-item.post-with-link')])[0];const text=compact(section?.innerText||section?.textContent||'');const productDialogActive=roots.flatMap(root=>[...root.querySelectorAll('.weui-desktop-dialog__wrp,[role="dialog"]')]).some(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.05&&/从橱窗添加商品|选择商品出现时机/.test(compact(el.innerText||el.textContent||''))});const ok=Boolean(text)&&/商品/.test(text)&&!/(选择链接|选择需要添加的商品)/.test(text)&&(!expectedName||text.includes(expectedName))&&!productDialogActive;return ok?{ok:true,actual:text}:{ok:false,reason:productDialogActive?'wechat product dialog still closing':'wechat product link did not persist',actual:text}})(${JSON.stringify(wechatLink.expectedName)})`),{attempts:30});return finalState.ok?{ok:true,evidence:{expected:wechatLink,actual:finalState.actual},candidate}:finalState;
}

async function ensureWechatOriginalPolicy(currentGate=null){
  const gate=currentGate||(await inspectWechatChannels()).gates.original;
  if(gate.ok)return {ok:true,already:true,evidence:gate.evidence};
  if(!gate.evidence?.found)return {ok:false,reason:'wechat original control missing',evidence:gate.evidence};
  const target=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const input=roots.flatMap(root=>[...root.querySelectorAll('.declare-original-checkbox input[type="checkbox"]')])[0];const el=input?.closest('label.ant-checkbox-wrapper')||input;if(!el)return {ok:false,reason:'wechat original control missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2,checked:Boolean(input.checked)}})()`);
  if(!target.ok)return target;
  await click([target.x,target.y],{label:wechatOriginal?'enable original declaration':'disable original declaration'});
  await wait(1);
  if(wechatOriginal){
    const agreement=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.declare-original-dialog .weui-desktop-dialog__wrp')]).find(visible);if(!dialog)return {ok:true,dialog:false};const input=dialog.querySelector('.original-proto-wrapper input[type="checkbox"]');if(!input)return {ok:false,reason:'wechat original agreement checkbox missing'};if(input.checked)return {ok:true,dialog:true,checked:true};const el=input.closest('label.ant-checkbox-wrapper')||input;const r=el.getBoundingClientRect();return {ok:true,dialog:true,checked:false,x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    if(!agreement.ok)return agreement;
    if(agreement.dialog&&!agreement.checked){await click([agreement.x,agreement.y],{label:'accept original agreement'});await wait(1)}
    if(agreement.dialog){
      const confirm=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.declare-original-dialog .weui-desktop-dialog__wrp')]).find(visible);if(!dialog)return {ok:false,reason:'wechat original dialog closed before confirmation'};const el=[...dialog.querySelectorAll('button,[role="button"]')].find(el=>compact(el.innerText||el.textContent||'')==='声明原创'&&!el.disabled&&!/disabled/.test(String(el.className||'')));if(!el)return {ok:false,reason:'wechat original confirm missing or disabled'};const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      if(!confirm.ok)return confirm;
      await click([confirm.x,confirm.y],{label:'confirm original declaration'});
      await wait(2);
    }
  }
  const after=await inspectWechatChannels();
  return {ok:after.gates.original.ok,evidence:after.gates.original.evidence};
}

async function prefillWechatChannels(){
  let ready=await waitWechatSdkReady(publishProfile==='fast'?8:30);
  if(!ready.ok){
    await gotoAndWait(PLATFORM_URLS.wechat_channels,{timeout:45,settle:2});
    ready=await waitWechatSdkReady(publishProfile==='fast'?20:90);
  }
  if(!ready.ok){
    const unavailable=await inspectWechatChannels();
    return {...unavailable,blocker:typedBlocker('RISK_CONTROL','视频号 Wujie 表单没有在预填前完成初始化',{retryable:true,evidence:ready.probe})};
  }
  const before=await inspectWechatChannels();
  if(!before.gates.authenticated.ok)return {...before,blocker:typedBlocker('AUTH_REQUIRED','视频号登录态无效或遇到安全验证',{requiresUser:true,evidence:before.gates.authenticated.evidence})};
  if(!before.gates.draftIdentity.ok)return {...before,blocker:typedBlocker('FOREIGN_DRAFT','视频号当前编辑器属于其他视频草稿',{evidence:before.gates.draftIdentity.evidence})};
  const productDialogActive=wechatLink.type==='product'&&before.gates.noBlockingDialog.evidence?.active?.some(item=>/从橱窗添加商品|选择商品出现时机/.test(item.text||''));
  if(!before.gates.noBlockingDialog.ok&&!productDialogActive)return {...before,blocker:typedBlocker('STATE_AMBIGUOUS','视频号预填前存在阻塞弹窗',{retryable:true,evidence:before.gates.noBlockingDialog.evidence})};
  const actions={};
  if(!before.gates.description.ok||!before.gates.shortTitle.ok){actions.textFields=await setWechatTextFields({description:!before.gates.description.ok,shortTitle:!before.gates.shortTitle.ok});if(!actions.textFields.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.textFields.reason||'视频号描述或短标题没有写入',{evidence:actions.textFields})}}
  actions.activity=publishProfile==='fast'?{ok:true,skipped:true}:await ensureWechatNoActivity(before.gates.activity);
  if(!actions.activity.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.activity.reason||'视频号活动状态没有设为不参与',{evidence:actions.activity})};
  actions.schedule=await ensureWechatSchedule(before.gates.schedule);
  if(!actions.schedule.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.schedule.reason||'视频号定时发表设置没有完成',{evidence:actions.schedule})};
  actions.aiLabel=await ensureWechatAiLabel(before.gates.aiLabel);
  if(!actions.aiLabel.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.aiLabel.reason||'视频号视频标注没有完成',{evidence:actions.aiLabel})};
  actions.productLink=await ensureWechatProductLink(before.gates.productLink);
  if(!actions.productLink.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.productLink.reason||'视频号商品链接没有完成',{evidence:actions.productLink})};
  const after=await inspectWechatChannels();
  return {...after,actions};
}

async function dismissWechatCoverEditor(){
  const dismissed=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.edit-cover-dialog .weui-desktop-dialog__wrp')]).find(visible);if(!dialog)return {ok:true,dismissed:false};const button=[...dialog.querySelectorAll('button,[role="button"]')].find(el=>compact(el.innerText||el.textContent||'')==='取消'&&visible(el))||[...dialog.querySelectorAll('.weui-desktop-dialog__close-btn')].find(el=>el.getBoundingClientRect().width>0);if(!button)return {ok:false,reason:'wechat cover recovery button missing'};button.click();return {ok:true,dismissed:true}})()`);
  if(!dismissed.ok)return dismissed;
  for(let i=0;i<12;i+=1){await activateWechatLifecycle();const active=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];return roots.flatMap(root=>[...root.querySelectorAll('.edit-cover-dialog .weui-desktop-dialog__wrp')]).some(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0})})()`);if(!active)return dismissed;await wait(1)}
  return {ok:false,reason:'wechat cover editor recovery did not close'};
}

async function uploadWechatCover(asset){
  if(!wechatCustomCover)return {ok:true,skipped:true};
  await activateWechatLifecycle();
  const before=(await inspectWechatChannels()).gates.cover.evidence?.urlsBySlot?.[asset.slot]||[];
  const opened=await js(String.raw`((selector) => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const entry=roots.flatMap(root=>[...root.querySelectorAll(selector+' .edit-btn')]).find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>4&&r.height>4&&s.display!=='none'&&s.visibility!=='hidden'});if(!entry)return {ok:false,reason:'wechat cover edit entry missing'};entry.click();return {ok:true}})(${JSON.stringify(asset.wrap)})`);
  if(!opened.ok)return opened;
  await wait(2);
  await activateWechatLifecycle();
  const evaluated=await cdp('Runtime.evaluate',{expression:String.raw`((title) => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};const dialog=roots.flatMap(root=>[...root.querySelectorAll('.edit-cover-dialog .weui-desktop-dialog__wrp')]).find(el=>visible(el)&&String(el.innerText||el.textContent||'').includes(title));return dialog?.querySelector('input[type=file][accept*="image"]')||roots.flatMap(root=>[...root.querySelectorAll('input[type=file]')]).find(el=>/image|png|jpe?g/i.test(el.accept||''))})(${JSON.stringify(asset.dialogTitle)})`,objectGroup:'video-publisher-v2-wechat-cover',includeCommandLineAPI:true});
  const objectId=evaluated?.result?.objectId;
  if(!objectId)return {ok:false,reason:'wechat cover image input objectId missing'};
  try{await cdp('DOM.setFileInputFiles',{objectId,files:[asset.path]})}catch(error){return {ok:false,reason:String(error?.message||error)}}
  let previewReady=false;
  for(let i=0;i<20;i+=1){await activateWechatLifecycle();previewReady=await js(String.raw`(() => {const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];return roots.flatMap(root=>[...root.querySelectorAll('.single-cover-uploader-wrap img')]).some(el=>/^(data:|blob:|https?:)/.test(el.currentSrc||el.src||''))})()`);if(previewReady)break;await wait(1)}
  if(!previewReady)return {ok:false,reason:'wechat custom cover preview did not become ready'};
  let confirmed={ok:false,reason:'wechat cover confirm missing or disabled'};
  for(let i=0;i<20;i+=1){await activateWechatLifecycle();confirmed=await js(String.raw`((title) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0};const material=roots.flatMap(root=>[...root.querySelectorAll('button,[role="button"]')]).find(el=>compact(el.innerText||el.textContent||'')==='使用素材'&&visible(el)&&!el.disabled);if(material){material.click();return {ok:false,waiting:true,materialConfirmed:true}}const dialogs=roots.flatMap(root=>[...root.querySelectorAll('.edit-cover-dialog .weui-desktop-dialog__wrp')]).filter(visible);const crop=dialogs.find(el=>/裁剪封面图/.test(el.innerText||el.textContent||''));if(crop){const cropButton=[...crop.querySelectorAll('button,[role="button"]')].find(el=>compact(el.innerText||el.textContent||'')==='确定'&&visible(el)&&!el.disabled);if(cropButton){cropButton.click();return {ok:false,waiting:true,cropConfirmed:true}}}const dialog=dialogs.find(el=>String(el.innerText||el.textContent||'').includes(title));const button=[...(dialog?.querySelectorAll('button,[role="button"]')||[])].find(el=>compact(el.innerText||el.textContent||'')==='确认'&&visible(el)&&!el.disabled&&!/disabled/.test(String(el.className||'')));if(!button)return {ok:false,waiting:true,reason:'wechat cover confirm not visible yet'};button.click();return {ok:true}})(${JSON.stringify(asset.dialogTitle)})`);if(confirmed.ok)break;await wait(1)}
  if(!confirmed.ok)return {ok:false,reason:confirmed.reason||'wechat cover confirm missing or disabled'};
  let after=[];let dialogClosed=false;
  for(let i=0;i<30;i+=1){await activateWechatLifecycle();const state=await inspectWechatChannels();after=state.gates.cover.evidence?.urlsBySlot?.[asset.slot]||[];dialogClosed=state.gates.noBlockingDialog.ok;if(after.some(url=>!before.includes(url))&&dialogClosed)break;await wait(1)}
  const afterUrl=after.find(url=>!before.includes(url));
  if(!afterUrl)return {ok:false,reason:`wechat ${asset.slot} cover card did not change`,before,after};
  if(!dialogClosed)return {ok:false,reason:'wechat vertical cover confirmation dialog did not close',before,after};
  return {ok:true,receipt:{assetPath:asset.path,ratio:asset.ratio,beforeUrls:before,afterUrl}};
}

async function mutateWechatChannels(){
  let before=await inspectWechatChannels();
  if(!before.gates.video.ok)return {...before,blocker:typedBlocker('STATE_AMBIGUOUS','视频号没有可修复的已上传视频')};
  const actions={};
  const productDialogActive=wechatLink.type==='product'&&before.gates.noBlockingDialog.evidence?.active?.some(item=>/从橱窗添加商品|选择商品出现时机/.test(item.text||''));
  if(!before.gates.noBlockingDialog.ok&&before.gates.noBlockingDialog.evidence?.active?.some(item=>/编辑个人主页卡片|编辑分享卡片|裁剪封面图/.test(item.text||''))){
    actions.coverRecovery=await dismissWechatCoverEditor();
    if(!actions.coverRecovery.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('STATE_AMBIGUOUS',actions.coverRecovery.reason,{retryable:true,evidence:actions.coverRecovery})};
    before=await inspectWechatChannels();
  }
  if(!before.gates.noBlockingDialog.ok&&!productDialogActive)return {...before,blocker:typedBlocker('STATE_AMBIGUOUS','视频号存在未识别的阻塞弹窗',{retryable:true,evidence:before.gates.noBlockingDialog.evidence})};
  if(!before.gates.description.ok||!before.gates.shortTitle.ok){actions.textFields=await setWechatTextFields({description:!before.gates.description.ok,shortTitle:!before.gates.shortTitle.ok});if(!actions.textFields.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.textFields.reason||'视频号描述或短标题没有写入',{evidence:actions.textFields})}}
  actions.activity=publishProfile==='fast'?{ok:true,skipped:true}:await ensureWechatNoActivity(before.gates.activity);
  if(!actions.activity.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.activity.reason||'视频号活动状态没有设为不参与',{evidence:actions.activity})};
  actions.schedule=await ensureWechatSchedule(before.gates.schedule);
  if(!actions.schedule.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.schedule.reason||'视频号定时发表设置没有完成',{evidence:actions.schedule})};
  actions.aiLabel=await ensureWechatAiLabel(before.gates.aiLabel);
  if(!actions.aiLabel.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.aiLabel.reason||'视频号视频标注没有完成',{evidence:actions.aiLabel})};
  actions.productLink=await ensureWechatProductLink(before.gates.productLink);
  if(!actions.productLink.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.productLink.reason||'视频号商品链接没有完成',{evidence:actions.productLink})};
  actions.original=await ensureWechatOriginalPolicy(before.gates.original);
  if(!actions.original.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',actions.original.reason||'视频号原创状态没有完成',{evidence:actions.original})};
  const receipts={};
  if(wechatCustomCover){
    receipts.cover={slots:{}};
    for(const asset of wechatCoverAssets){
      const uploaded=await uploadWechatCover(asset);
      (actions.covers||=[]).push({asset,...uploaded});
      if(!uploaded.ok)return {...(await inspectWechatChannels()),blocker:typedBlocker('PLATFORM_REJECTED_ASSET',uploaded.reason,{retryable:true,evidence:uploaded})};
      receipts.cover.slots[asset.slot]=uploaded.receipt;
      actions.receiptCheckpoint=checkpointReceipts(receipts);
    }
    expectedReceipts.cover=receipts.cover;
  }
  actions.receiptCheckpoint=checkpointReceipts(receipts);
  const after=await inspectWechatChannels();
  return {...after,actions,receipts};
}

async function prepareWechatChannels(){
  const actions={};
  actions.uploadStart=await startWechatUpload();
  if(actions.uploadStart.blocker)return actions.uploadStart;
  actions.prefill=await prefillWechatChannels();
  if(actions.prefill.blocker)return actions.prefill;
  if(!actions.prefill.gates.video.ok){
    actions.uploadWait=await waitWechatUploadOnly();
    if(actions.uploadWait.blocker)return actions.uploadWait;
  }
  const repaired=await mutateWechatChannels();
  return {...repaired,actions:{...actions,...(repaired.actions||{})}};
}

async function probeWechatPublishResult(){return await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'};const exact=roots.flatMap(root=>[...root.querySelectorAll('div,span,p')]).filter(visible).map(el=>compact(el.innerText||el.textContent||'')).filter(text=>/^(已发表|发表成功|发布成功|已提交|定时发表成功)$/.test(text));const errors=roots.flatMap(root=>[...root.querySelectorAll('div,span,p')]).filter(visible).map(el=>compact(el.innerText||el.textContent||'')).filter(text=>/发表失败|发布失败|提交失败|网络错误/.test(text)).slice(0,5);const dialogs=roots.flatMap(root=>[...root.querySelectorAll('[role="dialog"],.weui-desktop-dialog__wrp')]).filter(visible).map(el=>({text:compact(el.innerText||el.textContent||'').slice(0,800),buttons:[...el.querySelectorAll('button,[role="button"]')].filter(visible).map(button=>{const r=button.getBoundingClientRect();return {text:compact(button.innerText||button.textContent||''),disabled:Boolean(button.disabled),x:r.left+r.width/2,y:r.top+r.height/2}})}));return {confirmed:exact.length>0,signals:[...new Set(exact)],errors,dialogs,url:location.href}})()`)}

async function publishWechatChannels(){
  const before=await inspectWechatChannels();
  const existing=await probeWechatPublishResult();
  if(existing.confirmed)return {...before,published:true,finalPublishClicked:false,publishReceipt:{confirmed:true,alreadyPublished:true,signals:existing.signals,url:existing.url,at:new Date().toISOString()}};
  const originalityUpsell=existing.dialogs.find(item=>/声明原创的视频/.test(item.text));
  const required=publishProfile==='fast'?['authenticated','draftIdentity','video','description','shortTitle','schedule','aiLabel','productLink','original','noBlockingDialog','finalButton']:Object.keys(before.gates);
  const missing=required.filter(name=>before.gates[name]?.ok!==true&&!(name==='noBlockingDialog'&&originalityUpsell));
  if(missing.length)return {...before,blocker:typedBlocker('STATE_AMBIGUOUS','视频号没有通过发表前全部页面条件',{evidence:{missing}})};
  const authorization=await authorizeFinalPublishGuard();
  if(!authorization.ok)return {...before,blocker:typedBlocker('ACTION_FAILED',authorization.reason,{evidence:authorization})};
  let confirmationClicked=false;
  if(originalityUpsell){const expectedButton=wechatOriginal?'声明原创':'直接发表';const button=originalityUpsell.buttons.find(item=>item.text===expectedButton&&!item.disabled);if(!button)return {...before,blocker:typedBlocker('SELECTOR_DRIFT','wechat originality upsell action missing',{evidence:{expectedButton,originalityUpsell}})};await click([button.x,button.y],{label:expectedButton==='直接发表'?'confirm direct WeChat publish':'confirm original WeChat publish'});confirmationClicked=true}else{const target=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const roots=[document,...[...document.querySelectorAll('*')].map(el=>el.shadowRoot).filter(Boolean)];const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>20&&r.height>20&&s.display!=='none'&&s.visibility!=='hidden'};const el=roots.flatMap(root=>[...root.querySelectorAll('button,[role="button"],.weui-desktop-btn')]).find(el=>visible(el)&&compact(el.innerText||el.textContent||'')==='发表'&&!el.disabled);if(!el)return {ok:false,reason:'wechat ready publish button missing'};el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!target.ok)return {...before,blocker:typedBlocker('SELECTOR_DRIFT',target.reason,{evidence:target})};await click([target.x,target.y],{label:'publish verified WeChat video'});}
  for(let attempt=0;attempt<24;attempt+=1){
    await wait(.5);
    const probe=await probeWechatPublishResult();
    if(probe.confirmed)return {...before,published:true,finalPublishClicked:true,publishReceipt:{confirmed:true,alreadyPublished:false,confirmationClicked,signals:probe.signals,url:probe.url,at:new Date().toISOString()}};
    if(probe.errors.length)return {...before,finalPublishClicked:true,blocker:typedBlocker('ACTION_FAILED','视频号返回发表失败',{evidence:probe})};
    if(!confirmationClicked){const dialog=probe.dialogs.find(item=>/发布|发表|提交|声明原创的视频/.test(item.text));const expectedButton=/声明原创的视频/.test(dialog?.text||'')?(wechatOriginal?'声明原创':'直接发表'):null;const button=dialog?.buttons.find(item=>(expectedButton?item.text===expectedButton:/^(确认|确定|发表|确认发表)$/.test(item.text))&&!item.disabled);if(button){await click([button.x,button.y],{label:expectedButton==='直接发表'?'confirm direct WeChat publish':'confirm verified WeChat publish'});confirmationClicked=true}}
  }
  const after=await probeWechatPublishResult();
  return {...before,finalPublishClicked:true,blocker:typedBlocker('STATE_AMBIGUOUS','视频号点击发表后没有出现成功证据',{retryable:true,evidence:after})};
}

async function runPlatformPhase(){if(phase==='inspect'||phase==='verify')return await inspectWechatChannels();if(phase==='prepare')return await prepareWechatChannels();if(phase==='inject')return await startWechatUpload();if(phase==='prefill')return await prefillWechatChannels();if(phase==='wait_upload')return await waitWechatUploadOnly();if(phase==='upload')return await uploadWechatChannels();if(phase==='mutate')return await mutateWechatChannels();if(phase==='publish')return await publishWechatChannels();return {...(await inspectWechatChannels()),blocker:typedBlocker('ACTION_FAILED',`unsupported WeChat phase: ${phase}`)}}
