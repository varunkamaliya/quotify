const views=document.querySelectorAll('.view');
const $=id=>document.getElementById(id);
const money=n=>Number.isFinite(Number(n))&&Number(n)>0?'₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2}):'To be quoted';
let quoteItems=[];
let quoteMeta={customer:'Customer',delivery:'To be confirmed',payment:'To be confirmed',gst:18,includeGst:true,extra:''};

function show(id){views.forEach(v=>v.classList.toggle('active',v.id===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clean(s){return String(s||'').replace(/[\t ]+/g,' ').replace(/^[\s•*\-–—]+/,'').trim()}
function norm(s){return clean(s).replace(/[“”]/g,'"').replace(/[‘’]/g,"'")}
function lines(text){return String(text||'').replace(/\r/g,'').split(/\n+/).map(norm).filter(Boolean)}
function sentences(text){return String(text||'').replace(/\r/g,' ').split(/(?<=[.!?])\s+|\s*\|\s*/).map(norm).filter(Boolean)}
function num(s){const m=String(s||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null}
function qtyOf(s){
  const t=String(s||'');
  let m=t.match(/(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*(\d+(?:\.\d+)?)/i); if(m)return Number(String(m[1]).replace(/,/g,''));
  m=t.match(/(?:^|\s)(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|unit|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)\b/i); if(m)return Number(String(m[1]).replace(/,/g,''));
  m=t.match(/\b(?:need|require|required|want|order)\s+(\d+(?:\.\d+)?)\b/i); if(m)return Number(String(m[1]).replace(/,/g,''));
  return null;
}
function unitOf(s){
  const t=String(s||'');
  let m=t.match(/(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*\d+(?:\.\d+)?\s*(nos?\.?|pcs?\.?|pieces?|units?|unit|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)\b/i);
  if(m)return m[1].replace(/\.$/,'');
  m=t.match(/\b(nos?\.?|pcs?\.?|pieces?|units?|unit|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)\b/i);
  return m?m[1].replace(/\.$/,''):'';
}
function priceOf(s){
  const t=String(s||'');
  let m=t.match(/(?:unit\s*(?:price|rate)|price\s*(?:per|\/)?\s*unit|rate|@|rs\.?|₹|inr)\s*[:=\-]?\s*₹?\s*([\d,]+(?:\.\d+)?)/i);
  return m?Number(m[1].replace(/,/g,'')):null;
}
function isLabel(line,label){return new RegExp('^\\s*'+label+'\\s*[:\\-]','i').test(line)}
function labelValue(text,labels){
  const re=new RegExp('(?:^|\\n)\\s*(?:'+labels.join('|')+')\\s*[:\\-]\\s*([^\\n]+)','i');
  const m=String(text).match(re); return m?clean(m[1]):'';
}
function locationOf(text){
  const t=String(text||'');
  // Prefer explicit site/delivery address labels and ignore section headings such as "Delivery Locations".
  const labeled=[
    /(?:main\s+material|delivery\s+(?:location|address)|site\s+location|delivery\s+required|deliver(?:y|ed)?\s+(?:to|at|in)|ship(?:ping)?\s+(?:to|at|in))\s*[:\-]\s*([^\n.;]+)/i,
    /(?:main\s+material)\s*[:\-]\s*([^\n]+)/i
  ];
  for(const r of labeled){const m=t.match(r); if(m){const v=clean(m[1]).replace(/\b(?:please|and)\s+(?:mention|share|provide).*$/i,'').trim(); if(v && !/^s$/i.test(v))return v}}
  const m=t.match(/\b(?:delivery\s+required\s+(?:at|to)|delivery\s*\+\s*installation\s+(?:at|to)|deliver(?:y|ed)?\s+(?:at|to))\s+([^\n.;]+)/i); if(m)return clean(m[1]);
  return '';
}
function paymentOf(text){
  const v=labelValue(text,['payment terms?','terms of payment','payment','credit terms?']);
  if(v)return v.replace(/\b(?:preferred|requested)\b/gi,'').trim()||v;
  const m=String(text).match(/(?:payment|credit)\s+terms?[^\n]*?\b(\d+\s*days?\s*(?:credit)?|(?:\d+%\s*)?(?:advance|against\s+delivery|on\s+delivery))\b[^\n.]*/i);
  return m?clean(m[0].replace(/^.*?(?:payment|credit)\s+terms?\s*(?:are|is)?\s*[:\-]?/i,'')) : '';
}
function customerOf(text,ls){
  const v=labelValue(text,['customer','client','company','buyer','bill\s*to','organization','customer\s+name','company\s+name']);
  if(v)return v;
  for(let i=0;i<ls.length;i++){
    if(/^(?:purchase department|procurement|purchasing)$/i.test(ls[i]) && ls[i+1]){
      const n=clean(ls[i+1]); if(n && n.length<100)return n;
    }
  }
  // Company-like line, weighted toward the end of the enquiry.
  const company=/\b(?:industr(?:y|ies)|engineering|industrial|trading|traders|enterprise|enterprises|solutions|works|manufacturing|manufacturer|corporation|corp\.?|company|co\.?|technologies|technology|tech|systems|suppliers?|exports?|imports?|services|industrials|pvt\.?\s*ltd|private limited|limited|ltd\.?|llp)\b/i;
  for(let i=ls.length-1;i>=0;i--){const l=ls[i]; if(l.length<100&&!isInstruction(l)&&company.test(l))return l}
  return 'Customer';
}
function isInstruction(s){return /^(?:hi|hello|dear|please|kindly|thanks|thank you|regards|best regards|sincerely|subject|quotation|quote|enquiry|request|note|payment|payment terms?|delivery|delivery location|delivery time|gst|igst|cgst|sgst|tax|transportation|freight|installation|warranty|contact|email|phone|mobile|address|purchase department|procurement|from|to|date|validity|timeline|urgently|thanks|amit|regards|best)$/i.test(clean(s))}
function looksLikeItem(s){
  const t=clean(s);
  if(!t||t.length>180||isInstruction(t))return false;
  if(/^(?:please|kindly|also|and|we|you|your|our|share|send|include|confirm|provide|mention|let|make|give|need|require|required|want|looking|request|quotation|quote)\b/i.test(t))return false;
  if(/\b(?:delivery|payment|gst|tax|transport|freight|installation|warranty|timeline|certificate|details|commercial|best price|credit|advance)\b/i.test(t) && !/\b(?:valve|compressor|pump|motor|bearing|pipe|tank|machine|equipment|panel|cable|switch|sensor|filter|dryer|gauge|meter|fan|battery|chair|table|laptop|printer|software|service|license|kit|mask|furniture|transformer|generator)\b/i.test(t))return false;
  return /[A-Za-z]/.test(t);
}
function cleanProduct(s){
  let t=clean(s);
  t=t.replace(/^(?:please|kindly|we\s+(?:need|require|want)|i\s+(?:need|want)|need|require|required|want|looking\s+for|quote|quotation|quote\s+for|quotation\s+for)\s+/i,'');
  t=t.replace(/\b(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*\d+(?:\.\d+)?\b/ig,'');
  t=t.replace(/\b\d+(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?)\b/ig,'');
  t=t.replace(/\s*(?:[-–—:]\s*)?\b(?:unit\s*(?:price|rate)|price\s*(?:per|\/)?\s*unit|rate)\s*[:=\-]?\s*₹?\s*[\d,]+(?:\.\d+)?/ig,'');
  t=t.replace(/[.!,;:|]+$/,'').trim();
  return t;
}
function extractSpecsFromLines(ls){
  const labels='make|brand|model|size|grade|material|capacity|pressure|type|power supply|power|voltage|phase|frequency|colour|color|dimension|dimensions|rating|connection|thread|length|width|height|weight|warranty|certificate|standard|specification|specifications';
  const out=[];
  for(const l of ls){
    const m=l.match(new RegExp('^('+labels+')\\s*[:\\-]\\s*(.+)$','i')); if(m)out.push(clean(m[1])+': '+clean(m[2]));
  }
  return out;
}
function parseItemCandidate(raw, nearbySpecs=[]){
  let s=clean(raw); if(!s)return null;
  const qty=qtyOf(s); const unit=unitOf(s); const price=priceOf(s);
  let product='';
  // Labelled row: Item: X | Qty: Y | Rate: Z
  let m=s.match(/^(?:item|product|description)\s*[:\-]\s*(.+)$/i); if(m)s=m[1];
  // Split pipe/semicolon structured rows.
  const chunks=s.split(/\s*[|;]\s*/).map(clean).filter(Boolean);
  if(chunks.length>1){
    product=chunks.find(x=>!/(?:^|\s)(?:qty|quantity|rate|price|unit\s*price|unit\s*rate|make|brand|model|size|grade|material)\s*[:=]/i.test(x))||chunks[0];
  } else product=s;
  product=cleanProduct(product);
  if(!looksLikeItem(product))return null;
  const specParts=[];
  // Inline descriptors after a dash/colon are specifications if they contain technical cues.
  const inline=product.match(/^(.*?)(?:\s+[-–—]\s+)(.+)$/);
  if(inline && /\b(?:inch|mm|cm|kg|hp|bar|v|volt|phase|ss\s*\d|grade|capacity|pressure|model|make|brand|size|material)\b/i.test(inline[2])){product=clean(inline[1]);specParts.push(clean(inline[2]))}
  for(const p of chunks.slice(1)){if(/\b(?:make|brand|model|size|grade|material|capacity|pressure|type|power|voltage|phase|spec)/i.test(p))specParts.push(p)}
  specParts.push(...nearbySpecs);
  return {product,qty,unit,price,spec:[...new Set(specParts.map(clean).filter(Boolean))].join(' · ')};
}
function itemKey(s){
  return clean(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function isUnitOnly(s){
  return /^(?:nos?\.?|pcs?\.?|pieces?|units?|unit|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)$/i.test(clean(s));
}
function productLooksReal(s){
  const t=clean(s);
  if(!t || isUnitOnly(t) || t.length<2 || t.length>180) return false;
  if(isInstruction(t)) return false;
  if(/^(?:quantity|required quantity|qty|unit|uom|rate|price|payment|delivery|gst|tax|transportation|freight|installation|warranty|contact|email|phone|mobile|address|regards|thanks|thank you|amit|raj(?:esh)?|purchase department|procurement)$/i.test(t)) return false;
  // Reject sentences that are clearly instructions/metadata, unless they contain a strong product noun.
  if(/^(?:please|kindly|share|send|confirm|include|mention|provide|let|make|give|also)\b/i.test(t) && !/\b(?:valve|compressor|pump|motor|bearing|pipe|tank|machine|equipment|panel|cable|switch|sensor|filter|dryer|gauge|meter|fan|battery|chair|table|laptop|printer|software|service|license|kit|mask|transformer|generator|boiler|chiller|controller|fitting|flange|seal|hose|actuator|regulator|instrument)\b/i.test(t)) return false;
  return /[A-Za-z]/.test(t);
}
function normalizeProduct(s){
  let t=clean(s);
  t=t.replace(/^(?:hi[,\s]+)?(?:please\s+)?(?:we\s+)?(?:need|require|required|want|would\s+like|looking\s+for)\s+(?:a|an|the)?\s*/i,'');
  t=t.replace(/^(?:quotation|quote)\s+(?:for|of)\s+/i,'');
  t=t.replace(/^(?:also\s+need|also\s+require|also\s+want)\s+/i,'');
  t=t.replace(/^(?:item|product|description)\s*[:\-]\s*/i,'');
  t=t.replace(/\b(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*\d+(?:\.\d+)?\b/ig,'');
  t=t.replace(/\b\d+(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?)\b/ig,'');
  t=t.replace(/\s*(?:[-–—:]\s*)?(?:unit\s*(?:price|rate)|price\s*(?:per|\/)?\s*unit|rate)\s*[:=\-]?\s*₹?\s*[\d,]+(?:\.\d+)?/ig,'');
  t=t.replace(/^[\s,;:–—-]+|[\s,;:|.]+$/g,'').trim();
  return t;
}
function splitProductSpec(product){
  let p=clean(product), spec='';
  // Move a quantity accidentally included in the product phrase into the structured quantity.
  p=p.replace(/^\d+(?:\.\d+)?\s+(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)\s+(?:of\s+)?/i,'');
  p=p.replace(/^\d+(?:\.\d+)?\s+(?!(?:hp|bar|v|volt|volts|kw|kva|hz|mm|cm|inch|in|kg|kgs|ltr|litre|liter|litres|liters|m|metre|meter|metres|meters|phase)\b)(?=[A-Za-z])/i,'');
  // Move common technical descriptors out of the product title so the quotation stays professional.
  const m=p.match(/^(.*?)(?:\s+)(\d+(?:\.\d+)?\s*(?:inch|in|mm|cm|m|kg|kgs|ltr|litre|liter|litres|liters|bar|hp|kw|kva|v|volt|volts|hz|phase)\b(?:\s+[^,;|]+)?)$/i);
  if(m && /\b(?:inch|mm|cm|kg|ltr|litre|liter|bar|hp|kw|kva|v|volt|hz|phase)\b/i.test(m[2])){p=clean(m[1]); spec=clean(m[2]);}
  p=p.replace(/\s+\b(?:suitable|compatible|appropriate)\s+for\s+.+$/i,'').trim();
  return {product:p,spec};
}
function extractMainProduct(text, ls){
  const patterns=[
    /(?:quotation|quote|enquiry|rfq)\s+(?:for|of)\s+(.+?)(?=\s+(?:for|at|in|with|having)\s+(?:our|the|a|an|my|manufacturing|factory|plant|site)|[\n,.]|$)/i,
    /(?:we\s+need|we\s+require|i\s+need|i\s+require)\s+(?:quotation|quote)\s+(?:for|of)\s+(.+?)(?=\s+(?:for|at|in|with)\s+(?:our|the|a|an|my)|[\n,.]|$)/i
  ];
  for(const r of patterns){const m=String(text).match(r); if(m){const p=normalizeProduct(m[1]); if(productLooksReal(p))return p;}}
  // A common RFQ pattern: the first sentence names the requested item and a later line gives its quantity.
  for(const l of ls){
    const m=l.match(/^(?:hi[,\s]*)?(?:we\s+need|we\s+require|i\s+need|i\s+require)\s+(?:a|an|the)?\s*(.+)$/i);
    if(m && /\b(?:quantity|qty|nos?|pcs?|pieces?|units?)\b/i.test(ls.slice(ls.indexOf(l)+1,ls.indexOf(l)+4).join(' '))){
      let p=m[1].replace(/\s+(?:for|at|in)\s+(?:our|the|a|an|my)\b.*$/i,'');
      p=normalizeProduct(p); if(productLooksReal(p))return p;
    }
  }
  return '';
}
function extractAdditionalItems(text){
  const found=[];
  const unitPattern='(?:nos?\\.?|pcs?\\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|kg|kgs|litres?|liters?|ltr|metres?|meters?|mtrs?|m)';
  // Handles: "Also need Air Receiver Tank 1000 Ltr – 1 No and Refrigerated Air Dryer – 1 No"
  const re=new RegExp('(?:also\\s+need|also\\s+require|also\\s+want)\\s+(.+?)\\s*[-–—:]\\s*(\\d+(?:\\.\\d+)?)\\s*('+unitPattern+')(?=\\s+(?:and|,|;|\\.)|$)','ig');
  let m; while((m=re.exec(text))){
    const p=normalizeProduct(m[1]); if(productLooksReal(p))found.push({product:p,qty:Number(m[2]),unit:m[3].replace(/\.$/,''),price:priceOf(m[0]),spec:extractInlineSpec(p)});
  }
  // Capture chained "and X – 1 No" clauses following the first additional item.
  const chain=new RegExp('(?:\\band\\s+)(.+?)\\s*[-–—:]\\s*(\\d+(?:\\.\\d+)?)\\s*('+unitPattern+')(?=\\s*(?:and|,|;|\\.|$))','ig');
  while((m=chain.exec(text))){
    const p=normalizeProduct(m[1]); if(productLooksReal(p))found.push({product:p,qty:Number(m[2]),unit:m[3].replace(/\.$/,''),price:priceOf(m[0]),spec:extractInlineSpec(p)});
  }
  return found;
}
function extractInlineSpec(product){
  const t=clean(product); const m=t.match(/^(.*?)(?:\s+[-–—]\s+)(.+)$/);
  if(m && /\b(?:inch|mm|cm|kg|hp|bar|v|volt|phase|ss\s*\d|grade|capacity|pressure|model|make|brand|size|material|ltr|litre|liter)\b/i.test(m[2])) return clean(m[2]);
  return '';
}
const QTY_UNIT_RE=/(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|mm|sq\.ft|sqft|ton|tons|kw|kwp|kva|kva|hours?|hrs?)/i;
const PRODUCT_NOUN_RE=/\b(?:forklift|racking|rack|pallet|truck|trolley|leveler|shelter|bumper|railing|protector|mirror|bollard|scanner|printer|label|terminal|camera|nvr|hdd|hard\s*disk|switch|cable|patch\s*panel|connector|light|fan|socket|tray|solar|inverter|panel|valve|compressor|pump|motor|bearing|pipe|tank|machine|equipment|panel|sensor|filter|dryer|gauge|meter|battery|charger|transformer|generator|boiler|chiller|controller|fitting|flange|seal|hose|actuator|regulator|instrument|service|software|license|kit|mask|furniture|system|unit)\b/i;
const SPEC_LABEL_RE=/^(?:height|depth|length|width|size|load|load capacity|capacity|pressure|type|power|power supply|voltage|phase|frequency|material|make|brand|model|battery|lift height|fork length|wheel material|approx(?:imate)?(?:\s+requirement)?|actual|exact|preferred|minimum|maximum|working|backup|attachment|shelf(?:es)?|levels?|positions?|dimension|dimensions|rating|connection|thread|warranty|certificate|standard|gst|transportation|freight|installation|payment|delivery|amc|validity|exclusions?|assumptions?|site requirements?)\s*[:\-]?/i;
const META_LINE_RE=/^(?:please|kindly|we\s+have|we\s+are|we\s+need|we\s+require|our|if\s+you|should|however|also|need|require|required|send|share|provide|quote|quotation|commercial|important|preferred|delivery locations?|commercial requirements?|regards|thanks|thank you|purchase department|procurement|gstin|email|contact|phone|mobile|address|subject|hi\b|hello\b|dear\b)/i;
function stripBullet(s){return clean(s).replace(/^(?:[-–—•*]+|\d+[.)]\s+)/,'').trim()}
function isSectionHeading(line){
  const m=clean(line).match(/^\d+[.)]\s*([^:]+)$/); if(!m)return false;
  const title=clean(m[1]);
  return title.length<100 && !/\b(?:qty|quantity|nos?\.?|pcs?\.?|pieces?|units?|kg|meter|metre|ton|tons|price|rate|₹|rs\.?|@)\b/i.test(title);
}
function sectionOptional(title){return /\boptional\b|solar\s+requirement|optional\s+solar/i.test(title)}
function parseQuantity(text){
  const t=clean(text);
  // Explicit commercial quantities always win over technical measurements such as 3 ton, 50 HP, 1000 Ltr, etc.
  let m=t.match(/(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft|ton|tons)?/i);
  if(m)return {qty:Number(String(m[1]).replace(/,/g,'')),unit:(m[2]||'Nos').replace(/\.$/,'')};
  // Prefer a number immediately followed by an order unit (nos/pcs/units/etc.).
  m=t.match(/(?:^|[\s,;–—-])(?:approx(?:imately)?|around|about|~)?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?)\b/i);
  if(m)return {qty:Number(String(m[1]).replace(/,/g,'')),unit:m[2].replace(/\.$/,'')};
  // Quantity may be expressed as "180 pallet positions", "150 meter", etc. Only use these
  // measurements when they are clearly a quantity noun, not a product specification.
  m=t.match(/(?:^|[\s,;–—-])(?:approx(?:imately)?|around|about|~)?\s*(\d+(?:\.\d+)?)\s*(meters?|metres?|mtrs?|litres?|liters?|ltr|positions?|sq\.?\s*ft|sqft)\b/i);
  if(m)return {qty:Number(String(m[1]).replace(/,/g,'')),unit:m[2].replace(/\.$/,'')};
  return {qty:null,unit:''};
}
function isSpecLine(line){
  const t=clean(line);
  if(SPEC_LABEL_RE.test(t))return true;
  if(/^(?:-\s*)?(?:please|kindly|also|if you can|exact|preferred|minimum|maximum|need|we have|we are|we need|we require|should|can|do not|do\s+not|please quote|quote|provide|include|mention|share|send)\b/i.test(t) && !PRODUCT_NOUN_RE.test(t))return true;
  return false;
}
function extractSpecLine(line){
  return stripBullet(line).replace(/^(?:approx(?:imate)?(?:\s+requirement)?|exact(?:ly)?|preferred|minimum|maximum)\s*[:\-]?\s*/i,'').trim();
}
function itemNameFromLine(line){
  let t=stripBullet(line).replace(/^\d+[.)]\s+/,'');
  t=t.replace(/^(?:also\s+need|also\s+require|also\s+want|need|require|required|want|please\s+quote|quote|quotation\s+for|we\s+need|we\s+require)\s+/i,'');
  t=t.replace(/\s*(?:[-–—,;:]\s*)?(?:qty|quantity|required\s+quantity)\s*[:=\-]?\s*\d+(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?)?/i,'');
  t=t.replace(/\s*[-–—]\s*(?:(?:approx(?:imately)?|around|about|~)\s*)?\d[\d,]*(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft|ton|tons)\b(?:\s+for\s+[^-–—,;]+)?\s*$/i,'');
  t=t.replace(/\s+\b(?:approx(?:imately)?|around|about|~)\s*\d[\d,]*(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft|ton|tons)\b(?:\s+for\s+[^-–—,;]+)?/i,'');
  t=t.replace(/\s*\b(?:please\s+quote|quote|send|provide)\b.*$/i,'').trim();
  return t.replace(/[,:;–—-]+$/,'').trim();
}
function inlineSpecs(line){
  const t=stripBullet(line), out=[];
  // Preserve everything after the item name when separated by technical dashes.
  const parts=t.split(/\s+[-–—]\s+/).map(clean).filter(Boolean);
  if(parts.length>1){
    for(const p of parts.slice(1)){
      if(/\b(?:capacity|height|depth|length|width|load|ton|meter|metre|mm|kg|hp|bar|v|volt|phase|battery|lithium|attachment|tyre|tire|shelf|level|position|make|brand|model|size|material|wheel|channel|tb|tb|port|poe|cat6|4c|sq\.?\s*mm|kw|kwp|kva|mp|camera|installation|warranty)\b/i.test(p))out.push(p);
    }
  }
  return out.join(' · ');
}
function extractCommercial(text){
  const t=String(text||''); const extra=[];
  if(/\btransport(?:ation)?|freight\b/i.test(t))extra.push('Transportation / freight to be quoted separately');
  if(/\binstallation\b/i.test(t))extra.push('Installation charges to be quoted separately');
  if(/\bloading\s*\/?\s*unloading\b/i.test(t))extra.push('Loading / unloading charges if applicable');
  if(/\bwarranty\b/i.test(t))extra.push('Warranty details required');
  if(/\bquotation\s+validity|\bvalidity\b/i.test(t))extra.push('Quotation validity to be mentioned');
  if(/\bdelivery\s+timeline|\bdelivery\s+time/i.test(t))extra.push('Delivery timeline to be mentioned');
  if(/\bamc\b/i.test(t))extra.push('AMC cost after warranty');
  if(/\bcertificate\b/i.test(t))extra.push('Required certificates');
  const secondary=t.match(/second\s+warehouse\s+in\s+([^\n.;]+)/i); if(secondary)extra.push('Secondary delivery location: '+clean(secondary[1]));
  if(/technical recommendation|site survey/i.test(t))extra.push('Technical recommendations / site-survey adjustments should be clearly identified');
  return extra.join(' · ');
}
function parseItemsLegacy(raw){
  const text=String(raw||'').replace(/\r/g,'');
  const rawLines=text.split('\n').map(norm).filter(Boolean);
  const items=[]; const seen=new Map(); let section='General'; let optional=false; let current=null; let sectionLines=[];
  const push=(obj)=>{
    if(!obj||!obj.product)return null;
    let product=clean(obj.product).replace(/\s+/g,' ').trim();
    if(!product || product.length>140 || isUnitOnly(product) || isSpecLine(product))return null;
    product=product.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g,'');
    const key=itemKey(product); if(!key)return null;
    if(seen.has(key)){
      const ex=items[seen.get(key)];
      if(obj.spec)ex.spec=clean([ex.spec,obj.spec].filter(Boolean).join(' · '));
      if(ex.qty==null&&obj.qty!=null){ex.qty=obj.qty;ex.unit=obj.unit||ex.unit}
      if(obj.optional)ex.optional=true;
      return ex;
    }
    const it={product,qty:obj.qty??null,unit:obj.unit||'',price:obj.price??null,spec:clean(obj.spec||''),category:obj.category||section,optional:obj.optional??optional,approximate:!!obj.approximate,kind:obj.kind||'item'};
    seen.set(key,items.length);items.push(it);current=it;return it;
  };
  const attach=(spec)=>{if(current&&spec){current.spec=clean([current.spec,spec].filter(Boolean).join(' · '));}};
  const sectionMeta=()=>sectionLines.join(' ');
  const inferSectionItem=()=>{
    const title=section;
    if(!title||/^(?:commercial requirements?|delivery locations?|important)$/i.test(title))return null;
    const qLines=sectionLines.filter(x=>parseQuantity(x).qty!=null);
    const firstQty=qLines.map(x=>parseQuantity(x)).find(x=>x.qty!=null);
    // Parent sections whose first quantitative bullet is actually a specification of the section.
    if(/^(?:hand pallet trucks?|platform trolley|warehouse safety|barcode\s*\/\s*inventory equipment|electrical|optional solar requirement|pallet racking|cctv|forklift|ms storage racks?)$/i.test(title)){
      if(/ms storage racks?/i.test(title) && items.some(x=>itemKey(x.product).includes('heavy duty rack'))) return;
      let qty=null,unit='',specParts=[];
      if(/pallet\s+racking/i.test(title)){
        const m=sectionMeta().match(/(?:approx(?:imately)?\s*)?(\d+)\s+pallet\s+positions?/i); if(m){qty=Number(String(m[1]).replace(/,/g,''));unit='pallet positions'}
      } else if(/hand pallet trucks/i.test(title)){
        const m=sectionMeta().match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:ton|tons)\s*[-–—]\s*(\d+)\s*nos?/i); if(m){qty=Number(m[2]);unit='Nos'}
      } else if(/platform trolley/i.test(title)){
        const m=sectionMeta().match(/capacity\s*[-:]?\s*[^\n]*?[-–—]\s*(\d+)\s*nos?/i); if(m){qty=Number(String(m[1]).replace(/,/g,''));unit='Nos'}
      } else if(/ms storage racks/i.test(title)){
        const m=sectionMeta().match(/(?:approx(?:imately)?\s*)?(\d+)\s*nos?/i); if(m){qty=Number(String(m[1]).replace(/,/g,''));unit='Nos'}
      }
      if(qty!=null){
        // The section title is the clean product; all section content becomes specification.
        specParts=sectionLines.filter(x=>!/^\s*(?:approx(?:imately)?\s*)?\d+\s*(?:pallet\s+positions?|nos?\.?|pcs?\.?|pieces?|units?)\s*(?:initially)?$/i.test(stripBullet(x))).filter(x=>!/^\s*(?:we\s+have|actual usable area|delivery|commercial|important)\b/i.test(stripBullet(x))).map(extractSpecLine).filter(Boolean);
        const it=push({product:title,qty,unit,spec:specParts.join(' · '),category:title,optional});
        if(it)current=it;
      }
    }
  };
  const flushSection=()=>{inferSectionItem();sectionLines=[];current=null};
  for(let i=0;i<rawLines.length;i++){
    const line=clean(rawLines[i]);
    if(isSectionHeading(line)){
      flushSection(); section=clean(line.replace(/^\d+[.)]\s*/,'')).replace(/:$/,''); optional=sectionOptional(section); continue;
    }
    sectionLines.push(line);
    const bullet=/^(?:[-–—•*]+)\s+/.test(line);
    const body=stripBullet(line);
    // Optional add-ons embedded inside a section, e.g. "Please quote 1 additional battery separately as optional".
    const optionalMatch=body.match(/(?:please\s+)?quote\s+(\d+(?:\.\d+)?)\s+(.+?)\s+separately\s+as\s+optional/i);
    if(optionalMatch){
      const optName=clean(optionalMatch[2]).replace(/\b(?:optional|separately)\b/ig,'').trim();
      if(optName && productLooksReal(optName)){
        push({product:optName,qty:Number(optionalMatch[1]),unit:'Nos',price:null,spec:'Optional item; quote separately',category:section,optional:true});
      }
      continue;
    }
    // Product-specific notes should attach to the relevant item, not the last item parsed.
    if(/^scanner\s+should\s+support/i.test(body)){
      const scanner=items.find(x=>/barcode scanner/i.test(x.product)); if(scanner)scanner.spec=clean([scanner.spec,'1D + 2D QR/barcode support'].filter(Boolean).join(' · '));
      continue;
    }
    if(/^please\s+quote\s+zebra\/honeywell/i.test(body)){
      const scanner=items.find(x=>/barcode scanner/i.test(x.product)); if(scanner)scanner.spec=clean([scanner.spec,'Preferred make: Zebra / Honeywell or equivalent'].filter(Boolean).join(' · '));
      continue;
    }
    // Commercial / prose instructions should never be products.
    if(/^(?:do\s+not|please\s+(?:check|provide|quote|mention|share|send|include|also)|if\s+you|we\s+(?:are|have|need|require)|our\s+preferred|quantities\s+mentioned|for\s+(?:pallet|cctv)|we\s+expect|main\s+material|some\s+electrical|scanner\s+should|brands?:|commercial requirements?|delivery locations?|important)/i.test(body) && !/\b(?:electric forklift|hydraulic dock leveler|barcode scanner|thermal label printer|safety railing|industrial exhaust fan|high bay light)\b/i.test(body)){
      if(current && bullet && !/^(?:please\s+quote|please\s+provide|please\s+check)/i.test(body))attach(extractSpecLine(body));
      continue;
    }
    if(isSpecLine(body) && !(/\b(?:\d+)\s*(?:nos?\.?|pcs?\.?|pieces?|units?)\b/i.test(body) && PRODUCT_NOUN_RE.test(body))){
      if(current)attach(extractSpecLine(body));
      continue;
    }
    if(/^\d+[.)]\s+/.test(line) && !isSectionHeading(line)){
      const q=parseQuantity(body); let name=itemNameFromLine(body); 
      if(name && (q.qty!=null || PRODUCT_NOUN_RE.test(name))){
        push({product:name,qty:q.qty,unit:q.unit,price:priceOf(body),spec:inlineSpecs(body),category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(body)}); continue;
      }
    }
    if(bullet){
      const q=parseQuantity(body);
      // Some sections name the product in the heading and put only the specification + quantity in the first bullet.
      if(q.qty!=null && /^(?:platform trolley|hand pallet trucks?)$/i.test(section)) {
        if(!current || itemKey(current.product)!==itemKey(section)) current=push({product:section,qty:q.qty,unit:q.unit||'Nos',price:priceOf(body),spec:itemNameFromLine(body),category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(body)});
        else { current.qty=q.qty; current.unit=q.unit||current.unit; attach(itemNameFromLine(body)); }
        continue;
      }
      if(q.qty!=null){
        let name=itemNameFromLine(body);
        // If the line is only a measurement/spec (e.g. "4 shelves each"), attach it.
        if(!name || isSpecLine(name) || !/[A-Za-z]{3}/.test(name)) {if(current)attach(extractSpecLine(body)); continue;}
        // For section-driven lists such as "2.5 ton – 8 nos" infer the section title as the product.
        const sectionDriven=/^(?:hand pallet trucks?|platform trolley)$/i.test(section) && !PRODUCT_NOUN_RE.test(name);
        if(sectionDriven){
          if(!current || itemKey(current.product)!==itemKey(section)){
            current=push({product:section,qty:q.qty,unit:q.unit||'Nos',price:priceOf(body),spec:body.replace(/\s*[-–—]\s*\d+\s*nos?.*$/i,'').trim(),category:section,optional});
          } else {
            current.qty=q.qty; current.unit=q.unit||current.unit; attach(body.replace(/\s*[-–—]\s*\d+\s*nos?.*$/i,'').trim());
          }
          continue;
        }
        // Cable / electrical quantity lines are products even when the noun isn't in our dictionary.
        if(name && (PRODUCT_NOUN_RE.test(name)||section==='Electrical'||section==='Warehouse Safety'||section==='Barcode / Inventory Equipment'||section==='CCTV')){
          const sectionTitle=/^MS Storage Racks$/i.test(section)&&/\brack\b/i.test(name)?section:name;
          push({product:sectionTitle,qty:q.qty,unit:q.unit||'Nos',price:priceOf(body),spec:inlineSpecs(body),category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(body)}); continue;
        }
        if(current){attach(extractSpecLine(body));continue;}
      }
      if(current){attach(extractSpecLine(body));continue;}
    }
    // Unbulleted explicit quantity rows.
    const q=parseQuantity(body);
    if(!bullet && q.qty!=null && PRODUCT_NOUN_RE.test(body) && !META_LINE_RE.test(body) && !isSpecLine(body)){
      const name=itemNameFromLine(body); if(name)push({product:name,qty:q.qty,unit:q.unit||'Nos',price:priceOf(body),spec:inlineSpecs(body),category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(body)});
    }
  }
  flushSection();
  // Final quantity-row safety pass. This catches unusual product names (e.g. "Industrial barcode labels")
  // without turning pure specifications into products. The earlier section-aware pass still has priority.
  for(const line of rawLines){
    if(isSectionHeading(line) || /^\s*[-–—•*]?\s*(?:height|depth|length|width|size|load|capacity|pressure|type|power|voltage|phase|material|make|brand|model|battery|lift height|fork length|wheel material|platform|approx(?:imate)?|actual|exact|preferred|minimum|maximum|working|backup|attachment|shelf|levels?|positions?|dimension|dimensions|rating|connection|thread|warranty|certificate|standard|payment|delivery|gst|transportation|freight|installation|amc)\b/i.test(line)) continue;
    const body=stripBullet(line); const q=parseQuantity(body); if(q.qty==null) continue;
    if(/^(?:hand pallet trucks?|platform trolley)$/i.test(section)) continue;
    if(META_LINE_RE.test(body)) continue;
    const name=itemNameFromLine(body);
    if(!name || isSpecLine(name) || !productLooksReal(name) || seen.has(itemKey(name))) continue;
    if(/^(?:do not include|please provide|please quote|please mention|please share|we need three separate totals|item-wise|gst should|our preferred|quantities mentioned|some electrical|main material|we expect)\b/i.test(name)) continue;
    // Skip technical measurement-only fragments.
    if(/^(?:\d+(?:\.\d+)?\s*(?:kg|ton|tons|hp|bar|v|volt|volts|kw|kva|hz|mm|cm|ltr|litre|liter|litres|liters|m|meter|metre|meters|metres)\b)/i.test(name)) continue;
    push({product:name,qty:q.qty,unit:q.unit||'Nos',price:priceOf(body),spec:inlineSpecs(body),category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(body)});
  }
  // Solar options: create only the explicit optional options, never the sentence telling us not to include them.
  const solar=[...text.matchAll(/(?:^|\n)\s*[-–—•*]+\s*(\d+)\s*kW\s+on-grid\s+solar\s+system\s*$/gim)];
  solar.forEach(m=>{push({product:`${m[1]} kW On-grid Solar System`,qty:1,unit:'system',spec:'Optional solar requirement',category:'Optional Solar Requirement',optional:true})});
  // If a section has a title but no explicit product row, preserve it as a clean section-level request.
  if(!items.length){push({product:'Requested goods / services',qty:null,unit:'',spec:'Please review and price the customer requirements.',category:'Required Items'});}
  items.forEach(x=>{if(/^MS Storage Racks$/i.test(x.category) && /\brack\b/i.test(x.product))x.product='MS Storage Racks';});
  return items.filter((x,i,a)=>a.findIndex(y=>itemKey(y.product)===itemKey(x.product))===i);
}

function decodeEntities(s){return String(s||'').replace(/&#x20;|&#32;|&nbsp;/gi,' ').replace(/&#x0A;|&#10;/gi,'\n').replace(/&amp;/gi,'&').replace(/&ndash;/gi,'–').replace(/&mdash;/gi,'—').replace(/&quot;/gi,'\"').replace(/&#39;/g,"'");}
function normalizeRaw(s){return decodeEntities(String(s||'')).replace(/\r\n/g,'\n').replace(/\n/g,'\n').replace(/\r/g,'').trim();}
function cleanProductName(s){let t=clean(s).replace(/[.!,;:]+$/,'').trim();t=t.replace(/^(?:hi\s+team[,!]?\s*)?(?:please\s+)?(?:we\s+)?(?:need|require|required|want|would\s+like|looking\s+for)\s+(?:a|an|the)\s+/i,'');t=t.replace(/^(?:quotation|quote)\s+(?:for|of)\s+/i,'');t=t.replace(/^(?:also\s+need|also\s+require|also\s+want)\s+/i,'');return t.trim();}

function extractNaturalLanguageItems(raw){
  const text=normalizeRaw(raw);
  const ls=lines(text);
  const out=[];
  const add=(obj)=>{
    if(!obj||!obj.product)return;
    const product=cleanProductName(obj.product);
    if(!product || product.length>120)return;
    const key=itemKey(product);
    const ex=out.find(x=>itemKey(x.product)===key);
    if(ex){
      if(ex.qty==null&&obj.qty!=null)ex.qty=obj.qty;
      if(!ex.unit&&obj.unit)ex.unit=obj.unit;
      if(obj.spec)ex.spec=clean([ex.spec,obj.spec].filter(Boolean).join(' · '));
      return;
    }
    out.push({product,qty:obj.qty??null,unit:obj.unit||'',price:obj.price??null,spec:clean(obj.spec||''),category:obj.category||'Required Items',optional:!!obj.optional,approximate:!!obj.approximate,kind:obj.kind||'item'});
  };

  // Natural-language lead item: "we need quotation for 50 HP Industrial Air Compressor..."
  // Only accept it when the captured phrase contains a concrete product noun and a technical/commercial cue,
  // so generic phrases like "quotation for material handling equipment" are not turned into products.
  const lead=/\b(?:need|require|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\s+for\s+(.+?)(?=\s+for\s+our\b|\s+required\s+quantity\b|\s+quantity\s*[:=\-]|[.!?]\s|\n)/i.exec(text);
  if(lead){
    let name=cleanProductName(lead[1]);
    const concrete=/\b(?:compressor|valve|pump|motor|generator|transformer|boiler|chiller|dryer|tank|vessel|machine|equipment|forklift|racking|rack|printer|scanner|camera|cable|switch|fan|socket|trolley|truck|gauge|filter|sensor|panel|battery|charger|pipe|fitting|flange|seal|hose|actuator|regulator|instrument)\b/i.test(name);
    const generic=/^(?:material handling equipment|storage system|some electrical items|goods|services|products|requirements?)$/i.test(name);
    if(concrete&&!generic){
      const q=/\brequired\s+quantity\s*[:=\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?)?/i.exec(text);
      const spec=[];
      for(const l of ls){
        if(/^(?:make|brand|model|capacity|pressure|type|power\s+supply|power|voltage|phase|frequency|size|grade|material|dimensions?|height|depth|length|width|weight|rating|connection|thread)\s*[:\-]/i.test(l)) spec.push(clean(l));
      }
      add({product:name,qty:q?Number(String(q[1]).replace(/,/g,'')):null,unit:q?(q[2]||'Nos').replace(/\.$/,''):'',spec:spec.join(' · '),category:'Required Items'});
    }
  }

  // "Also need A – 1 No and B suitable for A – 1 No."
  const additional=/\b(?:also\s+need|also\s+require|also\s+want)\s+(.+?)(?=\n\s*(?:please|delivery|regards|contact)|$)/is.exec(text);
  if(additional){
    const body=additional[1].replace(/\s+/g,' ').trim();
    const re=/(.+?)\s*[–—-]\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?)\b/gi;
    let m;
    while((m=re.exec(body))){
      let name=cleanProductName(m[1]);
      name=name.replace(/^and\s+/i,'').replace(/\s+and\s*$/i,'').trim();
      // Remove accidental leading prose from the first additional item.
      name=name.replace(/^.*?\b(?:also\s+need|also\s+require|also\s+want)\s+/i,'').trim();
      if(name && !/^(?:please|kindly|we|our|the|a|an)$/i.test(name)){
        let spec='';
        const suitable=name.match(/\s+(suitable\s+for\s+.+)$/i);
        if(suitable){spec=suitable[1];name=name.slice(0,suitable.index).trim();}
        const cap=name.match(/\s+(\d+(?:\.\d+)?\s*(?:ltr|litre|litres|liter|liters|kg|kgs|mm|cm|m)\b)/i);
        if(cap){spec=clean([spec,cap[1]].filter(Boolean).join(' · '));name=name.slice(0,cap.index).trim();}
        add({product:name,qty:Number(String(m[2]).replace(/,/g,'')),unit:m[3].replace(/\.$/,''),spec,category:'Required Items'});
      }
    }
  }
  return out;
}
function mergeParsedItems(primary, secondary){
  const all=[...primary];
  for(const it of secondary){
    const key=itemKey(it.product);
    const ex=all.find(x=>itemKey(x.product)===key);
    if(ex){
      if(ex.qty==null&&it.qty!=null)ex.qty=it.qty;
      if(!ex.unit&&it.unit)ex.unit=it.unit;
      if(it.spec)ex.spec=clean([ex.spec,it.spec].filter(Boolean).join(' · '));
      if(it.price!=null&&ex.price==null)ex.price=it.price;
      continue;
    }
    // Reject known parser fallback placeholders when real natural items exist.
    if(/^requested goods \/ services$/i.test(it.product)) continue;
    all.push(it);
  }
  return all;
}
function universalParseItems(raw){
  const text=normalizeRaw(raw);
  const ls=lines(text);
  const items=[];
  let section='Required Items', optional=false, current=null;
  const key=s=>cleanProductName(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const add=(o)=>{
    if(!o||!o.product)return;
    const product=cleanProductName(o.product).replace(/\s+/g,' ').trim();
    if(!product || product.length>140 || /^(?:customer|team|quotation|quote|requirements?|goods|services|delivery|payment|gst|transportation|installation|warranty|time|today|please|thanks|regards)$/i.test(product))return;
    const k=key(product);
    const ex=items.find(x=>key(x.product)===k);
    if(ex){
      if(ex.qty==null&&o.qty!=null)ex.qty=o.qty;
      if(!ex.unit&&o.unit)ex.unit=o.unit;
      if(o.spec)ex.spec=clean([ex.spec,o.spec].filter(Boolean).join(' · '));
      if(ex.price==null&&o.price!=null)ex.price=o.price;
      if(o.optional)ex.optional=true;
      return ex;
    }
    const it={product,qty:o.qty??null,unit:o.unit||'',price:o.price??null,spec:clean(o.spec||''),category:o.category||section,optional:o.optional??optional,approximate:!!o.approximate,kind:o.kind||'item'};
    items.push(it); current=it; return it;
  };
  const isCommercial=(s)=>/^(?:please|kindly|need|require|required|want|we|our|you|your|also|share|send|provide|include|mention|confirm|delivery|payment|gst|tax|transport|freight|installation|warranty|regards|thanks|important|commercial|preferred payment|please provide|please share|if you|however|do not|don't)\b/i.test(clean(s));
  const looksProduct=(s)=>{
    const t=cleanProductName(s); if(!t||t.length<2||t.length>140)return false;
    if(/^(?:nos?|pcs?|pieces?|units?|unit|sets?|model|models?|time|day|days|price|rate)$/i.test(t))return false;
    if(isCommercial(t) && !PRODUCT_NOUN_RE.test(t))return false;
    return /[A-Za-z]/.test(t);
  };
  const stripQty=(s)=>clean(s)
    .replace(/(?:^|\s)(?:qty|quantity|required\s+quantity|order\s+qty)\s*[:=\-]?\s*\d[\d,]*(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr)?/ig,' ')
    .replace(/(?:^|[\s,;–—-])(?:approx(?:imately)?|around|about|~)?\s*\d[\d,]*(?:\.\d+)?\s*(?:nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft)\b/ig,' ')
    .replace(/\s+/g,' ').trim();
  const parseRow=(line)=>{
    let s=stripBullet(line).replace(/^\d+[.)]\s*/,'').trim();
    let q=parseQuantity(s);
    let m=s.match(/^(.*?)\s*(?:[-–—:]\s*)?(?:qty|quantity|required\s+quantity)\s*[:=\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft)?\b(.*)$/i);
    if(m){const name=cleanProductName(m[1]); return {name,qty:+m[2].replace(/,/g,''),unit:(m[3]||'Nos').replace(/\.$/,''),spec:clean(m[4]||''),price:priceOf(line)};}
    m=s.match(/^(?:approx(?:imately)?|around|about|~)?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft)\b\s*(?:of\s+)?(.+)$/i);
    if(m){let name=cleanProductName(m[3]); return {name,qty:+m[1].replace(/,/g,''),unit:m[2].replace(/\.$/,''),spec:'',price:priceOf(line)};}
    // Common RFQ shorthand: quantity directly before the product with no "Nos/Pcs" unit, e.g.
    // "20 Workstations", "80 Ergonomic chairs", "4 Executive desks + chairs".
    m=s.match(/^(?:[-–—]\s*)?(?:approx(?:imately)?|around|about|~)?\s*(\d[\d,]*(?:\.\d+)?)\s+([A-Za-z][A-Za-z0-9 /+&().#'\-]{1,120}?)(?:\s+[-–—:]\s+(.+))?$/i);
    if(m && !/^(?:hp|bar|v|volt|volts|kw|kva|hz|mm|cm|inch|in|kg|kgs|ltr|litre|liter|litres|liters|m|meter|metre|meters|metres|ton|tons|sq\.?\s*ft|sqft)\b/i.test(m[2])){
      const name=cleanProductName(m[2]);
      if(looksProduct(name)) return {name,qty:+m[1].replace(/,/g,''),unit:'Nos',spec:clean(m[3]||''),price:priceOf(line)};
    }
    m=s.match(/^(.*?)\s*[-–—]\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?|pairs?|packs?|boxes?|bottles?|positions?|meters?|metres?|mtrs?|m|kg|kgs|litres?|liters?|ltr|sq\.?\s*ft|sqft)\b\s*(?:[-–—:]\s*(.*))?$/i);
    if(m){return {name:cleanProductName(m[1]),qty:+m[2].replace(/,/g,''),unit:m[3].replace(/\.$/,''),spec:clean(m[4]||''),price:priceOf(line)};}
    if(q.qty!=null){const name=cleanProductName(stripQty(s)); return {name,qty:q.qty,unit:q.unit||'Nos',spec:'',price:priceOf(line)};}
    return null;
  };
  // First pass: bullet/numbered item rows. A row is an item only when it contains an explicit order quantity.
  for(let i=0;i<ls.length;i++){
    const line=ls[i];
    const heading=line.match(/^\d+[.)]\s*([^:]+):?$/);
    if(heading && !parseQuantity(line).qty && !/\b(?:nos?|pcs?|units?|kg|meter|metre|ton|price|rate)\b/i.test(heading[1])){
      const h=clean(heading[1]);
      if(/^(?:commercial requirements?|delivery locations?|important)$/i.test(h)){section=h;optional=false;current=null;continue;}
      section=h; optional=/\boptional\b|solar/i.test(h); current=null; continue;
    }
    const bullet=/^(?:[-–—•*]|\d+[.)])\s+/.test(line);
    const startsSpec=/^(?:make|brand|model|capacity|pressure|type|power supply|power|voltage|phase|frequency|size|grade|material|dimensions?|height|depth|length|width|weight|rating|connection|thread|load|lift height|fork length|wheel material|battery|attachment|shelf|levels?|positions?|backup|working|colour|color|with|including|includes|preferred|minimum|maximum|exact|actual|suitable|side shift|solid tyres?|mesh back|adjustable|partitions?|cable management|seater)\s*[:\-]?/i.test(line);
    // Item rows do not have to use bullets. Many RFQs use simple shorthand such as
    // "20 Workstations" or "4 Executive desks + chairs". Only parse rows beginning
    // with a quantity, and never treat a technical/specification label as a product.
    if((bullet || /^\d[\d,]*(?:\.\d+)?\s+/.test(line)) && !startsSpec){
      const row=parseRow(line);
      if(row && row.name && looksProduct(row.name)){
        const it=add({product:row.name,qty:row.qty,unit:row.unit,price:row.price,spec:row.spec,category:section,optional,approximate:/\b(?:approx|around|about|~)\b/i.test(line)});
        current=it; continue;
      }
    }
    // Non-bullet compact item rows, e.g. "Product: X | Qty: 5".
    if(/^(?:product|item|description)\s*:/i.test(line)){
      const row=parseRow(line); if(row&&row.qty!=null&&looksProduct(row.name)){current=add({product:row.name,qty:row.qty,unit:row.unit,price:row.price,spec:row.spec,category:section,optional});continue;}
    }
    // Specification/continuation lines attach to the current item, never become products.
    const proseContinuation=/^(?:also|please|kindly|need|require|required|want|we|our|if|however|share|send|provide|quote|quotation|do not|don't)\b/i.test(stripBullet(line));
    if(current && !proseContinuation && (/^(?:make|brand|model|capacity|pressure|type|power supply|power|voltage|phase|frequency|size|grade|material|dimensions?|height|depth|length|width|weight|rating|connection|thread|load|lift height|fork length|wheel material|battery|attachment|shelf|levels?|positions?|backup|working|colour|color|with|including|includes|preferred|minimum|maximum|exact|actual|suitable|side shift|solid tyres?|mesh back|adjustable|partitions?|cable management|seater)\b/i.test(stripBullet(line)) || /(?:\b(?:hp|bar|volt|voltage|mm|cm|inch|kg|ltr|litre|meter|metre|ton|capacity|pressure|height|depth|length|width|load|phase|seater|shelf|level|position|backup|battery|power|material|grade|size|dimension|model|make|brand|rating|channel|tb|port|poe|cat6|mp)\b)/i.test(line))){
      current.spec=clean([current.spec,stripBullet(line)].filter(Boolean).join(' · '));
    }
  }
  // Section-level requirements: some RFQs give the product as a heading and the quantity inside a later line,
  // e.g. "Pallet Racking" followed by "Approx 180 pallet positions initially" or "MS Storage Racks" followed by
  // "approx 25 nos". Convert that section into one clean item without turning dimensions into quantities.
  if(section !== 'Required Items' || ls.some(l=>/^\d+[.)]\s*/.test(l))){
    const sectionItems=[];
    // Reconstruct simple numbered sections from the raw lines. This pass is deliberately conservative.
    let sec='Required Items', secOptional=false, secLines=[];
    const flush=()=>{
      const title=sec.replace(/^\d+[.)]\s*/,'').trim();
      if(title && !/^(?:commercial requirements?|delivery locations?|important)$/i.test(title)){
        const qLine=secLines.find(x=>/(?:approx(?:imately)?|around|about|quantity|qty|required|need|nos?\.?|pcs?\.?|positions?|meters?|metres?|ltr|litres?)/i.test(x) && parseQuantity(x).qty!=null);
        if(qLine && !secLines.some(x=>cleanProductName(x)===title)){
          const q=parseQuantity(qLine);
          if(q.qty!=null && !/^(?:height|depth|length|width|size|load|capacity|pressure|power|voltage|phase|material|make|brand|model|type|rating)\b/i.test(qLine)){
            const existing=items.find(x=>key(x.product)===key(title));
            if(!existing && !items.some(x=>String(x.category||'').toLowerCase()===String(title).toLowerCase()) && looksProduct(title)) add({product:title,qty:q.qty,unit:q.unit||'Nos',spec:secLines.filter(x=>x!==qLine && !/^(?:please|kindly|if you|we have|actual usable|delivery|commercial|important)\b/i.test(x)).map(Ustrip).join(' · '),category:title,optional:secOptional,approximate:/\b(?:approx|around|about|~)\b/i.test(qLine)});
          }
        }
      }
    };
    for(const l of ls){
      const h=l.match(/^(\d+)[.)]\s*([^:]+):?$/);
      if(h && !parseQuantity(l).qty && !/\b(?:nos?\.?|pcs?\.?|units?|kg|meter|metre|ton|price|rate)\b/i.test(h[2])){flush();sec=h[1]+') '+h[2];secOptional=/\boptional\b|solar/i.test(sec);secLines=[];continue;}
      secLines.push(l);
    }
    flush();
  }
  // Natural-language lead product with a later explicit quantity.
  const lead=/\b(?:need|require|want|would\s+like)\s+(?:a\s+)?(?:quotation|quote)\s+for\s+(.+?)(?=\s+for\s+our\b|\s+required\s+quantity\b|\s+quantity\s*[:=\-]|[.!?]\s|\n)/i.exec(text);
  if(lead){
    const name=cleanProductName(lead[1]);
    const qm=text.match(/(?:required\s+quantity|quantity|qty)\s*[:=\-]?\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?)?/i);
    if(qm && looksProduct(name)){
      const specs=ls.filter(l=>/^(?:make|brand|model|capacity|pressure|type|power supply|power|voltage|phase|frequency|size|grade|material|dimensions?|height|depth|length|width|weight|rating|connection|thread)\s*[:\-]/i.test(l));
      add({product:name,qty:+qm[1].replace(/,/g,''),unit:qm[2]||'Nos',spec:specs.join(' · '),category:'Required Items'});
    }
  }
  // "Also need A – 1 No and B – 1 No". Split at each explicit quantity delimiter.
  const addMatch=/\b(?:also\s+need|also\s+require|also\s+want)\s+(.+?)(?=\n\s*(?:please|delivery|regards|contact)|$)/is.exec(text);
  if(addMatch){
    const body=addMatch[1].replace(/\s+/g,' ').trim();
    const re=/(?:^|\s)(?:and\s+)?(.+?)\s*[-–—:]\s*(\d[\d,]*(?:\.\d+)?)\s*(nos?\.?|pcs?\.?|pieces?|units?|sets?)\b/gi;
    let m;
    while((m=re.exec(body))){
      let name=cleanProductName(m[1]).replace(/^and\s+/i,'').trim();
      let spec='';
      const suitable=name.match(/\s+(suitable\s+for\s+.+)$/i); if(suitable){spec=suitable[1];name=name.slice(0,suitable.index).trim();}
      const cap=name.match(/\s+(\d[\d,]*(?:\.\d+)?\s*(?:ltr|litre|liter|litres|liters|kg|kgs|mm|cm|m)\b)/i); if(cap){spec=clean([spec,cap[1]].filter(Boolean).join(' · '));name=name.slice(0,cap.index).trim();}
      if(looksProduct(name))add({product:name,qty:+m[2].replace(/,/g,''),unit:m[3].replace(/\.$/,''),spec,category:'Required Items'});
    }
  }
  // Optional item without a quantity: keep it as a separate line, never in the main total.
  const opt=/\bquote\s+(?:an\s+)?optional\s+(.+?)(?=\.|\n|$)/i.exec(text);
  if(opt){let name=cleanProductName(opt[1]).replace(/\s+separately.*$/i,'').replace(/\s+model$/i,' model').trim();if(looksProduct(name))add({product:name,qty:1,unit:'model',spec:'Optional; quote separately and exclude from main total',category:'Optional Items',optional:true});}
  // Explicitly requested service charges become separate service lines. They have no fabricated prices.
  if(/\btransport(?:ation)?\b|\bfreight\b/i.test(text))add({product:'Transportation / Freight',qty:1,unit:'Lump sum',price:null,spec:'Quote separately',category:'Installation + Transportation + Other Services',kind:'service'});
  if(/\binstallation\b/i.test(text))add({product:'Installation / Commissioning',qty:1,unit:'Lump sum',price:null,spec:'Quote separately',category:'Installation + Transportation + Other Services',kind:'service'});
  if(/\bloading\s*\/?\s*unloading\b/i.test(text))add({product:'Loading / Unloading',qty:1,unit:'Lump sum',price:null,spec:'If applicable, quote separately',category:'Installation + Transportation + Other Services',kind:'service'});
  return items;
}
function parseItems(raw){return universalParseItems(raw)}

function parseEnquiry(raw){
  const text=normalizeRaw(raw); const ls=lines(text);
  const customer=customerOf(text,ls);
  const delivery=locationOf(text)||'To be confirmed';
  const payment=paymentOf(text)||'To be confirmed';
  const includeGst=/\b(?:include|mention|add|plus|with)\s+(?:gst|igst|cgst|sgst)|\bgst\s+(?:separately|applicable|extra|18%)|\b(?:gst|igst|cgst|sgst)\b/i.test(text);
  const gstMatch=text.match(/\b(?:gst|igst)\s*(?:@|of|at)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const extra=extractCommercial(text);
  const services=[];
  // parseItems already adds explicit services; do not duplicate them here.
  const items=parseItems(text);
  return {customer,delivery,payment,items,includeGst,gstRate:gstMatch?Number(gstMatch[1]):null,extra,raw:text};
}


// ---------------- Quote editor UI ----------------
const state = {
  quoteItems: [],
  meta: {customer:'Customer', delivery:'To be confirmed', payment:'To be confirmed', gst:null, includeGst:true, extra:''},
  company: {name:'YOUR COMPANY', address:'Ahmedabad, Gujarat', email:'hello@company.com', quoteNo:'', validUntil:'04 Nov 2026', title:'QUOTATION'},
  footer: {note:'Thank you for your business.', signatory:'Authorised Signatory'}
};

const money2 = n => Number.isFinite(Number(n)) && Number(n) > 0 ? '₹'+Number(n).toLocaleString('en-IN',{maximumFractionDigits:2}) : 'To be quoted';
function toast(msg){const t=$('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),2400)}
function groupFor(it){return it.optional?'OPTIONAL ITEMS':it.kind==='service'?'INSTALLATION + TRANSPORTATION + OTHER SERVICES':(it.category||'REQUIRED ITEMS').toUpperCase()}
function makeItem(product='New item',opts={}){return {product,qty:null,unit:'Nos',price:null,spec:'',optional:!!opts.optional,kind:opts.kind||'item',category:opts.optional?'Optional Items':opts.kind==='service'?'Installation + Transportation + Other Services':'Required Items',approximate:false}}
function syncMetaFromPaper(){
  document.querySelectorAll('[data-bind]').forEach(el=>{
    const key=el.dataset.bind; const value=el.textContent.trim();
    if(['customer','delivery','payment'].includes(key)) state.meta[key]=value;
    else if(key==='companyName')state.company.name=value;
    else if(key==='companyAddress')state.company.address=value;
    else if(key==='companyEmail')state.company.email=value;
    else if(key==='quoteNo')state.company.quoteNo=value;
    else if(key==='validUntil')state.company.validUntil=value;
    else if(key==='quoteTitle')state.company.title=value;
    else if(key==='footerNote')state.footer.note=value;
    else if(key==='signatory')state.footer.signatory=value;
  });
}
function bindStaticPaper(){
  document.querySelectorAll('[data-bind]').forEach(el=>{
    el.addEventListener('input',()=>{syncMetaFromPaper(); refreshPreview()});
    el.addEventListener('blur',()=>{syncMetaFromPaper(); refreshPreview()});
  });
  $('gstInline').addEventListener('input',e=>{state.meta.gst=Number(e.target.value)||null; state.meta.includeGst=Boolean(e.target.value); refreshPreview()});
}
function renderQuoteRows(){
  const tbody=$('quoteBody'); if(!tbody)return;
  let last='';
  tbody.innerHTML=state.quoteItems.map((it,i)=>{
    const group=groupFor(it); let section='';
    if(group!==last){last=group; section=`<tr class="section-row"><td colspan="5">${esc(group)}</td></tr>`}
    const amount=Number(it.price)>0&&Number(it.qty)>0?money2(Number(it.price)*Number(it.qty)):'To be quoted';
    return section+`<tr class="quote-item-row" data-index="${i}">
      <td><div class="desc-wrap"><input class="q-input q-product" data-field="product" value="${esc(it.product)}"><textarea class="q-input q-spec" data-field="spec" rows="1" placeholder="Specifications / notes">${esc(it.spec||'')}</textarea></div></td>
      <td><input class="q-input q-qty" data-field="qty" inputmode="decimal" value="${it.qty??''}" placeholder="—"><span class="q-uom"><input class="q-input q-unit" data-field="unit" value="${esc(it.unit||'')}" placeholder="UOM"></span></td>
      <td><input class="q-input q-price" data-field="price" inputmode="decimal" value="${it.price??''}" placeholder="To be quoted"></td>
      <td class="amount-cell">${amount}</td>
      <td class="action-col"><button class="row-remove" data-remove-row="${i}" title="Remove item">×</button></td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.q-input').forEach(el=>el.addEventListener('input',()=>{
    const row=el.closest('.quote-item-row'); const i=Number(row.dataset.index); const f=el.dataset.field;
    state.quoteItems[i][f]=(f==='qty'||f==='price')?(el.value===''?null:Number(el.value)):el.value;
    if(f==='qty'||f==='price'){ const it=state.quoteItems[i]; row.querySelector('.amount-cell').textContent=Number(it.price)>0&&Number(it.qty)>0?money2(Number(it.price)*Number(it.qty)):'To be quoted'; }
    renderMobileQuoteItems(); refreshPreview(false);
  }));
  tbody.querySelectorAll('[data-remove-row]').forEach(btn=>btn.onclick=()=>removeItem(Number(btn.dataset.removeRow)));
  renderMobileQuoteItems();
}
function removeItem(i){ if(!Number.isInteger(i)||!state.quoteItems[i])return; state.quoteItems.splice(i,1); renderQuoteRows(); refreshPreview(false); toast('Item removed'); }
function renderMobileQuoteItems(){
  const host=$('mobileQuoteItems'); if(!host)return;
  let last='';
  host.innerHTML=state.quoteItems.map((it,i)=>{
    const group=groupFor(it); let section=''; if(group!==last){last=group; section=`<div class="mobile-group-title">${esc(group)}</div>`;}
    const amount=Number(it.price)>0&&Number(it.qty)>0?money2(Number(it.price)*Number(it.qty)):'To be quoted';
    return section+`<article class="mobile-item-card" data-mobile-index="${i}">
      <div class="mobile-item-main"><div><small>${it.optional?'OPTIONAL':it.kind==='service'?'SERVICE':'ITEM'}</small><h4>${esc(it.product||'Untitled item')}</h4><p>${esc(it.spec||'No specifications added')}</p></div><button class="mobile-edit-btn" data-mobile-edit="${i}">Edit</button></div>
      <div class="mobile-item-meta"><span><small>QTY</small><b>${it.qty??'—'} ${esc(it.unit||'')}</b></span><span><small>UNIT PRICE</small><b>${Number(it.price)>0?money2(it.price):'To be quoted'}</b></span><span><small>AMOUNT</small><b>${amount}</b></span></div>
    </article>`;
  }).join('') || `<div class="mobile-empty">No items yet. Add an item below.</div>`;
  host.querySelectorAll('[data-mobile-edit]').forEach(b=>b.onclick=()=>openMobileEditor(Number(b.dataset.mobileEdit)));
}
let mobileEditIndex=null;
function openMobileEditor(i){
  const it=state.quoteItems[i]; if(!it)return; mobileEditIndex=i;
  $('mProduct').value=it.product||''; $('mSpec').value=it.spec||''; $('mQty').value=it.qty??''; $('mUnit').value=it.unit||'Nos'; $('mPrice').value=it.price??'';
  $('mobileEditTitle').textContent=it.product||'Edit item'; $('mobileEdit').classList.add('open'); $('mobileEdit').setAttribute('aria-hidden','false'); document.body.classList.add('sheet-open');
}
function closeMobileEditor(){mobileEditIndex=null;$('mobileEdit').classList.remove('open');$('mobileEdit').setAttribute('aria-hidden','true');document.body.classList.remove('sheet-open');}
function saveMobileEditor(){
  if(mobileEditIndex==null)return; const it=state.quoteItems[mobileEditIndex];
  it.product=$('mProduct').value.trim()||'Untitled item'; it.spec=$('mSpec').value.trim(); it.qty=$('mQty').value===''?null:Number($('mQty').value); it.unit=$('mUnit').value.trim()||'Nos'; it.price=$('mPrice').value===''?null:Number($('mPrice').value);
  closeMobileEditor(); renderQuoteRows(); refreshPreview(false); toast('Item updated');
}

function refreshPreview(renderRows=true){
  if(renderRows)renderQuoteRows();
  syncMetaFromPaper();
  $('pMainSubtotal').textContent=pricedSum(x=>!x.optional&&x.kind!=='service')||'To be quoted';
  $('pOptionalSubtotal').textContent=pricedSum(x=>x.optional)||'To be quoted';
  $('pServiceSubtotal').textContent=pricedSum(x=>x.kind==='service')||'To be quoted';
  const sub=pricedNumber(x=>true); $('pSubtotal').textContent=sub?money2(sub):'To be quoted';
  const rate=Number(state.meta.gst); const gst=state.meta.includeGst&&rate>0&&sub?sub*rate/100:0;
  $('pGst').textContent=state.meta.includeGst?(rate>0?(sub?money2(gst):'—'):'As applicable'):'Not included';
  $('pTotal').textContent=sub?(rate>0||!state.meta.includeGst?money2(sub+gst):'Subtotal + GST as applicable'):'To be quoted';
  $('pTerms').textContent=$('pTerms').textContent.trim()||'Prices are subject to confirmation.';
  updateInsights();
}
function pricedNumber(filter){return state.quoteItems.filter(x=>Number(x.price)>0&&Number(x.qty)>0).filter(filter).reduce((a,x)=>a+Number(x.price)*Number(x.qty),0)}
function pricedSum(filter){const n=pricedNumber(filter);return n?money2(n):''}
function updateInsights(){
  const items=state.quoteItems.filter(x=>!x.optional&&x.kind!=='service').length;
  const optional=state.quoteItems.filter(x=>x.optional).length;
  const services=state.quoteItems.filter(x=>x.kind==='service').length;
  $('insightItems').textContent=items; $('insightOptional').textContent=optional; $('insightServices').textContent=services;
  $('insightCommercial').textContent=(state.meta.payment!=='To be confirmed'||state.meta.delivery!=='To be confirmed'||state.meta.extra)?'Detected':'None';
  $('itemSummary').textContent=`${state.quoteItems.length} line item${state.quoteItems.length===1?'':'s'} · edit directly on the quotation`;
}
function setPaperMeta(){
  const map={quoteTitle:state.company.title,quoteNo:state.company.quoteNo,companyName:state.company.name,companyAddress:state.company.address,companyEmail:state.company.email,customer:state.meta.customer,delivery:state.meta.delivery,payment:state.meta.payment,validUntil:state.company.validUntil,footerNote:state.footer.note,signatory:state.footer.signatory};
  Object.entries(map).forEach(([k,v])=>{const el=document.querySelector(`[data-bind="${k}"]`);if(el)el.textContent=v||''});
  $('pDate').textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  $('gstInline').value=state.meta.gst??'';
  if(!$('pTerms').textContent.trim())$('pTerms').textContent='Prices are exclusive of GST unless stated otherwise. Delivery and payment terms are as agreed.';
}
function fillData(data){
  state.quoteItems=(data.items||[]).filter(Boolean).map(x=>({...x,category:x.category||'Required Items'}));
  if(!state.quoteItems.length)state.quoteItems=[makeItem('Requested item')];
  state.meta={customer:data.customer||'Customer',delivery:data.delivery||'To be confirmed',payment:data.payment||'To be confirmed',gst:data.gstRate??null,includeGst:Boolean(data.includeGst),extra:data.extra||''};
  state.company.quoteNo='QTN-'+new Date().getFullYear()+'-'+String(Math.floor(1000+Math.random()*9000));
  const terms=$('pTerms');
  const parts=['Prices are exclusive of GST unless stated otherwise. Basic item prices are shown before GST.'];
  if(state.meta.payment!=='To be confirmed')parts.push('Payment: '+state.meta.payment+'.');
  if(state.meta.delivery!=='To be confirmed')parts.push('Delivery: '+state.meta.delivery+'.');
  if(state.meta.extra)parts.push(state.meta.extra+'.');
  parts.push('Warranty, delivery time, quotation validity, exclusions, assumptions and site requirements should be confirmed in the final commercial offer.');
  terms.textContent=parts.join(' ');
  setPaperMeta(); renderQuoteRows(); refreshPreview(false);
}
function addLine(opts={}){
  state.quoteItems.push(makeItem(opts.product||'New item',opts));
  renderQuoteRows(); refreshPreview(false);
  const last=document.querySelector('.quote-item-row:last-of-type'); if(last){const input=last.querySelector('.q-product'); if(input){input.focus();input.select()}}
}
function loadSample(){
  $('enquiry').value=`Hi, please share quotation for our new office setup:\n\n- 20 Workstations – 4-seater, with partitions & cable management\n- 80 Ergonomic chairs – mesh back, adjustable\n- 4 Executive desks + chairs\n- 2 Conference tables – 12 seater\n- 30 Visitor chairs\n- 10 Storage cabinets\n- 2 Reception counters\n\nNeed delivery + installation at Ahmedabad. Please give item-wise basic price, GST separately, transportation, installation, warranty and delivery timeline.\n\nAlso quote an optional premium chair model separately; don't include it in the main total.\n\nPayment: 30% advance, balance after installation.\nPlease provide best final price with quotation validity.`;
  toast('Sample enquiry loaded');
}
function printOnlyQuotation(){
  document.body.classList.add('printing');
  setTimeout(()=>window.print(),40);
  setTimeout(()=>document.body.classList.remove('printing'),1000);
}
function saveQuote(){
  syncMetaFromPaper();
  const priced=pricedNumber(x=>true);
  const saved={id:state.company.quoteNo,date:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}),customer:state.meta.customer,amount:priced?money2(priced):'To be quoted',items:state.quoteItems.length,status:'Draft',snapshot:JSON.parse(JSON.stringify(state))};
  const all=JSON.parse(localStorage.getItem('quotegen_quotes')||'[]').filter(x=>x.id!==saved.id);
  all.unshift(saved); localStorage.setItem('quotegen_quotes',JSON.stringify(all.slice(0,25)));
  renderDashboard(); toast('Quotation saved successfully');
}
function renderDashboard(){
  const body=$('recentBody'); if(!body)return;
  const defaults=[{id:'QTN-2026-0128',date:'05 Oct 2026',customer:'ABC Industries',amount:'₹36,875',status:'Sent'},{id:'QTN-2026-0127',date:'05 Oct 2026',customer:'Darshil Trading',amount:'₹82,400',status:'Draft'},{id:'QTN-2026-0126',date:'04 Oct 2026',customer:'Metro Engineering',amount:'₹1,24,780',status:'Accepted'}];
  const saved=JSON.parse(localStorage.getItem('quotegen_quotes')||'[]');
  const rows=[...saved,...defaults.filter(d=>!saved.some(s=>s.id===d.id))].slice(0,8);
  body.innerHTML=rows.map(r=>`<tr class="dashboard-row" data-open-quote="${esc(r.id)}"><td><b>${esc(r.id)}</b><small>${esc(r.date)}</small></td><td>${esc(r.customer||'Customer')}</td><td>${esc(r.amount||'To be quoted')}</td><td><span class="pill ${String(r.status).toLowerCase()}">${esc(r.status||'Draft')}</span></td><td>›</td></tr>`).join('');
  body.querySelectorAll('[data-open-quote]').forEach(row=>row.onclick=()=>openSavedQuote(row.dataset.openQuote));
}
function openSavedQuote(id){
  const saved=JSON.parse(localStorage.getItem('quotegen_quotes')||'[]').find(x=>x.id===id);
  if(!saved?.snapshot){show('builder');toast('This demo quotation is ready as a reference');return;}
  Object.assign(state,JSON.parse(JSON.stringify(saved.snapshot))); setPaperMeta(); renderQuoteRows(); refreshPreview(false); show('builder'); toast('Quotation opened');
}

// Navigation
views.forEach(v=>v.classList.toggle('active',v.id==='home'));
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>show(b.dataset.view));
$('sample').onclick=loadSample;
$('parse').onclick=()=>{
  const raw=$('enquiry').value.trim(); if(!raw){toast('Paste an enquiry first');return}
  const btn=$('parse');btn.disabled=true;btn.textContent='✨ Structuring enquiry…';
  setTimeout(()=>{try{const data=parseEnquiry(raw);fillData(data);btn.disabled=false;btn.textContent='✨ Generate quotation';toast(`Quotation generated · ${data.items.length} line items`)}catch(e){console.error(e);btn.disabled=false;btn.textContent='✨ Generate quotation';toast('Could not structure this enquiry')}} ,80);
};
$('download').onclick=printOnlyQuotation;$('save').onclick=saveQuote;
$('addItem').onclick=()=>addLine();$('paperAddItem').onclick=()=>addLine();
$('addOptional').onclick=()=>addLine({optional:true,product:'Optional item'});$('paperAddOptional').onclick=()=>addLine({optional:true,product:'Optional item'});
$('addService').onclick=()=>addLine({kind:'service',product:'Service / Other charge'});$('paperAddService').onclick=()=>addLine({kind:'service',product:'Service / Other charge'});
$('editTerms').onclick=()=>{$('pTerms').focus();toast('Edit the terms directly in the quotation')};
bindStaticPaper();

// Mobile editor
['mobileEdit'].forEach(id=>{const el=$(id); if(el)el.querySelectorAll('[data-close-mobile]').forEach(b=>b.onclick=closeMobileEditor)});
$('mDone').onclick=saveMobileEditor; $('mRemove').onclick=()=>{if(mobileEditIndex!=null){const i=mobileEditIndex;closeMobileEditor();removeItem(i)}};

// Logo system: normalize uploads so every logo keeps its real proportions, trims empty
// canvas space, and renders sharply in both the app header and quotation/PDF.
function loadImageFromData(data){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data})}
async function normalizeLogo(data){
  const img=await loadImageFromData(data);
  const maxW=1400, maxH=600;
  const scale=Math.min(1,maxW/img.naturalWidth,maxH/img.naturalHeight);
  const w=Math.max(1,Math.round(img.naturalWidth*scale)), h=Math.max(1,Math.round(img.naturalHeight*scale));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0,w,h);
  const d=ctx.getImageData(0,0,w,h).data;
  let minX=w,minY=h,maxX=-1,maxY=-1, count=0;
  // Detect visible/non-white pixels. Transparent PNGs use alpha; JPEG/white PNGs use color.
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4, a=d[i+3], r=d[i], g=d[i+1], b=d[i+2];
      const visible=a>20 && (a<245 || r<247 || g<247 || b<247 || Math.max(r,g,b)-Math.min(r,g,b)>10);
      if(visible){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);count++;}
    }
  }
  // If the artwork already fills almost the whole image, preserve the original frame.
  const fill=count/(w*h);
  const cropPossible=maxX>=0 && (maxX-minX+1)<w*0.985 && (maxY-minY+1)<h*0.985;
  if(cropPossible && fill<0.96){
    const pad=Math.max(4,Math.round(Math.max(maxX-minX+1,maxY-minY+1)*0.055));
    minX=Math.max(0,minX-pad); minY=Math.max(0,minY-pad); maxX=Math.min(w-1,maxX+pad); maxY=Math.min(h-1,maxY+pad);
    const cw=maxX-minX+1,ch=maxY-minY+1;
    const out=document.createElement('canvas');out.width=cw;out.height=ch;
    out.getContext('2d').drawImage(c,minX,minY,cw,ch,0,0,cw,ch);
    return out.toDataURL('image/png');
  }
  return c.toDataURL('image/png');
}
function setLogoImage(el,data){if(!el)return;if(data){el.src=data;el.hidden=false}else{el.removeAttribute('src');el.hidden=true}}
function applyLogo(data){
  localStorage.setItem('quotegen_logo',data||'');
  const btn=$('logoButton'), brandText=$('brandLogoText'), brandImg=$('brandLogoImage');
  const qmarks=document.querySelectorAll('.qmark');
  if(data){
    btn.classList.add('has-image'); brandText.style.display='none'; setLogoImage(brandImg,data);
    qmarks.forEach(q=>{q.classList.add('has-logo');q.querySelector('.qmark-fallback').style.display='none';setLogoImage(q.querySelector('.qmark-logo'),data)});
  }else{
    btn.classList.remove('has-image'); brandText.style.display=''; setLogoImage(brandImg,'');
    qmarks.forEach(q=>{q.classList.remove('has-logo');q.querySelector('.qmark-fallback').style.display='';setLogoImage(q.querySelector('.qmark-logo'),'')});
  }
}
function openLogoPicker(){$('logoUpload').click()}
$('logoButton').onclick=openLogoPicker; $('dashboardLogo').onclick=openLogoPicker;
$('logoUpload').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const r=new FileReader();r.onload=async()=>{try{const normalized=await normalizeLogo(r.result);applyLogo(normalized);toast('Logo updated');}catch(err){console.error(err);toast('Could not process logo')}};r.readAsDataURL(f)}catch(err){toast('Could not read logo')} e.target.value=''};
const storedLogo=localStorage.getItem('quotegen_logo');if(storedLogo)applyLogo(storedLogo);

$('dashboardSample').onclick=()=>{loadSample();show('builder')};
renderDashboard();

// Initial quote
state.quoteItems=[{product:'SS Ball Valve',qty:25,unit:'Nos',spec:'2 inch · SS304',price:1250,optional:false,kind:'item',category:'Required Items'}];
state.meta={customer:'ABC Industries',delivery:'Ahmedabad, Gujarat',payment:'50% advance',gst:18,includeGst:true,extra:''};
state.company.quoteNo='QTN-'+new Date().getFullYear()+'-0129';
setPaperMeta();renderQuoteRows();refreshPreview(false);
