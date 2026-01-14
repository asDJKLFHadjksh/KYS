// assets/pricing.js

// ===== Helpers =====
const fmtIDR = n => "IDR " + (Number(n)||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function numberWithSeparators(x){return (x??0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}
const roundToNearestThousand = n => Math.round((Number(n)||0) / 1000) * 1000;

function calcOverRatePerMin(pkg){
  const base = Number(pkg?.price) || 0;
  const percent = Number(pkg?.overRatePercentPerMin) || 0;
  return roundToNearestThousand(base * percent);
}

// Cari buffer fee sesuai durasi
function computeBufferPercent(durasi, map){
  if(!map) return 0;
  const keys = Object.keys(map).map(Number).sort((a,b)=>a-b);
  let percent = 0;
  for(const k of keys){ if(durasi > k) percent = Number(map[k])||0; }
  return percent;
}

function getDeadlineGuidance(pkg, durasi){
  const policy = pkg?.deadlinePolicy || {};
  const minRateRaw = Number(policy.minDaysPerMinute);
  const idealRateRaw = Number(policy.idealDaysPerMinute);
  const surchargePercentRaw = Number(policy.surchargePercent);

  const minRate = Number.isFinite(minRateRaw) && minRateRaw >= 0 ? minRateRaw : 1;
  const idealRate = Number.isFinite(idealRateRaw) && idealRateRaw >= 0 ? idealRateRaw : minRate;
  const surchargePercent = Number.isFinite(surchargePercentRaw) && surchargePercentRaw > 0 ? surchargePercentRaw : 0;

  const minutes = Math.max(0, Number(durasi) || 0);
  const defaultDaysRaw = minutes * minRate;
  const idealDaysRaw = minutes * idealRate;

  const defaultDays = minutes > 0 ? Math.max(1, Math.ceil(defaultDaysRaw)) : 1;
  const idealDays = minutes > 0 ? Math.max(defaultDays, Math.ceil((idealDaysRaw || defaultDaysRaw || defaultDays))) : defaultDays;

  return {
    minDaysPerMinute: minRate,
    idealDaysPerMinute: idealRate,
    surchargePercent,
    minTotalDays: defaultDaysRaw,
    idealTotalDays: idealDaysRaw,
    defaultDays,
    idealDays
  };
}

// ===== Load Config =====
async function loadConfig(basePath=".."){
  const [pricesRes, promoRes] = await Promise.allSettled([
    fetch(`${basePath}/config/prices.json?ts=${Date.now()}`).then(r=>r.json()),
    fetch(`${basePath}/config/promo.json?ts=${Date.now()}`).then(r=>r.ok?r.json():{})
  ]);
  return {
    prices: pricesRes.value || {},
    promo: promoRes.value || {}
  };
}

// ===== Diskon =====
function getFinalPrice(pkg, promo){
  const disc = promo?.discounts?.[pkg.id]?.percent || 0;
  const final = disc > 0 ? Math.round(pkg.price * (1 - disc/100)) : pkg.price;
  return { normal: pkg.price, percent: disc, final };
}

// ===== Hitung Total =====
function calcTotal(pkg, cfg, promo, durasi, deadline){
  const {normal, percent, final} = getFinalPrice(pkg, promo);

  // overtime
  const overMin = Math.max(0, durasi-5);
  const overRate = calcOverRatePerMin(pkg);
  const overCost = overMin * overRate;

  // subtotal setelah diskon + overtime
  const subTotal = final + overCost;

  const deadlineInfo = getDeadlineGuidance(pkg, durasi);
  const appliedDeadline = Math.max(
    deadlineInfo.defaultDays,
    Math.ceil(Math.max(0, Number(deadline) || 0))
  );

  const maxSurcharge = Number(deadlineInfo.surchargePercent) || 0;
  const minTotal = Number(deadlineInfo.minTotalDays);
  const idealTotal = Number(deadlineInfo.idealTotalDays);
  let surPerc = 0;

  if (maxSurcharge > 0) {
    const hasRange = Number.isFinite(minTotal) && Number.isFinite(idealTotal) && idealTotal > minTotal;
    if (!hasRange) {
      const thresholds = [];
      if (Number.isFinite(idealTotal)) thresholds.push(idealTotal);
      if (Number.isFinite(minTotal)) thresholds.push(minTotal);
      const threshold = thresholds.length ? Math.max(...thresholds) : null;
      surPerc = threshold !== null && appliedDeadline >= threshold ? 0 : maxSurcharge;
    } else if (appliedDeadline >= idealTotal) {
      surPerc = 0;
    } else {
      const ratioRaw = (appliedDeadline - minTotal) / (idealTotal - minTotal);
      const ratio = Math.max(0, Math.min(1, ratioRaw));
      surPerc = maxSurcharge * (1 - ratio);
    }
  }

  const surPercRounded = Number.isFinite(surPerc) ? Math.max(0, Math.min(maxSurcharge, parseFloat(surPerc.toFixed(2)))) : 0;
  const surchargeVal = Math.round(subTotal * (surPercRounded/100));

  // buffer fee
  const bufPerc = computeBufferPercent(durasi, cfg.bufferFee);
  const bufVal = Math.round((subTotal+surchargeVal) * (bufPerc/100));

  const total = subTotal + surchargeVal + bufVal;

  return {
    normal,                // harga asli
    discountPercent: percent,
    baseFinal: final,      // harga setelah diskon
    overMin,
    overRate,
    overCost,
    surchargeVal,
    surPerc: surPercRounded,
    bufVal,
    bufPerc,
    total,
    deadline: {
      ...deadlineInfo,
      chosenDays: appliedDeadline
    }
  };
}

// ===== Exports =====
window.Pricing = {
  fmtIDR,
  loadConfig,
  getFinalPrice,
  calcTotal,
  getDeadlineGuidance,
  calcOverRatePerMin
};
