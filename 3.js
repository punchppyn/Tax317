/* AI Withholding Tax Assistant v2.0
   Rule-based educational prototype. Review current law before real-world use. */
const $ = id => document.getElementById(id);
const STORE_KEY = "whtAssistantHistoryV2";
const RD_ORDER = "https://www.rd.go.th/3479.html";
const RD_GUIDANCE = "https://www.rd.go.th/3326.html";

const rules = [
 {id:"rent",name:"ค่าเช่าทรัพย์สิน",rate:5,article:"ท.ป.4/2528 ข้อ 6",note:"ผู้จ่ายเป็นบริษัท/นิติบุคคลไทย และผู้รับเป็นผู้มีหน้าที่เสียภาษีในไทย",form:"ผู้รับบุคคลธรรมดา: ภ.ง.ด.3 / ผู้รับนิติบุคคล: ภ.ง.ด.53"},
 {id:"contract",name:"ค่าจ้างทำของ",rate:3,article:"ท.ป.4/2528 ข้อ 8",note:"ผู้จ่ายเป็นบริษัท/นิติบุคคลไทย และเป็นค่าจ้างทำของที่เข้าเกณฑ์",form:"ผู้รับบุคคลธรรมดา: ภ.ง.ด.3 / ผู้รับนิติบุคคล: ภ.ง.ด.53"},
 {id:"service",name:"บริการอื่น",rate:3,article:"ท.ป.4/2528 ข้อ 12/1",note:"ไม่ใช่บริการโรงแรม ภัตตาคาร ค่าโฆษณา ค่าขนส่ง หรือรายการที่มีกฎเฉพาะ",form:"ผู้รับบุคคลธรรมดา: ภ.ง.ด.3 / ผู้รับนิติบุคคล: ภ.ง.ด.53"},
 {id:"advertising",name:"ค่าโฆษณา",rate:2,article:"ท.ป.4/2528 ข้อ 10",note:"ผู้จ่ายเป็นบริษัท/นิติบุคคล และผู้รับมีหน้าที่เสียภาษีในไทย",form:"ผู้รับบุคคลธรรมดา: ภ.ง.ด.3 / ผู้รับนิติบุคคล: ภ.ง.ด.53"},
 {id:"transport",name:"ค่าขนส่ง",rate:1,article:"ท.ป.4/2528 ข้อ 12/4",note:"ไม่รวมค่าโดยสารขนส่งสาธารณะ ต้องเป็นค่าขนส่งตามลักษณะกิจการ",form:"ผู้รับบุคคลธรรมดา: ภ.ง.ด.3 / ผู้รับนิติบุคคล: ภ.ง.ด.53"},
 {id:"hotel",name:"บริการโรงแรม",rate:null,article:"ท.ป.4/2528 ข้อ 12/1",note:"ค่าบริการของโรงแรมถูกยกเว้นจากบริการอื่นตามข้อ 12/1",form:"โดยทั่วไปไม่หักตามกฎบริการอื่นนี้"},
 {id:"restaurant",name:"บริการภัตตาคาร",rate:null,article:"ท.ป.4/2528 ข้อ 12/1",note:"ค่าบริการของภัตตาคารถูกยกเว้นจากบริการอื่นตามข้อ 12/1",form:"โดยทั่วไปไม่หักตามกฎบริการอื่นนี้"},
 {id:"goods",name:"ซื้อสินค้า",rate:null,article:"คำชี้แจงกรมสรรพากร",note:"การซื้อสินค้าตามปกติไม่หัก; ค่าขนส่งที่เป็นส่วนหนึ่งของการขายโดยผู้ขายที่ไม่ได้ประกอบธุรกิจขนส่งอาจถือเป็นเงินได้จากการขายสินค้า",form:"ไม่ใช้แบบหัก ณ ที่จ่ายในกรณีที่เข้าเงื่อนไข"}
];
const ruleMap = Object.fromEntries(rules.map(r=>[r.id,r]));
const fmt = n => new Intl.NumberFormat("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
const baht = n => "฿"+fmt(n);
const safe = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today = new Date();
$("paymentDate").value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

function getHistory(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||"[]")}catch{return []}}
function saveHistory(items){localStorage.setItem(STORE_KEY,JSON.stringify(items))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2500)}
function navigate(page){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
 document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
 const names={dashboard:"Dashboard",analyzer:"วิเคราะห์ภาษี",history:"ประวัติการคำนวณ",knowledge:"ฐานความรู้ทางภาษี",about:"เกี่ยวกับระบบ"};
 $("pageTitle").textContent=names[page]||"Dashboard"; $("sidebar").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"});
 if(page==="history")renderHistory(); if(page==="dashboard")renderDashboard();
}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

function analyze(d){
 const missing=[];
 if(!d.payerName)missing.push("ชื่อผู้จ่ายเงิน");
 if(!d.payeeName)missing.push("ชื่อผู้รับเงิน");
 if(!d.payeeType)missing.push("สถานะผู้รับเงิน");
 if(d.residency==="unknown")missing.push("ถิ่นที่อยู่ของผู้รับเงิน");
 if(!d.date)missing.push("วันที่จ่ายเงิน");
 if(!d.description)missing.push("รายละเอียดธุรกรรม");
 if(!(d.amount>0))missing.push("จำนวนเงินก่อน VAT ที่มากกว่า 0");
 if(d.vatRate===null)missing.push("อัตรา VAT ที่ถูกต้อง");
 if(d.payerType!=="company")missing.push("ยืนยันสถานะผู้จ่ายและหลักเกณฑ์เฉพาะ เนื่องจากกฎชุดนี้ครอบคลุมผู้จ่ายที่เป็นบริษัท/นิติบุคคลไทย");
 if(d.payeeType==="foreign"||d.residency==="foreign")missing.push("รายละเอียดผู้รับเงินต่างประเทศและอนุสัญญาภาษีซ้อน (ต้องให้ผู้เชี่ยวชาญตรวจสอบ)");
 if(d.payeeType==="foundation")missing.push("สถานะและประเภทมูลนิธิ/สมาคม เนื่องจากอาจมีอัตราเฉพาะ");
 if(d.category==="unclear")missing.push("ลักษณะงานและประเภทเงินได้ที่แท้จริง");
 if(d.category==="service" && /(โรงแรม|ห้องพัก|ภัตตาคาร|ร้านอาหาร|อาหารประชุม)/i.test(d.description))missing.push("ยืนยันว่าเป็นบริการทั่วไป ไม่ใช่บริการโรงแรมหรือภัตตาคาร");
 if(d.category==="transport"&&!d.regularTransport&&!d.publicPassenger)missing.push("ยืนยันว่าผู้รับประกอบธุรกิจขนส่งเป็นปกติหรือไม่");
 if(d.category==="transport"&&d.publicPassenger) {
   return result("no","ไม่ต้องหักภาษี ณ ที่จ่าย",null,"ค่าโดยสารสำหรับการขนส่งสาธารณะไม่อยู่ในเกณฑ์ค่าขนส่งตามข้อ 12/4",d,0,0,0,"ไม่มีแบบนำส่ง","ท.ป.4/2528 ข้อ 12/4");
 }
 if(d.category==="goods" && d.bundle==="unknown")missing.push("ตรวจสอบสัญญาและใบแจ้งหนี้ว่าค่าจัดส่งเป็นส่วนหนึ่งของการขายสินค้าหรือเป็นบริการขนส่งแยกต่างหาก");
 if(d.category==="goods" && d.bundle==="separate" && !d.sellerDelivery && !d.regularTransport)missing.push("ระบุว่าใครเป็นผู้จัดส่งและผู้รับค่าขนส่งประกอบธุรกิจขนส่งหรือไม่");
 if(d.vatRate===null && d.category!=="goods")missing.push("ยืนยันอัตรา VAT และยอด VAT ตามเอกสาร");
 if(missing.length) return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing,reason:"ระบบหยุดการคำนวณ เนื่องจากข้อมูลสำคัญยังไม่ครบหรืออยู่นอกขอบเขตกฎที่กำหนด กรุณาตอบคำถามเพิ่มเติมก่อนสรุปผล",d};

 const base=Number(d.amount);
 const vat=base*(d.vatRate/100);
 const gross=base+vat;
 if(d.category==="goods"){
   if(d.sellerDelivery || d.bundle==="combined"){
     return result("no","ไม่ต้องหักภาษี ณ ที่จ่าย",null,"ตามข้อเท็จจริงที่ระบุ เป็นการซื้อขายสินค้าและการจัดส่งเป็นส่วนหนึ่งของการขาย โดยผู้ขายไม่ได้ประกอบธุรกิจขนส่งเป็นปกติ จึงถือเป็นเงินได้จากการขายสินค้าในตัวอย่างคำชี้แจงกรมสรรพากร",d,base,vat,0,"ไม่มีแบบนำส่ง","คำชี้แจงกรมสรรพากร: การซื้อขายสินค้าพร้อมจัดส่ง");
   }
   return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing:["แยกมูลค่าค่าสินค้าและค่าขนส่ง พร้อมตรวจสอบผู้ให้บริการขนส่งและสัญญา"],reason:"รายการซื้อสินค้าที่มีค่าจัดส่งแยกต่างหากอาจมีผลต่อการจำแนก ต้องตรวจสอบเอกสารก่อนคำนวณ",d};
 }
 if(d.category==="hotel"||d.category==="restaurant"){
   if(!d.hotelRestaurantOperator)return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing:["ยืนยันว่าผู้รับประกอบกิจการโรงแรมหรือภัตตาคารโดยตรง และยอดเรียกเก็บเป็นค่าบริการของกิจการนั้น"],reason:"ข้อยกเว้นบริการโรงแรมและภัตตาคารใช้ได้เมื่อข้อเท็จจริงเข้าเงื่อนไข ต้องตรวจสอบใบเรียกเก็บเงิน",d};
   const label=d.category==="hotel"?"บริการโรงแรม":"บริการภัตตาคาร";
   return result("no","ไม่ต้องหักภาษี ณ ที่จ่าย",null,`${label}ไม่รวมอยู่ในบริการอื่นตาม ท.ป.4/2528 ข้อ 12/1`,d,base,vat,0,"ไม่มีแบบนำส่ง","ท.ป.4/2528 ข้อ 12/1");
 }
 const rule=ruleMap[d.category];
 if(!rule || rule.rate===null) return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing:["ประเภทเงินได้ที่ชัดเจน"],reason:"ยังไม่พบกฎที่ตรงกับรายการนี้",d};
 if(d.payeeType!=="company"&&d.payeeType!=="individual") return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing:["ประเภทผู้รับเงินที่รองรับ"],reason:"ระบบชุดนี้รองรับผู้รับเงินบุคคลธรรมดาและนิติบุคคลไทยเท่านั้น",d};
 if(d.category==="service" && /(โฆษณา|ขนส่ง|รับเหมา|จ้างทำของ)/i.test(d.description)) return {status:"review",statusText:"ต้องตรวจสอบ / ขอข้อมูลเพิ่ม",missing:["ยืนยันการจำแนกประเภทธุรกรรม เนื่องจากรายละเอียดอาจเข้ากฎเฉพาะ เช่น โฆษณา ขนส่ง หรือจ้างทำของ"],reason:"ไม่ควรจำแนกจากชื่อรายการเพียงอย่างเดียว ต้องพิจารณาเนื้อหาสัญญาและบริการจริง",d};
 const tax=base*rule.rate/100;
 const net=gross-tax;
 const formName=d.payeeType==="individual"?"ภ.ง.ด.3":"ภ.ง.ด.53";
 return result("ok","เข้าเงื่อนไขคำนวณตามกฎในระบบ",rule.rate,`จำแนกเป็น${rule.name} เนื่องจากรายละเอียดรายการที่กรอกตรงกับเงื่อนไขเบื้องต้นของ ${rule.article}`,d,base,vat,tax,formName,rule.article,net);
}
function result(status,statusText,rate,reason,d,base,vat,tax,form,law,net){
 return {status,statusText,rate,reason,d,base,vat,tax,form,law,net:net===undefined?base+vat-tax:net,missing:[]};
}
function renderResult(r){
 const d=r.d;const el=$("analysisResult");el.classList.remove("hidden");
 const isOk=r.status==="ok",isNo=r.status==="no";
 const pill=isOk?'<span class="status ok">✓ คำนวณได้</span>':isNo?'<span class="status no">ไม่ต้องหักตามเงื่อนไข</span>':'<span class="status review">! ต้องตรวจสอบเพิ่มเติม</span>';
 let html=`<div class="result-top"><div><div class="eyebrow">ANALYSIS REPORT</div><h2>ผลการวิเคราะห์ภาษี</h2><p>${safe(d.payeeName)} · ${safe(d.description)}</p></div>${pill}</div>`;
 if(r.status==="partial"){
  html+=`<div class="result-summary"><div class="result-metric"><span>สถานะภาษีหัก ณ ที่จ่าย</span><b>ไม่ต้องหัก*</b></div><div class="result-metric"><span>ฐานรายการ</span><b>${baht(r.base)}</b></div><div class="result-metric"><span>ภาษีหัก ณ ที่จ่าย</span><b>${baht(0)}</b></div><div class="result-metric"><span>ยอดสุทธิ</span><b>รอยืนยัน VAT</b></div></div><div class="result-block"><h3>ผลวิเคราะห์เบื้องต้น</h3><p>${safe(r.reason)}</p><b style="font-size:10px;color:#9b722c">ข้อมูลที่ต้องขอเพิ่มก่อนสรุปยอดจ่ายสุทธิ</b><ul>${r.missing.map(x=>`<li>${safe(x)}</li>`).join("")}</ul><p>การจำแนกเบื้องต้นอ้างอิงคำชี้แจงกรมสรรพากรเรื่องการซื้อสินค้าพร้อมจัดส่ง โดยต้องยืนยันข้อเท็จจริงตามเอกสารจริง</p></div>`;
 }else if(r.status==="review"){
  html+=`<div class="result-block"><h3>เหตุผลที่ระบบหยุดวิเคราะห์</h3><p>${safe(r.reason)}</p><b style="font-size:10px;color:#9b722c">ข้อมูลที่ต้องขอเพิ่มเติม</b><ul>${r.missing.map(x=>`<li>${safe(x)}</li>`).join("")}</ul></div>`;
  html+=`<div class="result-block"><h3>คำแนะนำ</h3><p>กรุณาตรวจสอบสัญญา ใบแจ้งหนี้ สถานะผู้รับเงิน และวันที่จ่ายเงิน แล้วจึงวิเคราะห์ใหม่ หากเป็นกรณีต่างประเทศหรือมีเงื่อนไขเฉพาะควรส่งให้ผู้เชี่ยวชาญตรวจสอบ</p></div>`;
 }else{
  html+=`<div class="result-summary">
   <div class="result-metric"><span>อัตราภาษีหัก ณ ที่จ่าย</span><b>${r.rate===null?"0%":r.rate+"%"}</b></div>
   <div class="result-metric"><span>ฐานภาษี</span><b>${baht(r.base)}</b></div>
   <div class="result-metric"><span>ภาษีหัก ณ ที่จ่าย</span><b>${baht(r.tax)}</b></div>
   <div class="result-metric"><span>ยอดจ่ายสุทธิ</span><b>${baht(r.net)}</b></div>
  </div>
  <div class="result-block"><h3>รายละเอียดการคำนวณ</h3><table class="calc-table">
   <tr><td>มูลค่าก่อน VAT</td><td style="text-align:right">${baht(r.base)}</td></tr>
   <tr><td>VAT ${d.vatRate}%</td><td style="text-align:right">${baht(r.vat)}</td></tr>
   <tr><td>ยอดรวมก่อนหักภาษี</td><td style="text-align:right">${baht(r.base+r.vat)}</td></tr>
   <tr><td>ภาษีหัก ณ ที่จ่าย ${r.rate??0}%</td><td style="text-align:right">- ${baht(r.tax)}</td></tr>
   <tr><td>ยอดจ่ายสุทธิ</td><td style="text-align:right">${baht(r.net)}</td></tr>
  </table><p>สูตร: ฐานภาษี × อัตราภาษี = ภาษีหัก ณ ที่จ่าย<br>${fmt(r.base)} × ${(r.rate??0)/100} = ${fmt(r.tax)} บาท</p></div>
  <div class="result-block"><h3>เหตุผลและประเภทเงินได้</h3><p>${safe(r.reason)}</p><p><b>แบบนำส่ง:</b> ${safe(r.form)}</p><p><b>แหล่งอ้างอิง:</b> ${safe(r.law)}</p></div>`;
 }
 html+=`<div class="result-block"><h3>ข้อควรระวัง</h3><p>ผลลัพธ์นี้เป็นการประมวลผลตามกฎที่บันทึกไว้ใน Prototype ไม่ใช่คำวินิจฉัยทางภาษี ต้องตรวจสอบฉบับกฎหมายและข้อเท็จจริงของธุรกรรม ณ วันที่จ่ายเงินจริง</p></div>
 <div class="result-actions"><button class="btn btn-outline" id="printResult">พิมพ์ผลวิเคราะห์</button><button class="btn btn-primary" id="saveResult">บันทึกประวัติ</button></div>`;
 el.innerHTML=html;
 $("printResult").addEventListener("click",()=>window.print());
 $("saveResult").addEventListener("click",()=>saveResult(r));
 el.scrollIntoView({behavior:"smooth",block:"start"});
}
function readForm(){
 const vr=$("vatRate").value;
 return {payerName:$("payerName").value.trim(),payerType:$("payerType").value,payeeName:$("payeeName").value.trim(),payeeType:$("payeeType").value,residency:$("residency").value,date:$("paymentDate").value,description:$("description").value.trim(),category:$("category").value,bundle:$("bundle").value,amount:Number($("amount").value),vatRate:vr==="other"?null:Number(vr),special:$("special").value.trim(),regularTransport:$("regularTransport").checked,publicPassenger:$("publicPassenger").checked,sellerDelivery:$("sellerDelivery").checked,hotelRestaurantOperator:$("hotelRestaurantOperator").checked};
}
$("taxForm").addEventListener("submit",e=>{e.preventDefault();const r=analyze(readForm());renderResult(r)});
$("taxForm").addEventListener("reset",()=>setTimeout(()=>{$("analysisResult").classList.add("hidden")},0));
function saveResult(r){
 const h=getHistory();const d=r.d;
 h.unshift({id:Date.now(),date:d.date,payee:d.payeeName,category:ruleMap[d.category]?.name||({goods:"ซื้อสินค้า",hotel:"บริการโรงแรม",restaurant:"บริการภัตตาคาร"}[d.category]||"รายการอื่น"),rate:r.rate,tax:r.tax||0,net:r.net??null,status:r.status,statusText:r.statusText,reason:r.reason,base:r.base??null,vat:r.vat??null,form:r.form||"รอตรวจสอบ",law:r.law||"",description:d.description});
 saveHistory(h.slice(0,200));toast("บันทึกประวัติเรียบร้อยแล้ว");renderDashboard();
}
function badge(s){return s==="partial"?'<span class="status review">รอยืนยันข้อมูล</span>':s==="ok"?'<span class="status ok">คำนวณได้</span>':s==="no"?'<span class="status no">ไม่ต้องหัก</span>':'<span class="status review">ตรวจสอบเพิ่ม</span>'}
function renderDashboard(){
 const h=getHistory();$("statTotal").textContent=h.length;$("statConfirmed").textContent=h.filter(x=>x.status==="ok"||x.status==="no").length;$("statReview").textContent=h.filter(x=>x.status==="review"||x.status==="partial").length;$("statTax").textContent=baht(h.reduce((a,x)=>a+(x.status==="ok"?Number(x.tax||0):0),0));
 $("recentRows").innerHTML=h.length?h.slice(0,5).map(x=>`<tr><td><b>${safe(x.payee)}</b></td><td>${safe(x.category)}</td><td>${safe(x.date)}</td><td>${baht(x.tax)}</td><td>${badge(x.status)}</td></tr>`).join(""):'<tr><td colspan="5" class="empty">ยังไม่มีรายการวิเคราะห์</td></tr>';
}
function renderHistory(){
 const q=($("historySearch").value||"").toLowerCase();const h=getHistory().filter(x=>(x.payee+" "+x.category+" "+x.description).toLowerCase().includes(q));
 $("historyRows").innerHTML=h.length?h.map(x=>`<tr><td>${safe(x.date)}</td><td><b>${safe(x.payee)}</b></td><td>${safe(x.category)}</td><td>${x.rate===null||x.rate===undefined?"—":x.rate+"%"}</td><td>${baht(x.tax)}</td><td>${x.net===null?"—":baht(x.net)}</td><td>${badge(x.status)}</td><td><button class="row-delete" data-delete="${x.id}">ลบ</button></td></tr>`).join(""):'<tr><td colspan="8" class="empty">ไม่พบประวัติการคำนวณ</td></tr>';
 document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{saveHistory(getHistory().filter(x=>x.id!==Number(b.dataset.delete)));renderHistory();renderDashboard();toast("ลบรายการแล้ว")}));
}
$("historySearch").addEventListener("input",renderHistory);
$("clearHistory").addEventListener("click",()=>{if(confirm("ยืนยันลบประวัติทั้งหมดในอุปกรณ์นี้หรือไม่?")){saveHistory([]);renderHistory();renderDashboard();toast("ลบประวัติทั้งหมดแล้ว")}});
$("exportCsv").addEventListener("click",()=>{
 const h=getHistory();if(!h.length){toast("ยังไม่มีประวัติให้ดาวน์โหลด");return}
 const rows=[["วันที่","ผู้รับเงิน","ประเภทธุรกรรม","อัตรา","ภาษีหัก","ยอดสุทธิ","สถานะ"],...h.map(x=>[x.date,x.payee,x.category,x.rate??"",x.tax??"",x.net??"",x.statusText])];
 const csv="\\ufeff"+rows.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));a.download="withholding-tax-history.csv";a.click();URL.revokeObjectURL(a.href);
});
function renderRules(){
 $("rulesGrid").innerHTML=rules.map(r=>`<article class="rule-card"><div class="rule-card-head"><h3>${safe(r.name)}</h3><span class="rate-pill">${r.rate===null?"ไม่หัก*":r.rate+"%"}</span></div><p>${safe(r.note)}</p><small>อ้างอิง: ${safe(r.article)}</small></article>`).join("");
}
renderRules();renderDashboard();

/* Built-in examples corresponding to the 10 cases in the AC317 worksheet. */
const examples=[
 {name:"1. ค่าเช่าสำนักงาน",payee:"บริษัท XYZ จำกัด",payeeType:"company",category:"rent",desc:"ค่าเช่าสำนักงานรายเดือน",amount:30000,vat:0},
 {name:"2. ค่าเช่าจากบุคคลธรรมดา",payee:"คุณสมชาย",payeeType:"individual",category:"rent",desc:"ค่าเช่าอาคารรายเดือน",amount:12000,vat:0},
 {name:"3. บริการทำความสะอาด",payee:"บริษัท Clean Pro จำกัด",payeeType:"company",category:"service",desc:"ค่าบริการทำความสะอาดสำนักงาน",amount:20000,vat:7},
 {name:"4. ค่าจ้างทำของ",payee:"คุณผู้รับจ้าง",payeeType:"individual",category:"contract",desc:"ผลิตชั้นวางเอกสาร ผู้รับจ้างจัดหาวัสดุสำคัญเอง",amount:15000,vat:0},
 {name:"5. ค่าโฆษณา",payee:"บริษัท Media Thai จำกัด",payeeType:"company",category:"advertising",desc:"เผยแพร่โฆษณาบนสื่อ",amount:25000,vat:7},
 {name:"6. ค่าขนส่งสินค้า",payee:"บริษัท Fast Transport จำกัด",payeeType:"company",category:"transport",desc:"รับจ้างขนส่งสินค้าเป็นกิจการปกติ",amount:18000,vat:0,regularTransport:true},
 {name:"7. ซื้อสินค้าพร้อมจัดส่ง",payee:"บริษัท Supply จำกัด",payeeType:"company",category:"goods",desc:"ซื้อสินค้า 40,000 บาท และค่าจัดส่ง 2,000 บาท ผู้ขายจัดส่งเอง ไม่ได้ประกอบธุรกิจขนส่ง",amount:42000,vat:null,sellerDelivery:true,bundle:"combined"},
 {name:"8. โรงแรม",payee:"บริษัท Hotel Thai จำกัด",payeeType:"company",category:"hotel",desc:"ค่าห้องพักโรงแรม 8,000 บาท ตามยอดใบเรียกเก็บเงิน",amount:8000,vat:0,hotelRestaurantOperator:true},
 {name:"9. ภัตตาคาร",payee:"บริษัท Restaurant Thai จำกัด",payeeType:"company",category:"restaurant",desc:"ค่าอาหารประชุม 3,500 บาท ตามยอดใบเรียกเก็บเงิน",amount:3500,vat:0,hotelRestaurantOperator:true},
 {name:"10. ข้อมูลกำกวม",payee:"คุณ ก.",payeeType:"",category:"unclear",desc:"ค่าว่าดำเนินการ",amount:10000,vat:0}
];
const sampleBar=document.createElement("div");
sampleBar.className="sample-tools";
sampleBar.innerHTML='<div><b>ทดลองโจทย์ทั้ง 10 กรณี</b><small>เลือกตัวอย่างจากใบงาน AC317 เพื่อกรอกข้อมูลอัตโนมัติ</small></div><select id="sampleCase"><option value="">เลือกกรณีทดสอบ...</option>'+examples.map((x,i)=>`<option value="${i}">${safe(x.name)}</option>`).join("")+'</select><button class="btn btn-outline" id="loadSample">โหลดโจทย์</button>';
$("taxForm").insertBefore(sampleBar,$("taxForm").firstElementChild);
$("loadSample").addEventListener("click",()=>{
 const x=examples[Number($("sampleCase").value)];if(!x){toast("กรุณาเลือกกรณีทดสอบ");return}
 $("payerName").value="บริษัท ABC จำกัด";$("payerType").value="company";$("payeeName").value=x.payee;$("payeeType").value=x.payeeType;$("residency").value="thai";$("paymentDate").value="2026-11-09";$("description").value=x.desc;$("category").value=x.category;$("bundle").value=x.bundle||"separate";$("amount").value=x.amount;$("vatRate").value=String(x.vat);$("regularTransport").checked=!!x.regularTransport;$("publicPassenger").checked=false;$("sellerDelivery").checked=!!x.sellerDelivery;$("hotelRestaurantOperator").checked=!!x.hotelRestaurantOperator;$("special").value="";
 toast("โหลดข้อมูลตัวอย่างแล้ว กดวิเคราะห์และคำนวณ");
});
