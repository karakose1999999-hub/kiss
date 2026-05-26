const source = String.raw`const ROOM_ID_REFRESH_INTERVAL = 10000;

let roomIdRefreshTimer = null;

function buildRoomIdRefreshScript() {
  return [
    "(function(){",
    "function num(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}",
    "function topface(){try{for(var i=0;i<localStorage.length;i++){var key=String(localStorage.key(i)||'');if(key.indexOf('topface_stprev_room_id')!==0)continue;var raw=localStorage.getItem(key);var direct=num(raw);if(direct)return direct;try{var parsed=JSON.parse(raw);var nested=num(parsed&&parsed.data&&parsed.data.value);if(nested)return nested;}catch(_){}}}catch(_){}return '';}",
    "try{var id=num(window.__KISS_LAST_ROOM_ID)||num(window.__KISS_AUTO_KISS_LAST_ROOM_ID)||num(window.__KISS_FALLBACK_LAST_ROOM_ID);",
    "if(!id){try{id=num(localStorage.getItem('kiss_hidden_last_room_id'));}catch(_){}}",
    "if(!id)id=topface();",
    "if(!id){var el=document.querySelector('[data-room-id],[data-roomid]');if(el)id=num(el.getAttribute('data-room-id')||el.getAttribute('data-roomid'));}",
    "return {roomId:id||'',href:String(location.href||''),at:Date.now()};",
    "}catch(error){return {roomId:'',error:String(error&&error.message||error||''),href:String(location.href||''),at:Date.now()};}",
    "})();"
  ].join("\\n");
}

function buildGetStatusRefreshScript() {
  return [
    "(async function(){",
    "function num(v){var t=String(v||'').trim();return /^\\d+$/.test(t)&&t!=='0'?t:'';}",
    "function remember(v){try{var id=num(v);if(!id)return '';var at=Date.now();window.__KISS_LAST_ROOM_ID=id;window.__KISS_LAST_ROOM_ID_AT=at;localStorage.setItem('kiss_hidden_last_room_id',id);localStorage.setItem('kiss_hidden_last_room_id_at',String(at));console.log('__KISS_ROOM_ID__'+JSON.stringify({roomId:id,at:at,source:'get_status.response',confidence:'high'}));return id;}catch(_){return '';}}",
    "try{var res=await fetch('/api/room/get_status/',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','Accept':'application/json, text/javascript, */*; q=0.01'},body:new URLSearchParams({userLocalTime:String(Math.floor(Date.now()/1000)),sessnew:''}).toString(),cache:'no-store'});var data=await res.json().catch(function(){return null;});var roomId=remember(data&&data.status&&(data.status.room_id||data.status.roomId)||data&&data.room_id||data&&data.roomId);return {ok:!!res.ok,status:res.status,roomId:roomId,at:Date.now()};}catch(error){return {ok:false,status:0,error:String(error&&error.message?error.message:error).slice(0,180),at:Date.now()};}",
    "})();"
  ].join("\\n");
}

function refreshSlotRoomId(index) {
  const state = slotState.get(index);
  if (state && state.stopped) return;
  const webview = getGameWebview(index);
  if (!webview || isBlankUrl(getWebviewUrl(webview)) || !isTargetUrl(getWebviewUrl(webview))) return;
  notifyRuntimeStatus(index, "active", "Heartbeat", {
    heartbeat: true,
    href: getWebviewUrl(webview)
  });
  try {
    webview.executeJavaScript(buildRoomIdRefreshScript(), false)
      .then(result => {
        if (result && result.roomId) {
          rememberSlotRoomId(index, result.roomId, result.at);
          sendGlobalKissRoom(index, result.roomId, result.at, "room-refresh");
        } else {
          const stale = !state || !state.lastRoomIdAt || Date.now() - Number(state.lastRoomIdAt || 0) > KISS_ROOM_ID_MAX_AGE;
          if (stale) {
            webview.executeJavaScript(buildGetStatusRefreshScript(), true)
              .then(refresh => {
                slotLog(index, "get-status-refresh-result", refresh);
                if (refresh && refresh.roomId) {
                  rememberSlotRoomId(index, refresh.roomId, refresh.at);
                  sendGlobalKissRoom(index, refresh.roomId, refresh.at, "get_status.response", "high");
                  notifyRuntimeStatus(index, "active", "Room refreshed", {
                    roomId: refresh.roomId,
                    source: "get_status.response",
                    confidence: "high",
                    network: true
                  });
                }
              })
              .catch(error => slotLog(index, "get-status-refresh-result", { ok: false, error: String(error && error.message ? error.message : error) }));
          }
        }
      })
      .catch(() => {});
  } catch (_) {}
}

function sendGlobalKissRoom(index, roomId, at, source, confidence) {
  const entry = entries[index] || {};
  const id = String(roomId || "").trim();
  if (!entry.accountId || !id) return;
  try {
    ipcRenderer.send("kiss-fallback-global-room", {
      accountId: String(entry.accountId),
      partition: String(entry.partition || ""),
      roomId: id,
      at: Number(at || Date.now()),
      source: source || "webview",
      confidence: confidence || undefined
    });
  } catch (_) {}
}

function sendGlobalAutoKiss(index, payload) {
  const entry = entries[index] || {};
  if (!entry.accountId) return;
  try {
    ipcRenderer.send("kiss-fallback-global-auto", {
      accountId: String(entry.accountId),
      partition: String(entry.partition || ""),
      roomId: payload && payload.roomId,
      at: payload && payload.at || Date.now(),
      source: "auto-kiss"
    });
  } catch (_) {}
}

function startRoomIdRefreshTimer() {
  if (roomIdRefreshTimer) return;
  roomIdRefreshTimer = setInterval(() => {
    entries.forEach((_entry, index) => refreshSlotRoomId(index));
  }, ROOM_ID_REFRESH_INTERVAL);
}

function stopRoomIdRefreshTimer() {
  if (roomIdRefreshTimer) clearInterval(roomIdRefreshTimer);
  roomIdRefreshTimer = null;
}
`;

module.exports = {
  source
};
