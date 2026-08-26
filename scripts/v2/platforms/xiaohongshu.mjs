const xhsTitle = pkg.platformTitle.xiaohongshu;
const xhsDescription = pkg.xhsDescription;
const xhsTopics = pkg.xhsTopics;
const xhsOriginal = pkg.xhsOriginal === true;
const xhsAiGenerated = pkg.xhsAiGenerated === true;
const xhsPublish = pkg.xhsPublish;
const xhsExpectedContentType = xhsAiGenerated ? '笔记含AI合成内容' : '添加内容类型声明';
const xhsVideoName = videoPath.split('/').pop();
const xhsCustomCover = pkg.cover?.uploadCustomCover === true;
const xhsCoverPath = String(pkg.cover?.vertical3x4Path || '');

async function inspectXiaohongshu() {
  const state = await js(String.raw`((expectedName, expectedTitle, expectedDescription, requestedTopics, expectedContentType) => {
    const compact = value => String(value || '').replace(/\s+/g, ' ').trim()
    const text = compact(document.body.innerText || '')
    const titleInput = [...document.querySelectorAll('input')]
      .find(el => (el.placeholder || '').includes('填写标题'))
    const title = String(titleInput?.value || '').trim()
    const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')]
    const editor = editors.find(el => el.querySelector('a') || /话题|creator-editor/i.test(String(el.className || ''))) || editors[0]
    const editorText = compact(editor?.innerText || editor?.textContent || '')
    const anchorNames = [...(editor?.querySelectorAll('a') || [])].map(el => {
      try { return String(JSON.parse(el.getAttribute('data-topic') || '{}').name || '').trim() }
      catch { return compact(el.innerText || el.textContent || '').replace(/^#|\[话题\]#.*$/g, '') }
    }).filter(Boolean)
    const plainClone = editor?.cloneNode(true)
    plainClone?.querySelectorAll('a').forEach(el => el.remove())
    const plainText = compact(plainClone?.innerText || plainClone?.textContent || '')
    const topicCounts = Object.fromEntries(requestedTopics.map(tag => {
      const normalized = String(tag).replace(/\s+/g, '').toLowerCase()
      const count = anchorNames.filter(value => String(value).replace(/\s+/g, '').toLowerCase() === normalized).length
      return [tag, count]
    }))
    const selected = requestedTopics.filter(tag => topicCounts[tag] === 1)
    const plainCompact = plainText.replace(/\s+/g, '').toLowerCase()
    const plainResidue = requestedTopics.filter(tag => plainCompact.includes('#' + String(tag).replace(/\s+/g, '').toLowerCase()))
    const duplicate = requestedTopics.filter(tag => topicCounts[tag] > 1)
    const originalLabels = [...document.querySelectorAll('div,section,label,span')]
      .filter(el => compact(el.innerText || el.textContent || '') === '原创声明')
      .sort((a,b) => { const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(); return ar.width*ar.height-br.width*br.height })
    const originalLabel = originalLabels[0] || null
    const originalAncestors = []; for(let el=originalLabel;el&&originalAncestors.length<8;el=el.parentElement)originalAncestors.push(el)
    const originalSelectors = '.custom-switch-switch, .d-switch, [role="switch"], input[type="checkbox"]'
    const originalRow = originalAncestors.find(el => el.matches?.(originalSelectors) || el.querySelector?.(originalSelectors))
      || originalAncestors.find(el => { const s=getComputedStyle(el); return compact(el.innerText||el.textContent||'')==='原创声明' && (parseFloat(s.borderRadius)>0 || s.backgroundColor!=='rgba(0, 0, 0, 0)') })
      || originalLabel?.parentElement
    const originalSwitch = (originalRow?.matches?.(originalSelectors) ? originalRow : originalRow?.querySelector(originalSelectors))
      || [...document.querySelectorAll('.custom-switch-switch, .d-switch, [role="switch"]')]
        .find(el => /原创声明/.test(el.parentElement?.parentElement?.innerText || ''))
    const simulator = originalSwitch?.querySelector?.('.d-switch-simulator') || originalSwitch?.parentElement?.querySelector?.('.d-switch-simulator')
    const originalEnabled = Boolean(originalSwitch && (
      originalSwitch.checked === true
      || originalSwitch.getAttribute?.('aria-checked') === 'true'
      || originalSwitch.getAttribute?.('data-state') === 'checked'
      || originalSwitch.classList?.contains('checked')
      || simulator?.classList?.contains('checked')
    ))
    const switchState = labelText => {
      const label=[...document.querySelectorAll('div,span,label')].filter(el=>compact(el.innerText||el.textContent||'')===labelText).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})[0]
      const row=label?.closest('.custom-switch-wrapper')||label?.parentElement?.parentElement
      const sim=row?.querySelector('.d-switch-simulator');const input=sim?.querySelector('input[type="checkbox"]')||row?.querySelector('input[type="checkbox"]')
      return {found:Boolean(row&&sim),enabled:Boolean(input?.checked||sim?.classList.contains('checked')),className:String(sim?.className||''),rowText:compact(row?.innerText||row?.textContent||'')}
    }
    const pkCover=switchState('PK封面');const schedule=switchState('定时发布')
    const declaration=document.querySelector('.declaration-wrapper,.custom-select-44[lass="declaration-wrapper"]')||[...document.querySelectorAll('.d-select-wrapper')].find(el=>/内容类型声明|AI合成内容|虚构演绎|营销广告|内容来源声明/.test(compact(el.innerText||el.textContent||'')))
    const contentType=compact(declaration?.querySelector('.d-select-content')?.innerText||declaration?.innerText||declaration?.textContent||'')
    const visibility=compact(document.querySelector('.permission-card-select .d-select-content')?.innerText||document.querySelector('.permission-card-select')?.innerText||'')
    const scheduleInput=document.querySelector('.date-picker-container input.d-text,.custom-date-picker-44 input.d-text')
    const scheduleAt=String(scheduleInput?.value||'').trim()
    const chapterDefault=Boolean([...document.querySelectorAll('.chapter-container')].find(el=>/添加章节/.test(compact(el.innerText||el.textContent||''))))
    const collectionDefault=Boolean([...document.querySelectorAll('.collection-plugin-wrapper')].find(el=>/选择合集/.test(compact(el.innerText||el.textContent||''))))
    const locationDefault=Boolean([...document.querySelectorAll('.address-card-select .d-select-placeholder')].find(el=>compact(el.innerText||el.textContent||'')==='添加地点'))
    const groupDefault=Boolean([...document.querySelectorAll('.group-card-select .d-select-placeholder')].find(el=>compact(el.innerText||el.textContent||'')==='选择群聊'))
    const componentDefaults=['引用笔记','关联直播预告','标记地点或标记朋友','添加路线'].every(label=>[...document.querySelectorAll('div,span')].some(el=>compact(el.innerText||el.textContent||'')===label))
    const activityButtons=[...document.querySelectorAll('button')].filter(el=>el.closest('.publish-page-content-content-extra')&&compact(el.innerText||el.textContent||'')==='关联')
    const activityNone=activityButtons.length>0&&![...document.querySelectorAll('.publish-page-content-content-extra button')].some(el=>/已关联|取消关联/.test(compact(el.innerText||el.textContent||'')))
    const activeDialogs = [...document.querySelectorAll('.d-modal-mask, [role="dialog"], [class*="modal-mask"]')]
      .map(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { text: compact(el.innerText || el.textContent || ''), cls: String(el.className || ''), width: r.width, height: r.height, opacity: s.opacity, display: s.display, visibility: s.visibility } })
      .filter(item => item.width > 20 && item.height > 20 && item.display !== 'none' && item.visibility !== 'hidden')
      .filter(item => !(/leave-active/.test(item.cls) && Number(item.opacity) === 0))
    const cover = document.querySelector('.cover-plugin-preview .default.row, .cover-plugin-preview .default.column')
    const coverBg = cover ? getComputedStyle(cover).backgroundImage : ''
    const filenameVisible = text.includes(expectedName) || text.includes(expectedName.replace(/\.[^.]+$/, ''))
    const uploaded = filenameVisible && /重新上传|上传完成|检测为高清视频/.test(text)
    const uploading = /封面上传中|视频上传中|取消上传|剩余时间|当前速度|处理中/.test(text)
    const failed = /上传失败|网络错误|重新上传失败/.test(text)
    const loginRequired = /扫码登录|请登录|登录后|安全验证|验证码/.test(text) && !/发布笔记|内容设置/.test(text)
    return { text: text.slice(0, 3200), title, editorText, plainText, selected, topicCounts, plainResidue, duplicate, originalEnabled, pkCover, contentType, visibility, schedule, scheduleAt, defaults:{chapterDefault,collectionDefault,locationDefault,groupDefault,componentDefaults,activityNone}, activeDialogs, coverBg, filenameVisible, uploaded, uploading, failed, loginRequired }
  })(${JSON.stringify(xhsVideoName)}, ${JSON.stringify(xhsTitle)}, ${JSON.stringify(xhsDescription)}, ${JSON.stringify(xhsTopics)}, ${JSON.stringify(xhsExpectedContentType)})`);
  const buttons = await inspectFinalButtons(/^(发布|发布笔记)$/);
  const semanticSnapshot=await snapshotText().catch(()=>"");
  const semanticFinalMatch=String(semanticSnapshot).match(/button \[ref=(\d+)[^\]]*\]\s*\n\s*text "(发布|定时发布)"/);
  const identityOk = !state.uploaded || state.filenameVisible || state.title === xhsTitle;
  const receipt = expectedReceipts.cover || null;
  const receiptMatches = Boolean(receipt
    && receipt.assetPath === xhsCoverPath
    && receipt.ratio === '3:4'
    && receipt.afterUrl
    && state.coverBg.includes(receipt.afterUrl));
  const coverOk = xhsCustomCover
    ? receiptMatches && !state.uploading
    : Boolean(state.coverBg) && !state.uploading;
  const finalButton = semanticFinalMatch
    ? {text:semanticFinalMatch[2],ref:Number(semanticFinalMatch[1]),buttonish:true,disabled:false,semantic:true}
    : buttons.find(button => button.buttonish&&button.text!=='发布笔记') || null;
  return {
    gates: {
      authenticated: state.loginRequired ? failedGate({ loginRequired: true }) : okGate({ url: PLATFORM_URLS.xiaohongshu }),
      draftIdentity: identityOk ? okGate({ expectedName: xhsVideoName, filenameVisible: state.filenameVisible }) : failedGate({ foreign: true, expectedName: xhsVideoName, actualTitle: state.title }),
      video: state.uploaded && !state.failed && !state.uploading
        ? okGate({ filename: xhsVideoName, stable: true })
        : failedGate({ filename: xhsVideoName, uploaded: state.uploaded, uploading: state.uploading, failed: state.failed }),
      title: state.title === xhsTitle ? okGate({ expected: xhsTitle, actual: state.title }) : failedGate({ expected: xhsTitle, actual: state.title }),
      description: state.plainText === compactText(xhsDescription) ? okGate({ expected: xhsDescription, actual: state.plainText }) : failedGate({ expected: xhsDescription, actual: state.plainText }),
      tags: state.selected.length === xhsTopics.length && !state.plainResidue.length && !state.duplicate.length
        ? okGate({ requested: xhsTopics, selected: state.selected, topicCounts: state.topicCounts })
        : failedGate({ requested: xhsTopics, selected: state.selected, plainResidue: state.plainResidue, duplicate: state.duplicate, topicCounts: state.topicCounts }),
      original: xhsOriginal
        ? (state.originalEnabled ? okGate({ expected: true, enabled: true }) : failedGate({ expected: true, enabled: false }))
        : (!state.originalEnabled ? okGate({ expected: false, enabled: false }) : failedGate({ expected: false, enabled: true })),
      pkCover: !state.pkCover.enabled ? okGate({ expected: false, ...state.pkCover }) : failedGate({ expected: false, ...state.pkCover }),
      contentType: state.contentType === xhsExpectedContentType ? okGate({ expected: xhsExpectedContentType, actual: state.contentType }) : failedGate({ expected: xhsExpectedContentType, actual: state.contentType }),
      defaults: Object.values(state.defaults).every(Boolean) ? okGate(state.defaults) : failedGate(state.defaults),
      visibility: state.visibility === '公开可见' ? okGate({ expected: '公开可见', actual: state.visibility }) : failedGate({ expected: '公开可见', actual: state.visibility }),
      schedule: state.schedule.enabled === (xhsPublish.mode==='scheduled') && (xhsPublish.mode!=='scheduled'||state.scheduleAt===xhsPublish.publishAt)
        ? okGate({ expected: xhsPublish, actual:{mode:state.schedule.enabled?'scheduled':'immediate',publishAt:state.scheduleAt} })
        : failedGate({ expected: xhsPublish, actual:{mode:state.schedule.enabled?'scheduled':'immediate',publishAt:state.scheduleAt},switch:state.schedule }),
      cover: coverOk
        ? okGate({ custom: xhsCustomCover, background: state.coverBg, receipt })
        : failedGate({ custom: xhsCustomCover, background: state.coverBg, receipt, reason: xhsCustomCover && !receipt ? 'custom cover receipt missing' : 'cover not verified' }),
      noBlockingDialog: state.activeDialogs.length === 0 ? okGate({ active: [] }) : failedGate({ active: state.activeDialogs }),
      finalButton: finalButton && !finalButton.disabled ? okGate(finalButton) : failedGate({ buttons }),
    },
    evidence: { pageSample: state.text },
  };
}

async function waitXiaohongshuUploadCompletion(mode) {
  let stableSince = 0;
  for (let index = 0; index < 180; index += 1) {
    const current = await inspectXiaohongshu();
    const uploaded = current.gates.video.evidence?.uploaded || current.gates.video.ok;
    const uploading = current.gates.video.evidence?.uploading === true;
    if (uploaded && !uploading) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= 10000) return { ...current, actions: { upload: { mode } } };
    } else {
      stableSince = 0;
    }
    await wait(5);
  }
  const after = await inspectXiaohongshu();
  return { ...after, actions: { upload: { mode } }, blocker: typedBlocker('UPLOAD_STALLED', '小红书视频没有在等待窗口内稳定完成', { retryable: true, evidence: after.gates.video.evidence }) };
}

async function uploadXiaohongshu() {
  const before = await inspectXiaohongshu();
  if (before.gates.video.ok) return { ...before, actions: { upload: { mode: 'already_ready' } } };
  if (!before.gates.draftIdentity.ok) {
    return { ...before, blocker: typedBlocker('FOREIGN_DRAFT', '小红书当前编辑器属于其他视频草稿', { evidence: before.gates.draftIdentity.evidence }) };
  }
  if (before.gates.video.evidence?.uploading === true) {
    return await waitXiaohongshuUploadCompletion('resume_existing');
  }
  const exposed = await js(String.raw`(() => {
    const videoLike = value => /video|\.(mp4|mov|flv|f4v|mkv|rmvb?|m4v|mpg|mpeg|ts)\b/i.test(value || '')
    const input = [...document.querySelectorAll('input[type=file]')].find(el => videoLike(el.accept))
    if (!input) return { ok: false, reason: 'xiaohongshu video input missing' }
    input.id = 'vp2-xhs-video'
    return { ok: true, selector: '#vp2-xhs-video', accept: input.accept || '' }
  })()`);
  if (!exposed.ok) return { ...before, blocker: typedBlocker('SELECTOR_DRIFT', exposed.reason) };
  try {
    await uploadFile(exposed.selector, videoPath);
  } catch (error) {
    return { ...before, blocker: typedBlocker('UPLOAD_NOT_STARTED', `小红书文件注入失败: ${String(error?.message || error)}`, { retryable: true }) };
  }
  return await waitXiaohongshuUploadCompletion('injected');
}

async function activateXhsTopicLifecycle() {
  await cdp('Page.bringToFront', {}).catch(() => {});
  await cdp('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await wait(.35);
  const state=await js(String.raw`(() => ({visibility:document.visibilityState,hasFocus:document.hasFocus()}))()`);
  return state.visibility==='visible'&&state.hasFocus
    ? {ok:true,...state}
    : {ok:false,reason:'xiaohongshu topic page did not become visible and focused',...state};
}

async function rebuildXhsTopics() {
  const attempts=[];
  for(let rebuildAttempt=1;rebuildAttempt<=3;rebuildAttempt+=1){
    const lifecycle=await activateXhsTopicLifecycle();
    if(!lifecycle.ok)return {...lifecycle,attempts};
    const cleared = await js(String.raw`(() => {
      const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')]
      const editor = editors.find(el => el.querySelector('a') || /话题|creator-editor/i.test(String(el.className || ''))) || editors[0]
      if (!editor) return { ok: false, reason: 'xiaohongshu topic editor missing' }
      editor.focus()
      const selection = window.getSelection(); const range = document.createRange()
      range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range)
      document.execCommand('delete', false)
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }))
      return { ok: String(editor.innerText || editor.textContent || '').replace(/[\s\u200b]/g, '') === '' }
    })()`);
    if (!cleared.ok) return {...cleared,attempts};
    if(xhsDescription){
      await cdp('Input.insertText',{text:xhsDescription});
      await pressKey('Enter');
      await pressKey('Enter');
      const prose=await js(String.raw`((expected) => {const editors=[...document.querySelectorAll('[contenteditable="true"],[contenteditable=""]')];const editor=editors.find(el=>/话题|creator-editor/i.test(String(el.className||'')))||editors[0];const text=String(editor?.innerText||editor?.textContent||'').replace(/\s+/g,' ').trim();return {ok:text===String(expected).replace(/\s+/g,' ').trim(),actual:text}})(${JSON.stringify(xhsDescription)})`);
      if(!prose.ok)return {ok:false,reason:'xiaohongshu description did not persist before topics',prose,attempts};
    }
    if(rebuildAttempt>1)await wait(1.5*rebuildAttempt);
    let failure=null;
    for (const tag of xhsTopics) {
    const queryTag = String(tag).replace(/\s+/g, '');
    const started = await js(String.raw`(() => {
      const editors = [...document.querySelectorAll('[contenteditable="true"], [contenteditable=""]')]
      const editor = editors.find(el => /话题|creator-editor/i.test(String(el.className || ''))) || editors[0]
      if (!editor) return { ok: false, reason: 'xiaohongshu topic editor lost focus' }
      const topicButton = document.querySelector('button.contentBtn.topic-btn, #topicBtn')
      if (!topicButton) return { ok: false, reason: 'xiaohongshu native topic button missing' }
      // The sticky publish footer can visually cover this toolbar near the viewport
      // bottom, so a real pointer click may land on the footer. Calling the native
      // Vue click handler still uses the site's own editor command to begin a topic.
      topicButton.click()
      editor.focus(); const selection = window.getSelection(); const range = document.createRange()
      range.selectNodeContents(editor); range.collapse(false); selection.removeAllRanges(); selection.addRange(range)
      const text = String(editor.innerText || editor.textContent || '')
      return { ok: document.activeElement === editor && text.trimEnd().endsWith('#'), active: document.activeElement === editor, text }
    })()`);
    if (!started.ok) { failure={ ...started, reason: started.reason || 'xiaohongshu native topic entry did not start',tag }; break; }
    await cdp('Input.insertText', { text: queryTag });
    await wait(1.2);
    const typed=await js(String.raw`((tag) => {const editors=[...document.querySelectorAll('[contenteditable="true"],[contenteditable=""]')];const editor=editors.find(el=>/话题|creator-editor/i.test(String(el.className||'')))||editors[0];const text=String(editor?.innerText||editor?.textContent||'').replace(/\u200b/g,'').trimEnd();return {ok:text.replace(/\s+/g,'').toLowerCase().endsWith(('#'+String(tag)).toLowerCase()),text}})(${JSON.stringify(queryTag)})`);
    if(!typed.ok){failure={ok:false,reason:'xiaohongshu topic query did not persist exactly',tag,typed};break;}
    let clicked = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      clicked = await js(String.raw`((tag) => {
      const compact = value => String(value || '').replace(/\s+/g, ' ').trim()
      const normalize = value => String(value || '').replace(/\s+/g, '').toLowerCase()
      const tagLower = normalize(tag)
      const scopes = [...document.querySelectorAll('#creator-editor-topic-container, [data-tippy-root], .tippy-box, .tippy-content')]
      const rows = scopes.flatMap(scope => [...scope.querySelectorAll('.item, [role="option"], div, li')])
        .map(el => ({ el, text: compact(el.querySelector('.name')?.innerText || el.innerText || el.textContent || ''), rect: el.getBoundingClientRect() }))
        .filter(item => item.rect.width > 20 && item.rect.height > 10 && item.rect.height < 100)
        .map(item => {const match=item.text.match(/(?:\[话题\]\s*)?#([^\s#]+)/)||item.text.match(/^([^\s#]+)/);return {...item,topic:normalize(match?.[1]||'')}})
        .filter(item => item.topic === tagLower)
        .sort((a, b) => (a.rect.width*a.rect.height)-(b.rect.width*b.rect.height) || a.text.length-b.text.length)
      const row = rows[0]
      if (!row) return { ok: false, reason: 'exact topic suggestion missing', tag, visible: scopes.flatMap(scope=>[...scope.querySelectorAll('.item,[role="option"],li')]).map(el=>compact(el.innerText||el.textContent||'')).filter(Boolean).slice(0,12) }
      row.el.click(); return { ok: true, text: row.text }
    })(${JSON.stringify(queryTag)})`);
      if (clicked.ok) break;
      await wait(0.75);
    }
    if (!clicked.ok) { failure={...clicked,tag}; break; }
    await wait(1.2);
    const committed = await js(String.raw`((tag) => [...document.querySelectorAll('[contenteditable] a')]
      .some(el => {let name='';try{name=JSON.parse(el.getAttribute('data-topic')||'{}').name||''}catch{};if(!name)name=String(el.innerText||el.textContent||'').replace(/^#|\[话题\]#.*$/g,'');return name.replace(/\s+/g,'').toLowerCase()===String(tag).replace(/\s+/g,'').toLowerCase()}))(${JSON.stringify(tag)})`);
    if (!committed) { failure={ ok: false, reason: 'topic entity did not commit', tag }; break; }
    await cdp('Input.insertText', { text: ' ' });
    }
    if(!failure){
      const verified=await inspectXiaohongshu();
      if(verified.gates.description.ok&&verified.gates.tags.ok)return {ok:true,rebuildAttempt,attempts:[...attempts,{rebuildAttempt,result:'committed'}]};
      failure={ok:false,reason:'xiaohongshu description and topic entities did not pass exact post-build verification',evidence:{description:verified.gates.description.evidence,tags:verified.gates.tags.evidence}};
    }
    attempts.push({rebuildAttempt,...failure});
    if(rebuildAttempt<3)await wait(2*rebuildAttempt);
  }
  const last=attempts.at(-1)||{};
  return {ok:false,reason:'xiaohongshu exact topics did not commit after bounded whole-set rebuilds',lastFailure:last,attempts};
}

async function ensureXhsOriginalPolicy() {
  await removeExactStaleMask(/笔记完成原创声明后|原创声明须知|声明原创/);
  let inspected = await inspectXiaohongshu();
  if (inspected.gates.original.ok) return { ok: true, already: true };
  const control = await js(String.raw`(() => {
    const compact = value => String(value || '').replace(/\s+/g, ' ').trim()
    const labels = [...document.querySelectorAll('div,section,label,span')].filter(el => compact(el.innerText || el.textContent || '') === '原创声明').sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})
    const label=labels[0]||null;const ancestors=[];for(let el=label;el&&ancestors.length<8;el=el.parentElement)ancestors.push(el)
    const selectors='.custom-switch-switch, .d-switch, [role="switch"], input[type="checkbox"]'
    const row=ancestors.find(el=>el.matches?.(selectors)||el.querySelector?.(selectors))||ancestors.find(el=>{const s=getComputedStyle(el);return compact(el.innerText||el.textContent||'')==='原创声明'&&(parseFloat(s.borderRadius)>0||s.backgroundColor!=='rgba(0, 0, 0, 0)')})||label?.parentElement
    const target=(row?.matches?.(selectors)?row:row?.querySelector(selectors))||row
    if (!target) return { ok: false, reason: 'xiaohongshu original switch missing' }
    target.id='vp2-xhs-original-control';target.scrollIntoView({block:'center',inline:'center'});return {ok:true,selector:'#vp2-xhs-original-control',className:String(target.className||''),tag:target.tagName,role:target.getAttribute?.('role')||''}
  })()`);
  if (!control.ok) return control;
  await click(control.selector,{label:xhsOriginal?'enable xhs original declaration':'disable xhs original declaration'}).catch(()=>{});
  await wait(1.5);
  const modalResult = xhsOriginal ? await js(String.raw`(() => {
    const modal = [...document.querySelectorAll('.d-modal')].find(el => /笔记完成原创声明后|原创声明须知/.test(el.innerText || el.textContent || ''))
    if (!modal) return { ok: true, modal: false }
    const checkbox = modal.querySelector('.d-checkbox, input[type="checkbox"]')
    const input = modal.querySelector('input[type="checkbox"]')
    if (input && !input.checked) (checkbox || input).click()
    const button = [...modal.querySelectorAll('button')].find(el => String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() === '声明原创')
    if (!button || button.disabled) return { ok: false, reason: 'xiaohongshu original confirm disabled' }
    button.click(); return { ok: true, modal: true }
  })()`) : { ok: true, modal: false };
  await wait(2);
  await removeExactStaleMask(/笔记完成原创声明后|原创声明须知|声明原创/);
  inspected = await inspectXiaohongshu();
  return inspected.gates.original.ok ? { ok: true, control, modalResult } : { ok: false, reason: 'xiaohongshu original declaration state did not persist', control, modalResult };
}

async function locateXhsSwitch(labelText){return await js(String.raw`((labelText) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const label=[...document.querySelectorAll('div,span,label')].filter(el=>compact(el.innerText||el.textContent||'')===labelText).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})[0];const row=label?.closest('.custom-switch-wrapper')||label?.parentElement?.parentElement;const sim=row?.querySelector('.d-switch-simulator');const input=sim?.querySelector('input[type="checkbox"]')||row?.querySelector('input[type="checkbox"]');const el=row?.querySelector('.d-switch')||sim;if(!el||!sim)return {ok:false,reason:'xiaohongshu '+labelText+' switch missing'};el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return {ok:true,enabled:Boolean(input?.checked||sim.classList.contains('checked')),className:String(sim.className||''),x:r.left+r.width/2,y:r.top+r.height/2}})(${JSON.stringify(labelText)})`)}

async function ensureXhsPkCoverOff(){const before=await inspectXiaohongshu();if(before.gates.pkCover.ok)return {ok:true,already:true};const target=await locateXhsSwitch('PK封面');if(!target.ok)return target;if(!target.enabled)return {ok:true,already:true};await click([target.x,target.y],{label:'disable xhs PK cover'});await wait(1);const after=await inspectXiaohongshu();return {ok:after.gates.pkCover.ok,evidence:after.gates.pkCover.evidence}}

async function ensureXhsContentType(){
  const before=await inspectXiaohongshu();if(before.gates.contentType.ok)return {ok:true,already:true,evidence:before.gates.contentType.evidence};
  const opened=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const placeholder=[...document.querySelectorAll('.d-select-placeholder,.d-select-content')].find(el=>/内容类型声明|AI合成内容|虚构演绎|营销广告|内容来源声明/.test(compact(el.innerText||el.textContent||'')));const el=placeholder?.closest('.d-select-wrapper');if(!el)return {ok:false,reason:'xiaohongshu content declaration control missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!opened.ok)return opened;
  if(!xhsAiGenerated){const cleared=await js(String.raw`(() => {const wrapper=[...document.querySelectorAll('.d-select-wrapper')].find(el=>/内容类型声明|AI合成内容|虚构演绎|营销广告|内容来源声明/.test(el.innerText||el.textContent||''));const clear=wrapper?.querySelector('.d-select-clear,[class*="clear"]');if(!clear)return {ok:false,reason:'xiaohongshu content declaration cannot be safely cleared'};const r=clear.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!cleared.ok)return cleared;await click([cleared.x,cleared.y],{label:'clear xhs content declaration'});}else{await click([opened.x,opened.y],{label:'open xhs content declaration'});await wait(.75);const option=await js(String.raw`((label) => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=[...document.querySelectorAll('div,span')].filter(visible).filter(el=>compact(el.innerText||el.textContent||'')===label).sort((a,b)=>{const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return ar.width*ar.height-br.width*br.height})[0];if(!el)return {ok:false,reason:'xiaohongshu requested content declaration option missing'};const target=el.closest('.d-select-option,.custom-option,.d-grid-item')||el;const r=target.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})(${JSON.stringify(xhsExpectedContentType)})`);if(!option.ok)return option;await click([option.x,option.y],{label:'select xhs AI declaration'});}
  await wait(1);const after=await inspectXiaohongshu();return {ok:after.gates.contentType.ok,evidence:after.gates.contentType.evidence};
}

async function ensureXhsVisibility(){const before=await inspectXiaohongshu();if(before.gates.visibility.ok)return {ok:true,already:true};const control=await js(String.raw`(() => {const el=document.querySelector('.permission-card-select');if(!el)return {ok:false,reason:'xiaohongshu visibility control missing'};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!control.ok)return control;await click([control.x,control.y],{label:'open xhs visibility'});await wait(.5);const option=await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'};const el=[...document.querySelectorAll('.custom-option')].filter(visible).find(el=>compact(el.innerText||el.textContent||'')==='公开可见');if(!el)return {ok:false,reason:'xiaohongshu public visibility option missing'};const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!option.ok)return option;await click([option.x,option.y],{label:'select xhs public visibility'});await wait(1);const after=await inspectXiaohongshu();return {ok:after.gates.visibility.ok,evidence:after.gates.visibility.evidence}}

async function ensureXhsSchedule(){
  const before=await inspectXiaohongshu();if(before.gates.schedule.ok)return {ok:true,already:true,evidence:before.gates.schedule.evidence};
  const target=await locateXhsSwitch('定时发布');if(!target.ok)return target;const expectedEnabled=xhsPublish.mode==='scheduled';if(target.enabled!==expectedEnabled){await click([target.x,target.y],{label:expectedEnabled?'enable xhs scheduled publish':'disable xhs scheduled publish'});await wait(1)}
  if(expectedEnabled){const input=await js(String.raw`(() => {const el=document.querySelector('.date-picker-container input.d-text,.custom-date-picker-44 input.d-text');if(!el)return {ok:false,reason:'xiaohongshu scheduled datetime input missing'};el.scrollIntoView({block:'center'});el.focus();el.select();const r=el.getBoundingClientRect();return {ok:true,x:r.left+r.width/2,y:r.top+r.height/2}})()`);if(!input.ok)return input;await typeText(xhsPublish.publishAt);await pressKey('Enter').catch(()=>{});await js(String.raw`(() => {document.querySelector('.publish-page-content-settings-header')?.click();return true})()`);await wait(1)}
  const after=await inspectXiaohongshu();return {ok:after.gates.schedule.ok,evidence:after.gates.schedule.evidence};
}

async function ensureXhsDefaultExtras(){const state=await inspectXiaohongshu();return state.gates.defaults.ok?{ok:true,already:true,evidence:state.gates.defaults.evidence}:{ok:false,reason:'xiaohongshu optional components or activities are not at default',evidence:state.gates.defaults.evidence}}

async function uploadXhsCover() {
  if (!xhsCustomCover) return { ok: true, skipped: true };
  const before = await js(String.raw`(() => { const el=document.querySelector('.cover-plugin-preview .default.row, .cover-plugin-preview .default.column'); return el ? getComputedStyle(el).backgroundImage : '' })()`);
  let tab = { ok: false, reason: 'xiaohongshu upload-cover tab did not become visible' };
  for (let attempt = 0; attempt < 2 && !tab.ok; attempt += 1) {
    await removeExactStaleMask(/设置封面/);
    try {
      await click('.cover-plugin-preview .default.row, .cover-plugin-preview .default.column', { label: 'open xhs cover editor' });
    } catch (error) {
      tab = { ok: false, reason: `xiaohongshu cover preview click failed: ${String(error?.message || error)}` };
      continue;
    }
    for (let index = 0; index < 20; index += 1) {
      const exposed = await js(String.raw`(() => {
        const compact=value=>String(value||'').replace(/\s+/g,' ').trim()
        const item=[...document.querySelectorAll('.d-tabs-header')]
          .find(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return compact(el.innerText||el.textContent||'')==='上传封面'&&r.width>10&&r.height>10&&s.display!=='none'&&s.visibility!=='hidden'})
        if(!item)return {ok:false}
        item.id='vp2-xhs-upload-cover-tab';item.scrollIntoView({block:'center',inline:'center'});return {ok:true,selector:'#vp2-xhs-upload-cover-tab'}
      })()`);
      if (exposed.ok) {
        try {
          await click(exposed.selector, { label: 'activate xhs upload-cover tab' });
          tab = { ok: true, attempt: attempt + 1, waited: index * 0.5 };
        } catch (error) {
          tab = { ok: false, reason: `xiaohongshu upload-cover tab click failed: ${String(error?.message || error)}` };
        }
        break;
      }
      await wait(0.5);
    }
  }
  if (!tab.ok) return tab;
  await wait(1);
  const exposed = await js(String.raw`(() => {
    const input=[...document.querySelectorAll('input[type=file]')].find(el=>/image|png|jpe?g/i.test(el.accept||''))
    if(!input)return {ok:false,reason:'xiaohongshu cover input missing'}
    input.id='vp2-xhs-cover'; return {ok:true,selector:'#vp2-xhs-cover',accept:input.accept||''}
  })()`);
  if (!exposed.ok) return exposed;
  try { await uploadFile(exposed.selector, xhsCoverPath); } catch (error) { return { ok: false, reason: String(error?.message || error) }; }
  await wait(2);
  const ratio = await js(String.raw`(() => {
    const item=[...document.querySelectorAll('.crop-ratio-item')].find(el=>String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()==='3:4')
    if(!item)return {ok:false,reason:'xiaohongshu 3:4 crop chip missing'}
    item.click(); return {ok:true,className:String(item.className||'')}
  })()`);
  if (!ratio.ok) return ratio;
  await wait(1);
  const confirmed = await js(String.raw`(() => {
    const modal=[...document.querySelectorAll('.d-modal')].find(el=>/设置封面/.test(el.innerText||el.textContent||''))
    const button=[...(modal?.querySelectorAll('button')||[])].find(el=>String(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()==='确定'&&!el.disabled)
    if(!button)return {ok:false,reason:'xiaohongshu cover confirm missing or disabled'}
    button.click(); return {ok:true}
  })()`);
  if (!confirmed.ok) return confirmed;
  let after = '';
  for (let index = 0; index < 60; index += 1) {
    const current = await js(String.raw`(() => { const el=document.querySelector('.cover-plugin-preview .default.row, .cover-plugin-preview .default.column'); const text=document.body.innerText||''; return {bg:el?getComputedStyle(el).backgroundImage:'',uploading:/封面上传中|正在上传|处理中/.test(text)} })()`);
    after = current.bg;
    if (after && after !== before && !current.uploading) break;
    await wait(2);
  }
  await removeExactStaleMask(/设置封面/);
  if (!after || after === before) return { ok: false, reason: 'xiaohongshu cover preview did not change', before, after };
  const url = (after.match(/url\(["']?([^"')]+)/) || [])[1] || after;
  return { ok: true, receipt: { assetPath: xhsCoverPath, ratio: '3:4', beforeUrl: before, afterUrl: url } };
}

async function mutateXiaohongshu() {
  const before = await inspectXiaohongshu();
  if (!before.gates.video.ok) return { ...before, blocker: typedBlocker('STATE_AMBIGUOUS', '小红书没有可修复的已上传视频') };
  const actions = {};
  if (!before.gates.title.ok) actions.title = await setNativeInputValue('input[placeholder*="填写标题"]', xhsTitle);
  const afterTitle = await inspectXiaohongshu();
  if (!afterTitle.gates.description.ok||!afterTitle.gates.tags.ok) actions.content = await rebuildXhsTopics();
  if (actions.content && !actions.content.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.content.reason, { evidence: actions.content }) };
  actions.original = await ensureXhsOriginalPolicy();
  if (!actions.original.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.original.reason, { evidence: actions.original }) };
  actions.pkCover = await ensureXhsPkCoverOff();
  if (!actions.pkCover.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.pkCover.reason, { evidence: actions.pkCover }) };
  actions.contentType = await ensureXhsContentType();
  if (!actions.contentType.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.contentType.reason, { evidence: actions.contentType }) };
  actions.defaults = await ensureXhsDefaultExtras();
  if (!actions.defaults.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('STATE_AMBIGUOUS', actions.defaults.reason, { evidence: actions.defaults }) };
  actions.visibility = await ensureXhsVisibility();
  if (!actions.visibility.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.visibility.reason, { evidence: actions.visibility }) };
  actions.schedule = await ensureXhsSchedule();
  if (!actions.schedule.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', actions.schedule.reason, { evidence: actions.schedule }) };
  actions.cover = await uploadXhsCover();
  if (!actions.cover.ok) return { ...(await inspectXiaohongshu()), blocker: typedBlocker('PLATFORM_REJECTED_ASSET', actions.cover.reason, { retryable: true, evidence: actions.cover }) };
  const receipts = actions.cover.receipt ? { cover: actions.cover.receipt } : {};
  actions.receiptCheckpoint = checkpointReceipts(receipts);
  const previousReceipts = expectedReceipts;
  expectedReceipts.cover = receipts.cover || expectedReceipts.cover;
  const after = await inspectXiaohongshu();
  Object.assign(expectedReceipts, previousReceipts, receipts);
  return { ...after, actions, receipts };
}

async function probeXhsPublishResult(){return await js(String.raw`(() => {const compact=v=>String(v||'').replace(/\s+/g,' ').trim();const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'};const signals=[...document.querySelectorAll('div,span,p,h1,h2,h3')].filter(visible).map(el=>compact(el.innerText||el.textContent||'')).filter(text=>/^(发布成功|发布成功啦|笔记发布成功|提交成功|已发布|审核中)$/.test(text));const errors=[...document.querySelectorAll('div,span,p')].filter(visible).map(el=>compact(el.innerText||el.textContent||'')).filter(text=>/发布失败|提交失败|网络错误/.test(text)).slice(0,5);const dialogs=[...document.querySelectorAll('.d-modal,[role="dialog"]')].filter(visible).map(el=>({text:compact(el.innerText||el.textContent||'').slice(0,800),buttons:[...el.querySelectorAll('button')].filter(visible).map(button=>{const r=button.getBoundingClientRect();return {text:compact(button.innerText||button.textContent||''),disabled:Boolean(button.disabled),x:r.left+r.width/2,y:r.top+r.height/2}})}));const leftEditor=!/\/publish\/publish/.test(location.pathname);return {confirmed:signals.length>0||leftEditor,signals:[...new Set(signals)],errors,dialogs,url:location.href,leftEditor}})()`)}

async function publishXiaohongshu(){
  const before=await inspectXiaohongshu();const missing=Object.entries(before.gates).filter(([,gate])=>gate?.ok!==true).map(([name])=>name);if(missing.length)return {...before,blocker:typedBlocker('STATE_AMBIGUOUS','小红书没有通过发布前全部页面条件',{evidence:{missing}})};
  const authorization=await authorizeFinalPublishGuard();if(!authorization.ok)return {...before,blocker:typedBlocker('ACTION_FAILED',authorization.reason,{evidence:authorization})};
  const snapshot=await snapshotText();const match=String(snapshot).match(/button \[ref=(\d+)[^\]]*\]\s*\n\s*text "(发布|定时发布)"/);if(!match)return {...before,blocker:typedBlocker('SELECTOR_DRIFT','xiaohongshu ready publish button missing',{evidence:{snapshot:String(snapshot).slice(-3000)}})};
  await click('@'+match[1],{label:'publish verified Xiaohongshu note'});let confirmationClicked=false;
  for(let attempt=0;attempt<30;attempt+=1){await wait(.5);const probe=await probeXhsPublishResult();if(probe.confirmed)return {...before,published:true,finalPublishClicked:true,publishReceipt:{confirmed:true,confirmationClicked,signals:probe.signals,url:probe.url,at:new Date().toISOString()}};if(probe.errors.length)return {...before,finalPublishClicked:true,blocker:typedBlocker('ACTION_FAILED','小红书返回发布失败',{evidence:probe})};if(!confirmationClicked){const dialog=probe.dialogs.find(item=>/发布|提交/.test(item.text));const button=dialog?.buttons.find(item=>/^(确认|确定|发布|确认发布)$/.test(item.text)&&!item.disabled);if(button){await click([button.x,button.y],{label:'confirm Xiaohongshu publish'});confirmationClicked=true}}}
  const after=await probeXhsPublishResult();return {...before,finalPublishClicked:true,blocker:typedBlocker('STATE_AMBIGUOUS','小红书点击发布后没有出现成功证据',{retryable:true,evidence:after})};
}

async function runPlatformPhase() {
  if (phase === 'inspect' || phase === 'verify') return await inspectXiaohongshu();
  if (phase === 'upload') return await uploadXiaohongshu();
  if (phase === 'mutate') return await mutateXiaohongshu();
  if (phase === 'publish') return await publishXiaohongshu();
  return { ...(await inspectXiaohongshu()), blocker: typedBlocker('ACTION_FAILED', `unsupported Xiaohongshu phase: ${phase}`) };
}
