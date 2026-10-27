"use strict";
const ADMIN_OPEN=true; /* مؤقت: الإدارة مفتوحة بدون كلمة مرور حتى اكتمال البناء، ثم يُفعَّل القفل */
const {e,uid,today,csv,toCsvRows,checkFile,makeStore,hist,tx}=MR,Y=SY,N=Y.normAr;
const S=makeStore(localStorage),$=s=>document.querySelector(s),app=$("#app");
const ld=S.get("mw_db",null);let D=ld&&Array.isArray(ld.faults)&&Array.isArray(ld.custom)?ld:{faults:[],custom:[]};
let dirty=false,cur=location.hash,admin=ADMIN_OPEN;
const commit=f=>tx(S,"mw_db",D,f)||(alert("تعذر الحفظ: التخزين ممتلئ أو غير متاح. لم يتم تغيير بياناتك."),false);
const snap=()=>{const b=S.get("mw_bak",[]);b.unshift({t:new Date().toISOString(),d:JSON.parse(JSON.stringify(D))});return S.set("mw_bak",b.slice(0,3))};
const safe=()=>snap()||confirm("تعذر أخذ نسخة احتياطية. متابعة؟");
const LB={deviceType:"نوع الجهاز",brand:"الماركة",category:"الفئة",model:"الموديل",code:"كود العطل",title:"الوصف / العنوان",cause:"السبب المحتمل",fix:"الفحص / الحل",note:"ملاحظات",addedBy:"أضافه",ref:"مصدر المعلومة",reviewedAt:"تاريخ المراجعة",enter:"طريقة الدخول",tests:"الاختبارات",exit:"طريقة الخروج",hp:"القدرة (حصان)",refrigerant:"وسيط التبريد",btu:"BTU (كما في المرجع)",kcal:"Kcal",application:"التطبيق",run_capacitor:"مكثف التشغيل",start_capacitor:"مكثف البدء",oil_qty:"كمية الزيت",oil_unit:"وحدة الزيت",amp:"التيار (A)",watt:"القدرة الكهربائية (W)",freq:"التردد (Hz)",displacement:"الإزاحة (cc)",rpm:"RPM",notes:"ملاحظات"};
const FORMS={fault:{k:Y.FK.filter(x=>x!="ref"&&x!="reviewedAt").concat(["ref","reviewedAt"]),req:["code"],t:["cause","fix","note"]},test:{k:["deviceType","brand","category","model","title","enter","tests","exit","note","ref","reviewedAt"],req:["title","enter"],t:["enter","tests","exit","note"]},comp:{k:["brand","model"].concat(Y.CK),req:["brand","model"],t:["notes"]}};
const warn=m=>`<div class="notice">${m}</div>`,tag=t=>`<span class="tag">${t}</span>`;
const hi=(k,v,n)=>hist(S,k,v,n);
/* ---- قاعدة الكباسات المرجعية: تُحمَّل عند أول استخدام ---- */
let bp=null,CL=null;
const base=()=>bp||(bp=new Promise((ok,no)=>{const s=document.createElement("script");s.src="compressors-base.js";s.onload=()=>ok(window.COMPRESSOR_DB_BRANDS||{});s.onerror=()=>{bp=null;no(new Error("تعذر تحميل قاعدة الكباسات"))};document.head.appendChild(s)}));
async function comps(){const B=await base();if(!CL){CL=[];for(const [b,rows] of Object.entries(B))rows.forEach(r=>CL.push({b,r,n:N(b+" "+r.model),base:1}))}return CL.concat(D.custom.map(c=>({b:c.brand,r:c.rec,n:N(c.brand+" "+c.rec.model),cid:c.id})))}
/* ---- عناصر عرض ---- */
const fitem=r=>`<a class="item" href="#/fault/${e(r.id)}"><b>${r.kind=="test"?"تيست مود: "+e(r.title):`<span dir="ltr">${e(r.code)}</span> — ${e(r.title)}`}</b><div class="mu">${e(r.deviceType)} · ${e(r.brand||"كل الماركات")} ${e(r.model||"")}</div>${r.ref?"":tag("بدون مصدر")}${r.source=="imported"?tag("مستورد"):""}</a>`;
const citem=(x,i)=>`<div class="item"><label style="margin:0;display:flex;gap:8px;align-items:center;color:inherit"><input type="checkbox" class="cmp" value="${i}" style="width:22px;height:22px"><a href="#/comp/${i}" style="color:inherit;text-decoration:none;flex:1"><b dir="ltr">${e(x.r.model)}</b><div class="mu">${e(x.b)} · ${e(x.r.refrigerant||"")} ${e(x.r.hp?x.r.hp+" HP":"")}</div>${x.cid?tag("إضافتك"):tag("مرجع النظام")}</a></label></div>`;
const recs=(o,keys)=>keys.filter(k=>o[k]!=null&&o[k]!=="").map(k=>`<dt>${LB[k]||k}</dt><dd>${/^https?:\/\//.test(o[k])?`<a href="${e(o[k])}" target="_blank" rel="noopener noreferrer">${e(o[k])}</a>`:e(o[k])}</dd>`).join("");
const favBtn=(k,id,t,h)=>{const on=S.get("mw_fav",[]).some(x=>x.k==k&&x.id==id);return`<button class="secondary" id="fv">${on?"★ في المفضلة":"☆ إضافة للمفضلة"}</button>`};
function wireFav(k,id,t,h,redraw){$("#fv").onclick=()=>{let a=S.get("mw_fav",[]).filter(x=>!(x.k==k&&x.id==id));if(!$("#fv").textContent.includes("★"))a.unshift({k,id,t,h});S.set("mw_fav",a);redraw()}}
const copy=txt=>navigator.clipboard.writeText(txt).then(()=>alert("تم النسخ"),()=>alert("تعذر النسخ"));
const fav=()=>{const f=S.get("mw_fav",[]),r=S.get("mw_rv",[]);return(f.length?`<h2>المفضلة</h2>`+f.map(x=>`<a class="item" href="${e(x.h)}">${e(x.t)}</a>`).join(""):"")+(r.length?`<h2>شاهدتها مؤخرًا</h2>`+r.map(x=>`<a class="item" href="${e(x.h)}">${e(x.t)}</a>`).join(""):"")};
/* ---- الصفحات ---- */
function home(){const rs=S.get("mw_rs",[]);app.innerHTML=(S.ok?"":warn("التخزين المحلي غير متاح: لن تُحفظ التغييرات."))+`<button class="secondary" data-act="search" style="width:100%;padding:13px;font-size:15px;margin-top:6px">🔍 بحث عام في الأعطال والكباسات</button>
<div class="grid"><div class="nav-section-title">📚 مرجع فني</div><a class="card card-accent-purple" href="#/faults"><i>🧯</i><div class="card-text"><b>أكواد الأعطال والتيست مود</b><span>${D.faults.length} سجل — أكواد الأعطال وطرق التيست مود لكل نوع وماركة</span></div></a><a class="card card-accent-blue" href="#/comps"><i>🧊</i><div class="card-text"><b>أكواد الكباسات (القدرات)</b><span>بحث بالموديل عن القدرة والأمبير والفريون — قاعدة مرجعية + إضافاتك</span></div></a>
<div class="nav-section-title">⚙️ الإدارة والهوية</div><a class="card card-accent-green" href="#/admin"><i>🗂️</i><div class="card-text"><b>استيراد وتصدير ونسخ احتياطي</b><span>بصيغة نظام الورشة الفنية</span></div></a><a class="card card-accent-blue" href="#/settings"><i>🎨</i><div class="card-text"><b>المظهر والألوان</b><span>ليلي / نهاري وتغيير الألوان واسم الهوية</span></div></a></div>
${rs.length?`<h2>آخر عمليات البحث</h2><div class="chips">${rs.map(x=>`<button class="secondary" data-gq="${e(x.q)}">${e(x.q)}</button>`).join("")}</div>`:""}${fav()}`;
document.querySelectorAll("[data-gq]").forEach(b=>b.onclick=()=>openSearch(b.dataset.gq))}
/* ---- البحث العام ---- */
let gt=0;
function openSearch(q0=""){if($("#gs"))return;const o=document.createElement("div");o.id="gs";o.innerHTML=`<div class="gs-box"><div class="gs-head"><input id="gsq" type="search" placeholder="🔍 كود عطل، موديل كباس، ماركة…" autocomplete="off"><button class="secondary" id="gsx" type="button" style="flex:none">إغلاق</button></div><div id="gsr"><div class="hint">اكتب حرفين على الأقل. يشمل الأعطال والتيست مود والكباسات.</div></div></div>`;document.body.appendChild(o);
const close=()=>{const v=$("#gsq").value.trim();if(v.length>1)hi("mw_rs",{q:v});o.remove()};$("#gsx").onclick=close;o.onclick=ev=>{if(ev.target===o)close()};$("#gsr").onclick=ev=>{if(ev.target.closest("a"))o.remove()};o.onkeydown=ev=>{if(ev.key=="Escape")close()};
let tm;const run=async()=>{const q=N($("#gsq").value),id=++gt;if(q.length<2){$("#gsr").innerHTML='<div class="hint">اكتب حرفين على الأقل.</div>';return}
const fa=D.faults.filter(x=>N(Y.FK.concat(Y.TK).map(k=>x[k]).join(" ")).includes(q)),ft=fa.filter(x=>x.kind!="test"),tt=fa.filter(x=>x.kind=="test");
const part=(t,a)=>a.length?`<h2>${t} (${a.length})</h2>`:"";$("#gsr").innerHTML=part("🧯 أكواد الأعطال",ft)+ft.slice(0,8).map(fitem).join("")+part("🧯 تيست مود",tt)+tt.slice(0,8).map(fitem).join("")+'<div class="hint" id="gsc">جارٍ البحث في الكباسات…</div>';
try{const A=await comps();if(id!==gt)return;const out=[];let n=0;for(let i=0;i<A.length;i++){if(A[i].n.includes(q)){n++;if(out.length<8)out.push(`<a class="item" href="#/comp/${i}"><b dir="ltr">${e(A[i].r.model)}</b><div class="mu">${e(A[i].b)} · ${e(A[i].r.refrigerant||"")} ${e(A[i].r.hp?A[i].r.hp+" HP":"")}</div></a>`)}}
const el=$("#gsc");if(el)el.outerHTML=(n?`<h2>🧊 الكباسات (${n})</h2>`+out.join("")+(n>8?`<a class="item" href="#/comps/${encodeURIComponent($("#gsq").value.trim())}">عرض كل نتائج الكباسات ◂</a>`:""):"")+(!fa.length&&!n?'<div class="item mu">لا توجد نتائج.</div>':"")}catch{const el=$("#gsc");if(el)el.textContent="تعذر تحميل قاعدة الكباسات."}};
$("#gsq").oninput=()=>{clearTimeout(tm);tm=setTimeout(run,150)};$("#gsq").value=q0;$("#gsq").focus();if(q0)run()}
document.addEventListener("click",ev=>{const b=ev.target.closest("[data-act]");if(!b)return;if(b.dataset.act=="search")openSearch();else if(b.dataset.act=="theme")BR.toggle()});
function faults(kind="code"){const uq=a=>[...new Set(D.faults.map(r=>r[a]).filter(Boolean))].sort(),test=kind=="test";
app.innerHTML=`<div class="tabs"><a href="#/faults" class="${test?"":"on"}">أكواد الأعطال</a><a href="#/tests" class="${test?"on":""}">تيست مود</a></div><input id="q" type="search" placeholder="بحث بالكود أو الوصف أو الموديل…" autocomplete="off">
<div class="row"><select id="a"><option value="">كل الأجهزة</option>${uq("deviceType").map(x=>`<option>${e(x)}</option>`).join("")}</select><select id="b"><option value="">كل الماركات</option>${uq("brand").map(x=>`<option>${e(x)}</option>`).join("")}</select></div>${admin?`<div class="row"><a class="primary" href="#/new/${test?"test":"fault"}">➕ ${test?"تيست مود جديد":"كود جديد"}</a></div>`:""}<div id="res"></div>`;
const go=()=>{const q=N($("#q").value),a=$("#a").value,b=$("#b").value;const r=D.faults.filter(x=>(x.kind=="test")==test&&(!a||x.deviceType==a)&&(!b||x.brand==b)&&(!q||N(Y.FK.concat(Y.TK).map(k=>x[k]).join(" ")).includes(q)));
$("#res").innerHTML=(r.length?`<div class="mu">${r.length} نتيجة</div>`+r.slice(0,100).map(fitem).join(""):`<div class="item mu">لا توجد نتائج${D.faults.length?"":". لم تُضَف أكواد بعد — استورد ملفًا أو أضف من الإدارة."}</div>`)+(r.length>100?'<div class="mu">أول 100 نتيجة. ضيّق البحث.</div>':"");if($("#q").value.trim())hi("mw_rs",{q:$("#q").value.trim()})};
["q","a","b"].forEach(i=>$("#"+i).oninput=go);go()}
function fdetail(id){const r=D.faults.find(x=>x.id==id);if(!r)return app.innerHTML=warn("السجل غير موجود");const t=(r.kind=="test"?"تيست مود: ":"")+(r.code||r.title),h="#/fault/"+id;hi("mw_rv",{id,t:t+" — "+(r.brand||""),h});
const keys=(r.kind=="test"?Y.TK:Y.FK);app.innerHTML=`<h2>${e(t)}</h2>${r.ref?"":warn("لا يوجد مصدر موثّق لهذه المعلومة. لا تفترض أن الكود يعني الشيء نفسه عند كل الماركات والموديلات.")}<dl>${recs(r,keys)}${r.source=="imported"?"<dt>الأصل</dt><dd>مستورد</dd>":""}</dl>
<div class="row"><button class="primary" id="cp">نسخ</button>${favBtn("f",id)}</div>${admin?`<div class="row"><a class="secondary" href="#/edit/${r.kind=="test"?"test":"fault"}/${id}">تعديل</a><button class="danger-btn" id="del">حذف</button></div>`:""}
${r.kind!="test"?(()=>{const s=D.faults.filter(x=>x.id!=id&&x.kind!="test"&&N(x.code)==N(r.code));return s.length?`<h2>نفس الكود عند ماركات/موديلات أخرى</h2>`+s.map(fitem).join(""):""})():""}`;
$("#cp").onclick=()=>copy(keys.filter(k=>r[k]).map(k=>LB[k]+": "+r[k]).join("\n"));wireFav("f",id,t,h,()=>fdetail(id));
if(admin)$("#del").onclick=()=>{if(confirm("حذف نهائي؟")&&safe()&&commit(d=>{d.faults=d.faults.filter(x=>x.id!=id)}))location.hash="#/faults"}}
async function compsPage(q0=""){app.innerHTML=`<div class="mu" id="st">جارٍ تحميل القاعدة المرجعية…</div>`;let A,B;try{B=await base();A=await comps()}catch(x){return app.innerHTML=warn(e(x.message)+" — تأكد من وجود الملف compressors-base.js بجوار التطبيق.")}
app.innerHTML=`<input id="q" type="search" value="${e(q0)}" placeholder="رقم الموديل (جزء منه يكفي)…" autocomplete="off"><div class="row"><select id="b"><option value="">كل الماركات</option>${[...new Set(A.map(x=>x.b))].sort().map(x=>`<option>${e(x)}</option>`).join("")}</select><button id="cm" class="secondary">قارن المحدد</button></div>
<div class="notice">القاعدة المرجعية منقولة من ملف إكسل النظام وغير موثّقة بمصادر. الحصان وحده لا يحدد بديلًا متوافقًا؛ راجع الغاز والجهد وظروف التشغيل.</div>${admin?'<a class="secondary" href="#/new/comp">+ إضافة كباس</a>':""}<div id="res"></div>`;
let tm;const go=()=>{const q=N($("#q").value),b=$("#b").value;let n=0,out=[];for(let i=0;i<A.length&&out.length<100;i++){const x=A[i];if((!b||x.b==b)&&(!q||x.n.includes(q)))out.push(citem(x,i))}
const tot=A.filter(x=>(!b||x.b==b)&&(!q||x.n.includes(q))).length;$("#res").innerHTML=`<div class="mu">${tot} نتيجة${tot>100?" (يُعرض أول 100، ضيّق البحث)":""}</div>`+(out.join("")||'<div class="item mu">لا توجد نتائج</div>');if($("#q").value.trim())hi("mw_rs",{q:$("#q").value.trim()})};
$("#q").oninput=()=>{clearTimeout(tm);tm=setTimeout(go,120)};$("#b").onchange=go;go();
$("#cm").onclick=()=>{const ids=[...document.querySelectorAll(".cmp:checked")].map(x=>x.value);ids.length<2?alert("اختر كباسين على الأقل"):location.hash="#/cmp/"+ids.join(",")}}
async function cdetail(i){const A=await comps(),x=A[i];if(!x)return app.innerHTML=warn("السجل غير موجود");const t=x.r.model+" — "+x.b,h="#/comp/"+i;hi("mw_rv",{id:"c"+i,t,h});
const tc=x.r.temp_capacity&&Object.keys(x.r.temp_capacity).length?`<dt>السعة عند درجات الحرارة</dt><dd>${Object.entries(x.r.temp_capacity).map(([a,b])=>e(a+"°: "+b)).join("\n")}</dd>`:"";
app.innerHTML=`<h2 dir="ltr" style="text-align:right">${e(t)}</h2>${x.cid?"":warn("بيانات من القاعدة المرجعية للنظام (ملف إكسل) — مصدرها غير موثّق. تحقق من لوحة الكباس أو الداتا شيت.")}<dl><dt>الماركة</dt><dd>${e(x.b)}</dd>${recs(x.r,["model"].concat(Y.CK))}${tc}</dl>
<div class="notice">لا تعتمد على الحصان وحده لاختيار بديل.</div><div class="row"><button class="primary" id="cp">نسخ</button>${favBtn("c","c"+i)}</div>${admin&&x.cid?`<div class="row"><a class="secondary" href="#/edit/comp/${e(x.cid)}">تعديل</a><button class="danger-btn" id="del">حذف</button></div>`:""}`;
$("#cp").onclick=()=>copy(x.b+"\n"+Y.CK.concat("model").filter(k=>x.r[k]!=null).map(k=>LB[k]+": "+x.r[k]).join("\n"));wireFav("c","c"+i,t,h,()=>cdetail(i));
if(admin&&x.cid)$("#del").onclick=()=>{if(confirm("حذف نهائي؟")&&safe()&&commit(d=>{d.custom=d.custom.filter(c=>c.id!=x.cid)}))location.hash="#/comps"}}
async function cmpView(ids){const A=await comps(),rs=ids.split(",").map(i=>A[i]).filter(Boolean),ks=["model"].concat(Y.CK);
app.innerHTML=`<h2>مقارنة الكباسات</h2><div class="notice">الفروق ملوّنة. القيم تُعرض كما هي في المصدر دون تحويل وحدات؛ «غير متاح» تعني عدم وجود قيمة وليست صفرًا.</div><div style="overflow-x:auto"><table><tr><th></th>${rs.map(x=>`<th dir="ltr">${e(x.b)}</th>`).join("")}</tr>${ks.map(k=>{const v=rs.map(x=>x.r[k]==null||x.r[k]===""?"غير متاح":String(x.r[k])),d=new Set(v).size>1;return`<tr><td>${LB[k]}</td>${v.map(y=>`<td class="${d?"df":""}">${e(y)}</td>`).join("")}</tr>`}).join("")}</table></div>`}
/* ---- نموذج الإضافة والتعديل ---- */
function form(kind,id){if(!admin)return location.hash="#/admin";const F=FORMS[kind];let rec={};
if(id){if(kind=="comp"){const c=D.custom.find(x=>x.id==id);if(!c)return app.innerHTML=warn("غير موجود");rec={brand:c.brand,...c.rec}}else{rec=D.faults.find(x=>x.id==id)||{}}}
const dv=[...new Set(D.faults.map(r=>r.deviceType).filter(Boolean))];
app.innerHTML=`<h2>${id?"تعديل":"إضافة"} ${kind=="comp"?"كباس":kind=="test"?"تيست مود":"كود عطل"}</h2><form id="f"><datalist id="dl">${dv.map(x=>`<option value="${e(x)}">`).join("")}</datalist>${F.k.map(k=>`<label>${LB[k]||k}${F.req.includes(k)?" *":""}${F.t.includes(k)?`<textarea name="${k}" rows="3">${e(rec[k])}</textarea>`:`<input name="${k}" ${k=="deviceType"?'list="dl"':""} type="${k=="reviewedAt"?"date":"text"}" value="${e(rec[k])}">`}</label>`).join("")}<div class="row"><button class="primary">حفظ</button><a class="secondary" href="#/${kind=="comp"?"comps":"faults"}" style="text-align:center">إلغاء</a></div></form>`;
$("#f").oninput=()=>dirty=true;$("#f").onsubmit=async ev=>{ev.preventDefault();const bt=ev.submitter;if(bt.disabled)return;bt.disabled=true;const fail=()=>{bt.disabled=false};
const n=Object.fromEntries([...new FormData(ev.target)].map(([a,b])=>[a,b.trim()]).filter(([a,b])=>b));const miss=F.req.filter(k=>!n[k]);if(miss.length){fail();return alert("حقول أساسية ناقصة: "+miss.map(k=>LB[k]).join("، "))}
let mut;if(kind=="comp"){const {brand,...r}=n,rr=Y.cleanRec(r);if(!rr){fail();return alert("بيانات غير صالحة")}
try{const B=await base();const dup=Y.planComps(B,D.custom.filter(c=>c.id!=id),[{brand,rec:rr}]).dup.length;if(dup&&!confirm("يوجد كباس بنفس الماركة والموديل (في المرجع أو إضافاتك). حفظ على أي حال؟")){fail();return}}catch{}
mut=d=>{if(id){const c=d.custom.find(x=>x.id==id);c.brand=brand;c.rec=rr}else d.custom.push({id:uid(),brand,rec:rr,addedAt:new Date().toISOString()})}}
else{const c=Y.cleanFault(kind=="test"?{...n,kind:"test"}:n);if(!c){fail();return alert("بيانات غير صالحة")}const o=D.faults.filter(x=>x.id!=id);if(Y.planFaults(o,[c]).dup.length&&!confirm("يوجد سجل مكرر بنفس النوع والماركة والموديل والكود. حفظ على أي حال؟")){fail();return}
if(!c.ref&&!confirm("لا يوجد مصدر للمعلومة. سيظهر السجل بتنبيه «بدون مصدر». متابعة؟")){fail();return}
mut=d=>{const now=new Date().toISOString();if(id){const i=d.faults.findIndex(x=>x.id==id);const {id:a,source:s,createdAt:ca}=d.faults[i];d.faults[i]={id:a,...c,source:s||"manual",createdAt:ca,updatedAt:now}}else d.faults.push({id:uid(),...c,source:"manual",createdAt:now,updatedAt:now})}}
snap();if(!commit(mut)){fail();return}dirty=false;location.hash="#/admin"}}
/* ---- الإدارة والاستيراد والتصدير ---- */
const dl=(n,c,m)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([c],{type:m+";charset=utf-8"}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
async function readFile(f){const t=await f.text(),b=checkFile(f.name,f.size,t);if(b){alert(b);return null}return t}
function admPage(){if(!admin)return app.innerHTML=warn("الإدارة مقفلة.");
app.innerHTML=`${ADMIN_OPEN?warn("الإدارة مفتوحة مؤقتًا بدون كلمة مرور أثناء البناء. لا تنشر الرابط علنًا قبل تفعيل القفل."):""}<h2>الإدارة</h2><div class="row"><a class="primary" href="#/new/fault" style="text-align:center">+ كود عطل</a><a class="primary" href="#/new/test" style="text-align:center">+ تيست مود</a><a class="primary" href="#/new/comp" style="text-align:center">+ كباس</a></div>
<h2>استيراد من نظام الورشة (أو من هذا التطبيق)</h2><label>أكواد أعطال وتيست مود (JSON، صيغة faultCodes)<input id="if" type="file" accept=".json"></label><label>إضافات كباسات (JSON، صيغة customCompressors)<input id="ic" type="file" accept=".json"></label><div id="rep"></div>
<h2>تصدير بصيغة النظام</h2><div class="row"><button class="secondary" id="xf">أكواد الأعطال JSON</button><button class="secondary" id="xc">إضافات الكباسات JSON</button><button class="secondary" id="xv">أعطال CSV</button></div>
<h2>نسخة احتياطية كاملة</h2><div class="row"><button class="secondary" id="xb">تنزيل نسخة كاملة</button></div><label>استعادة من ملف<input id="rf" type="file" accept=".json"></label>
<h2>ملخص</h2><div class="item">${D.faults.filter(x=>x.kind!="test").length} كود · ${D.faults.filter(x=>x.kind=="test").length} تيست مود · ${D.custom.length} إضافة كباس</div>`;
const R=$("#rep"),preview=(p,apply,label)=>{if(!p.next)return R.innerHTML=warn(e(p.err[0]));R.innerHTML=warn(`معاينة: سيُضاف ${p.acc.length} · مكرر ${p.dup.length} · مرفوض ${p.err.length}<br>${p.err.slice(0,20).map(e).join("<br>")}`)+(p.acc.length?'<div class="row"><button class="primary" id="ok">اعتماد الاستيراد</button></div>':"");
if(p.acc.length)$("#ok").onclick=ev=>{ev.target.disabled=true;snap();if(commit(apply))R.innerHTML=warn(`تم استيراد ${p.acc.length} ${label}.`);else ev.target.disabled=false}};
const json=t=>{try{return JSON.parse(t)}catch{R.innerHTML=warn("ملف تالف: JSON غير صالح");return undefined}};
$("#if").onchange=async ev=>{const t=await readFile(ev.target.files[0]);if(t==null)return;const j=json(t);if(j===undefined)return;const p=Y.planFaults(D.faults,Y.parseFaults(j));preview(p,d=>{d.faults=d.faults.concat(p.acc)},"سجل")};
$("#ic").onchange=async ev=>{const t=await readFile(ev.target.files[0]);if(t==null)return;const j=json(t);if(j===undefined)return;let B={};try{B=await base()}catch{R.innerHTML=warn("تعذر تحميل القاعدة المرجعية؛ لن يُفحص التكرار معها.")}
const p=Y.planComps(B,D.custom,Y.parseComps(j));preview(p,d=>{d.custom=d.custom.concat(p.acc)},"كباس")};
$("#xf").onclick=()=>dl("اكواد-اعطال.json",JSON.stringify(Y.exportFaults(D.faults),null,2),"application/json");
$("#xc").onclick=()=>D.custom.length?dl("اضافات-كباسات.json",JSON.stringify(Y.exportComps(D.custom),null,2),"application/json"):alert("لا توجد إضافات كباسات للتصدير.");
$("#xv").onclick=()=>dl("اكواد-اعطال.csv",toCsvRows(["kind","deviceType","brand","category","model","code","title","cause","fix","note","enter","tests","exit","ref","reviewedAt"],D.faults),"text/csv");
$("#xb").onclick=()=>dl("نسخة-المرجع-الفني.json",JSON.stringify(Y.makeBackup(D,{favorites:S.get("mw_fav",[]),history:S.get("mw_rs",[])}),null,1),"application/json");
$("#rf").onchange=async ev=>{const t=await readFile(ev.target.files[0]);if(t==null)return;const o=json(t);if(o===undefined)return;const v=Y.validateBackup(o);if(!v.ok)return alert("نسخة مرفوضة: "+v.reason);
if(!confirm(`ستُستبدل البيانات الحالية (${D.faults.length} سجل أعطال / ${D.custom.length} إضافة كباس) بـ ${v.summary.faults} / ${v.summary.custom}. تؤخذ نسخة من الحالة الحالية أولًا. متابعة؟`))return;
if(safe()&&commit(d=>{d.faults=v.data.faults;d.custom=v.data.custom})){if(Array.isArray(o.favorites))S.set("mw_fav",o.favorites.filter(x=>x&&typeof x.h=="string"&&x.h.startsWith("#/")).slice(0,100));admPage()}}}
/* ---- الموجّه (SPA) ---- */
const TT={faults:"🧯 أكواد الأعطال والتيست مود",tests:"🧯 أكواد الأعطال والتيست مود",comps:"🧊 أكواد الكباسات (القدرات)",admin:"🗂️ الإدارة والاستيراد والتصدير",settings:"🎨 المظهر والألوان",new:"➕ إضافة",edit:"✏️ تعديل",fault:"🧯 تفاصيل الكود",comp:"🧊 تفاصيل الكباس",cmp:"🧊 مقارنة الكباسات"};
async function route(){const h=location.hash.slice(2).split("/").map(decodeURIComponent);scrollTo(0,0);const gs=$("#gs");if(gs)gs.remove();try{const m=h[0];$("#top").innerHTML=m===""||!TT[m]?BR.header():BR.topbar(TT[m]);BR.apply();
if(m==="")home();else if(m=="faults")faults();else if(m=="tests")faults("test");else if(m=="fault")fdetail(h[1]);else if(m=="comps")await compsPage(h[1]||"");else if(m=="comp")await cdetail(+h[1]);else if(m=="cmp")await cmpView(h[1]);else if(m=="admin")admPage();else if(m=="settings")BR.settingsPage(app);else if(m=="new")form(h[1]);else if(m=="edit")form(h[1],h[2]);else home()}
catch(x){console.error(x);app.innerHTML=warn("حدث خطأ غير متوقع. ارجع للرئيسية وحاول مجددًا.")}}
addEventListener("hashchange",()=>{if(dirty&&!confirm("لديك تعديلات غير محفوظة. تجاهلها؟")){history.replaceState(null,"",cur);return}dirty=false;cur=location.hash;route()});
addEventListener("beforeunload",ev=>{if(dirty){ev.preventDefault();ev.returnValue=""}});route();
if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
