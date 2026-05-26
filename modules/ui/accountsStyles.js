function buildAccountsStyles() {
  return `
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0}
*{
  scrollbar-width:thin;
  scrollbar-color:rgba(85,221,255,.45) rgba(255,255,255,.06);
}
*::-webkit-scrollbar{
  width:9px;
  height:9px;
}
*::-webkit-scrollbar-track{
  background:rgba(255,255,255,.04);
  border-radius:999px;
}
*::-webkit-scrollbar-thumb{
  background:linear-gradient(180deg,rgba(85,221,255,.65),rgba(68,127,160,.65));
  border:2px solid rgba(8,17,29,.95);
  border-radius:999px;
}
*::-webkit-scrollbar-thumb:hover{
  background:linear-gradient(180deg,rgba(119,231,255,.85),rgba(85,159,195,.85));
}
*::-webkit-scrollbar-corner{
  background:transparent;
}
body{
  font-family:Inter,"Segoe UI",Arial,sans-serif;
  background:linear-gradient(135deg,#07131f 0%,#0b1f2c 48%,#071017 100%);
  color:#edf8ff;
  overflow:hidden;
  -webkit-user-select:none;
}
button,input{-webkit-app-region:no-drag}
.app{
  width:100%;
  height:100%;
  padding:16px;
  display:grid;
  grid-template-rows:auto 1fr;
  gap:12px;
}
.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}
.brand{
  font-size:20px;
  font-weight:800;
  color:#f4fbff;
}
.brand-sub,.panel-sub{
  margin-top:3px;
  font-size:12px;
  color:#8fb1c8;
}
.top-status{
  min-width:92px;
  text-align:center;
  padding:8px 12px;
  border:1px solid rgba(99,220,255,.25);
  border-radius:8px;
  background:rgba(88,211,255,.08);
  color:#bdefff;
  font-size:12px;
  font-weight:700;
}
.surface{
  min-height:0;
  display:grid;
  grid-template-columns:1.24fr .96fr;
  gap:12px;
}
.surface.form-only{
  grid-template-columns:1fr;
  place-items:center;
}
.surface.form-only .list-panel,.surface.form-only .scripts-panel{display:none}
.surface.form-only .side-panel{
  width:min(560px,100%);
  height:auto;
}
.side-panel{
  min-height:0;
  display:grid;
  grid-template-rows:auto 1fr;
  gap:12px;
}
.side-panel.show-form{
  display:block;
}
.side-panel.show-form .scripts-panel{display:none}
.side-panel.show-scripts .form-panel{display:none}
.panel{
  border:1px solid rgba(141,226,255,.18);
  background:rgba(10,24,38,.88);
  border-radius:8px;
  box-shadow:0 18px 40px rgba(0,0,0,.34);
  min-height:0;
}
.list-panel{
  display:grid;
  grid-template-rows:auto 1fr auto;
}
.panel-head{
  min-height:64px;
  padding:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  border-bottom:1px solid rgba(255,255,255,.08);
}
.panel-title{
  font-size:14px;
  font-weight:800;
  color:#f2fbff;
}
.repeat-last-btn{
  margin-left:auto;
  white-space:nowrap;
}
.account-list{
  min-height:0;
  overflow:auto;
  padding:8px;
}
.empty{
  height:100%;
  min-height:320px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.empty-card{
  display:grid;
  gap:12px;
  justify-items:center;
  text-align:center;
}
.empty-title{
  font-size:15px;
  font-weight:800;
}
.empty-text{
  max-width:290px;
  font-size:12px;
  line-height:1.45;
  color:#9fb9ca;
}
.account-item{
  display:grid;
  grid-template-columns:auto 1fr auto auto auto;
  gap:10px;
  align-items:center;
  min-height:74px;
  padding:10px;
  margin-bottom:8px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:8px;
  background:rgba(255,255,255,.035);
}
.account-item:hover{
  border-color:rgba(105,221,255,.5);
  background:rgba(27,69,91,.34);
}
.account-item.is-selectable{
  cursor:pointer;
}
.account-item.selected{
  border-color:rgba(85,221,255,.82);
  background:rgba(41,108,134,.34);
}
.account-item.locked{
  opacity:.72;
}
.select-box{
  border:none;
  width:42px;
  height:42px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:8px;
  background:transparent;
  cursor:pointer;
}
.select-box:hover{
  background:rgba(85,221,255,.1);
}
.select-dot{
  position:relative;
  width:22px;
  height:22px;
  border:2px solid rgba(166,223,241,.72);
  border-radius:999px;
  background:rgba(0,0,0,.18);
}
.account-item.selected .select-dot{
  border-color:#55ddff;
  background:rgba(85,221,255,.18);
}
.account-item.selected .select-dot:after{
  content:"";
  position:absolute;
  left:5px;
  top:5px;
  width:8px;
  height:8px;
  border-radius:999px;
  background:#55ddff;
}
.account-name{
  font-size:14px;
  font-weight:800;
  color:#f4fbff;
}
.account-user{
  margin-top:4px;
  font-size:12px;
  color:#97b7ca;
}
.account-actions,.account-order,.runtime-wrap,.list-actions,.form-actions{
  display:flex;
  align-items:center;
  gap:8px;
}
.account-order{
  gap:4px;
}
.order-btn{
  width:30px;
  min-width:30px;
  padding:6px 0;
  font-size:14px;
}
.runtime-wrap{
  justify-content:flex-end;
}
.status-pill{
  white-space:nowrap;
  padding:5px 8px;
  border:1px solid rgba(255,255,255,.15);
  border-radius:999px;
  background:rgba(255,255,255,.06);
  color:#cbd8e2;
  font-size:11px;
  font-weight:800;
}
.status-pill.active{
  color:#adffd0;
  border-color:rgba(95,236,154,.34);
  background:rgba(25,124,69,.22);
}
.status-pill.loading{
  color:#ffe6a3;
  border-color:rgba(255,216,114,.34);
  background:rgba(139,102,24,.22);
}
.status-pill.error{
  color:#ffb2c1;
  border-color:rgba(255,103,131,.42);
  background:rgba(143,33,56,.24);
}
.status-pill.stopped{
  color:#d7e2ea;
  border-color:rgba(255,255,255,.15);
  background:rgba(255,255,255,.08);
}
.btn-compact{
  min-height:28px;
  padding:6px 8px;
}
.list-actions{
  padding:10px;
  border-top:1px solid rgba(255,255,255,.08);
}
.list-actions .btn{flex:1}
.btn{
  border:none;
  border-radius:8px;
  padding:10px 12px;
  min-height:38px;
  color:#eaf8ff;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
}
.btn:disabled{
  opacity:.52;
  cursor:not-allowed;
}
.btn-primary{
  background:#55ddff;
  color:#032431;
}
.btn-primary:hover{background:#7ae7ff}
.btn-secondary{
  background:rgba(255,255,255,.08);
}
.btn-secondary:hover{background:rgba(255,255,255,.15)}
.btn-danger{
  background:rgba(183,45,72,.28);
  color:#ffd1d9;
}
.btn-danger:hover{
  background:#b72d48;
  color:#fff;
}
.form-panel{
  height:100%;
  display:grid;
  grid-template-rows:auto 1fr auto;
}
.form-body{
  padding:14px;
  display:grid;
  gap:12px;
  align-content:start;
}
.form-error{
  display:none;
  padding:10px;
  border:1px solid rgba(255,103,131,.46);
  border-radius:8px;
  background:rgba(143,33,56,.24);
  color:#ffd5dc;
  font-size:12px;
  line-height:1.4;
}
.form-error.show{display:block}
.field{
  display:grid;
  gap:6px;
}
.field span{
  font-size:12px;
  color:#a9c5d6;
  font-weight:700;
}
.input{
  width:100%;
  min-height:42px;
  border:1px solid rgba(255,255,255,.15);
  border-radius:8px;
  outline:none;
  padding:11px 12px;
  background:rgba(0,0,0,.24);
  color:#fff;
  -webkit-user-select:text;
}
.input:focus{
  border-color:#6ce2ff;
  box-shadow:0 0 0 3px rgba(108,226,255,.18);
}
.password-box{position:relative}
.password-box .input{padding-right:44px}
.icon-btn{
  position:absolute;
  top:50%;
  right:8px;
  transform:translateY(-50%);
  width:30px;
  height:30px;
  border:none;
  border-radius:8px;
  background:rgba(255,255,255,.08);
  color:#d5edf8;
  cursor:pointer;
}
.icon-btn:hover{background:rgba(108,226,255,.2)}
.eye:before{
  content:"";
  position:absolute;
  left:6px;
  top:9px;
  width:16px;
  height:10px;
  border:2px solid currentColor;
  border-radius:50%;
}
.eye:after{
  content:"";
  position:absolute;
  left:12px;
  top:13px;
  width:4px;
  height:4px;
  border-radius:50%;
  background:currentColor;
}
.eye.on{color:#68e4ff}
.form-actions{
  padding:10px;
  border-top:1px solid rgba(255,255,255,.08);
}
.form-actions .btn{flex:1}
.form-actions.single .btn{flex:1 1 100%}
.form-actions.single #cancelBtn{display:none}
.scripts-panel{
  height:100%;
  display:grid;
  grid-template-rows:auto 1fr;
}
.scripts-list{
  min-height:0;
  overflow:auto;
  padding:10px;
  display:grid;
  gap:8px;
  align-content:start;
}
.script-row{
  display:grid;
  grid-template-columns:1fr auto;
  align-items:center;
  gap:12px;
  padding:10px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:8px;
  background:rgba(255,255,255,.035);
}
.script-name{
  font-size:13px;
  font-weight:800;
}
.script-desc{
  margin-top:3px;
  font-size:11px;
  color:#93adbf;
}
.switch{
  position:relative;
  width:46px;
  height:24px;
}
.switch input{
  opacity:0;
  width:0;
  height:0;
}
.slider{
  position:absolute;
  inset:0;
  cursor:pointer;
  background:rgba(255,255,255,.2);
  border-radius:999px;
  transition:.18s ease;
}
.slider:before{
  content:"";
  position:absolute;
  width:18px;
  height:18px;
  left:3px;
  top:3px;
  background:#fff;
  border-radius:999px;
  transition:.18s ease;
}
.switch input:checked + .slider{
  background:#55ddff;
}
.switch input:checked + .slider:before{
  transform:translateX(22px);
}
.switch input:disabled + .slider{
  opacity:.52;
  cursor:not-allowed;
}
.modal-overlay{
  position:fixed;
  inset:0;
  display:none;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(1,7,12,.68);
  z-index:20;
}
.modal-overlay.show{
  display:flex;
}
.modal{
  width:min(420px,100%);
  border:1px solid rgba(141,226,255,.2);
  border-radius:8px;
  background:#0d1f2f;
  box-shadow:0 24px 70px rgba(0,0,0,.54);
  padding:16px;
}
.modal-title{
  font-size:15px;
  font-weight:800;
  color:#f4fbff;
}
.modal-text{
  margin-top:8px;
  color:#a9c5d6;
  font-size:13px;
  line-height:1.45;
}
.modal-actions{
  display:flex;
  justify-content:flex-end;
  gap:8px;
  margin-top:16px;
}
.modal-actions .btn{
  min-width:92px;
}
`;
}

module.exports = {
  buildAccountsStyles
};
