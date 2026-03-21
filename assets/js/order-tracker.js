(() => {
  const DEFAULT_STORAGE_KEY = "order_tracker_last_input";

  let trackerState = null;

  const TIME_ZONE = "Asia/Jakarta";
  const defaultColumnIndexes = {
    title: 0,
    statusProgress: 1,
    orderDate: 2,
    finishDate: 3,
    backupExpired: 4,
    status: 5,
    projectCode: 6,
    orderCode: 7,
    revision: 8,
  };

  const statusColorMap = {
    "waiting asset": "#ff9800",
    "preparing asset": "#ffc107",
    rendering: "#2196f3",
    revision: "#9c27b0",
    payment: "#4caf50",
    approved: "#2e7d32",
    none: "#9e9e9e",
    kosong: "#9e9e9e",
    "": "#9e9e9e",
  };

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function normalizeOrderCode(value) {
    return String(value || "")
      .trim()
      .replace(/[\s\r\n]+/g, "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "");
  }

  function parseCSV(text) {
    const rows = [];
    let current = [];
    let value = "";
    let insideQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (insideQuotes && text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        current.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !insideQuotes) {
        if (char === "\r" && text[i + 1] === "\n") i++;
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      } else {
        value += char;
      }
    }
    if (value !== "" || current.length) {
      current.push(value);
      rows.push(current);
    }
    return rows
      .filter((row) => row.length && row.some((cell) => cell.trim() !== ""))
      .map((row) => row.map((cell) => cell.trim()));
  }

  function mapColumns(headerRow) {
    if (!Array.isArray(headerRow)) return null;
    const normalized = headerRow.map((cell) => String(cell || "").trim().toLowerCase());
    const findIndex = (name) => normalized.indexOf(name);
    return {
      title: findIndex("judul"),
      statusProgress: findIndex("status progres"),
      orderDate: findIndex("tanggal order"),
      finishDate: findIndex("tanggal selesai"),
      backupExpired: (() => {
        const expiredIndex = findIndex("expired backup");
        if (expiredIndex !== -1) return expiredIndex;
        return findIndex("backup expired");
      })(),
      status: (() => {
        const statusFileIndex = findIndex("status file");
        if (statusFileIndex !== -1) return statusFileIndex;
        return findIndex("status");
      })(),
      projectCode: findIndex("code projek"),
      orderCode: findIndex("code order"),
      revision: findIndex("revisi"),
    };
  }

  function getColumnIndex(columns, key) {
    const mapped = columns?.[key];
    if (typeof mapped === "number" && mapped >= 0) return mapped;
    return defaultColumnIndexes[key] ?? -1;
  }

  function getCellValue(columns, row, key) {
    const idx = getColumnIndex(columns, key);
    if (idx < 0 || idx >= row.length) return "";
    return String(row[idx] ?? "").trim();
  }

  function parseSheetDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      return new Date(Date.UTC(year, month - 1, day));
    }
    const slashMatch = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
    if (slashMatch) {
      const day = parseInt(slashMatch[1], 10);
      const month = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);
      return new Date(Date.UTC(year, month - 1, day));
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  function parseDDMMYYYY(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1000) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return null;
    }
    return date;
  }

  function formatDDMMYYYY(date) {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = String(date.getUTCFullYear());
    return `${day}/${month}/${year}`;
  }

  function parseDecodedOrderDate(value) {
    if (value === null || typeof value === "undefined") return null;
    if (typeof value === "number") {
      const ms = value < 1e12 ? value * 1000 : value;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date;
    }
    const text = String(value || "").trim();
    if (!text) return null;
    const parsed = parseSheetDate(text);
    if (parsed) return parsed;
    const fallback = new Date(text);
    if (!Number.isNaN(fallback.getTime())) return fallback;
    return null;
  }

  function formatUiDate(date) {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function formatTrackerDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "-";
    const parsedStrict = parseDDMMYYYY(raw);
    if (parsedStrict) return formatDDMMYYYY(parsedStrict);
    const compactDigits = raw.replace(/[^\d]/g, "");
    if (compactDigits.length >= 12) {
      const year = compactDigits.slice(0, 4);
      const month = compactDigits.slice(4, 6);
      const day = compactDigits.slice(6, 8);
      const hour = compactDigits.slice(8, 10);
      const minute = compactDigits.slice(10, 12);
      const second = compactDigits.length >= 14 ? compactDigits.slice(12, 14) : "00";
      return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
    }
    if (compactDigits.length === 8) {
      const year = compactDigits.slice(0, 4);
      const month = compactDigits.slice(4, 6);
      const day = compactDigits.slice(6, 8);
      return `${day}/${month}/${year}`;
    }
    const parsedDate = parseSheetDate(raw);
    if (parsedDate) return formatUiDate(parsedDate);
    return raw;
  }

  function getTanggalSelesaiDisplay(value) {
    const parsed = parseDDMMYYYY(value);
    if (!parsed) return "-";
    return formatDDMMYYYY(parsed);
  }

  function getDateKey(date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
  }

  function getProgressColor(status) {
    const value = String(status || "").trim();
    if (!value) return statusColorMap.none;
    const lower = value.toLowerCase();
    if (lower.startsWith("ongoing")) return "#fbc02d";
    if (statusColorMap[lower]) return statusColorMap[lower];
    if (lower.includes("none") || lower.includes("kosong")) return statusColorMap.none;
    return statusColorMap.none;
  }

  function formatMinutes(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return "-";
    return `${minutes} menit`;
  }

  function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    return parseFloat(num.toFixed(2)).toString();
  }

  function computeRevisionFee(revisionCount, pkg, subtotal) {
    const revisiUsed = parseInt(revisionCount, 10) || 0;
    const included = Number(pkg?.included_revisions ?? pkg?.revisions ?? 0) || 0;
    const extraCount = Math.max(0, revisiUsed - included);
    const revisionPercent = Number(pkg?.extra_revision_percent) || 0;
    const baseAmount = Number(subtotal) || 0;
    const fee = extraCount > 0 && revisionPercent > 0
      ? Math.round(baseAmount * (revisionPercent / 100) * extraCount)
      : 0;
    return { revisiUsed, included, extraCount, revisionPercent, fee };
  }

  function setRefreshLoading(state, isLoading) {
    if (state.refreshBtn) state.refreshBtn.disabled = !!isLoading;
    if (typeof window.showLoader === "function" && isLoading) {
      window.showLoader();
    }
    if (typeof window.hideLoader === "function" && !isLoading) {
      window.hideLoader();
    }
  }

  function lockScroll() {
    window.__ModalScrollLock?.lock?.();
  }

  function unlockScroll() {
    window.__ModalScrollLock?.unlock?.();
  }

  async function ensurePriceConfig(state) {
    if (state.priceConfigCache && state.promoConfigCache) {
      return { prices: state.priceConfigCache, promo: state.promoConfigCache };
    }
    try {
      const data = await window.Pricing.loadConfig(state.basePath);
      state.priceConfigCache = data.prices || {};
      state.promoConfigCache = data.promo || {};
    } catch (err) {
      console.error("Gagal memuat konfigurasi WhatsApp:", err);
      state.priceConfigCache = {};
      state.promoConfigCache = {};
    }
    return { prices: state.priceConfigCache, promo: state.promoConfigCache };
  }

  async function loadOrderRows(state, options = {}) {
    const { force = false, cache = "default" } = options;
    if (state.orderRowsCache && !force) {
      if (!state.orderColumns) state.orderColumns = mapColumns(state.orderRowsCache[0] || []);
      return state.orderRowsCache;
    }
    const response = await fetch(state.csvUrl, { cache });
    if (!response.ok) throw new Error(`Gagal memuat CSV: ${response.status}`);
    const text = (await response.text()).trim();
    state.orderRowsCache = parseCSV(text);
    state.orderColumns = mapColumns(state.orderRowsCache[0] || []);
    return state.orderRowsCache;
  }

  function resetDetailPanel(state) {
    if (state.orderDetailPanel) state.orderDetailPanel.classList.remove("visible");
    if (state.orderDetailContent) state.orderDetailContent.innerHTML = "<p>Rincian harga akan muncul otomatis untuk code baru (KYS).</p>";
    if (state.orderDetailWarning) {
      state.orderDetailWarning.hidden = true;
    }
    if (state.exportPdfBtn) {
      state.exportPdfBtn.hidden = true;
    }
    state.lastInvoiceData = null;
  }

  function updateInvoiceControls(state, finishDate) {
    const todayKey = getDateKey(new Date());
    if (!finishDate) {
      if (state.exportPdfBtn) state.exportPdfBtn.hidden = true;
      if (state.orderDetailWarning) state.orderDetailWarning.hidden = true;
      return;
    }
    const finishKey = getDateKey(finishDate);
    if (state.exportPdfBtn) state.exportPdfBtn.hidden = finishKey !== todayKey;
    if (state.orderDetailWarning) state.orderDetailWarning.hidden = finishKey >= todayKey;
  }

  function renderInvoice(state, data) {
    if (!state.invoicePrintArea || !data) return;
    const detailHtml = state.orderDetailContent?.innerHTML || "";
    state.invoicePrintArea.innerHTML = `
      <div class="invoice">
        <div class="invoice-box">
          <h1>Rincian biaya</h1>
          ${detailHtml}
        </div>
      </div>
    `;
  }

  async function renderDetailPanel(state, decoded, rowData) {
    if (!state.orderDetailPanel || !state.orderDetailContent) return;
    state.orderDetailPanel.classList.add("visible");
    const { prices, promo } = await ensurePriceConfig(state);
    const packages = Array.isArray(prices?.packages) ? prices.packages : [];
    const pkg = packages.find((item) => String(item.id) === String(decoded.packageId));
    const durasi = Number(decoded.duration) || 0;
    const deadline = Number(decoded.deadline) || 0;

    if (!pkg) {
      state.orderDetailContent.innerHTML = "<p>Detail paket dari code KYS tidak ditemukan pada konfigurasi harga terbaru.</p>";
      updateInvoiceControls(state, rowData.tanggalSelesaiDate);
      return;
    }

    const calc = window.Pricing.calcTotal(pkg, prices, promo, durasi, deadline);
    const subtotalWithoutRevision = (Number(calc.baseFinal) || 0)
      + (Number(calc.overCost) || 0)
      + (Number(calc.surchargeVal) || 0)
      + (Number(calc.bufVal) || 0);
    const revisionInfo = computeRevisionFee(rowData.revisi, pkg, subtotalWithoutRevision);
    const totalWithRevision = subtotalWithoutRevision + revisionInfo.fee;

    const revisionPercentText = formatPercent(revisionInfo.revisionPercent);

    state.orderDetailContent.innerHTML = `
      <p><strong>Paket:</strong> ${escapeHtml(pkg.name || "-")} (ID ${escapeHtml(pkg.id)})</p>
      <p><strong>Durasi:</strong> ${formatMinutes(durasi)}</p>
      <p><strong>Deadline:</strong> ${deadline ? `${deadline} hari` : "-"}</p>
      <div class="order-detail-row">
        <span class="order-detail-label"><span class="order-detail-dot dot-paket"></span>biaya Paket:</span>
        <span class="order-detail-value val-paket">${window.Pricing.fmtIDR(calc.baseFinal)}</span>
      </div>
      <div class="order-detail-row">
        <span class="order-detail-label"><span class="order-detail-dot dot-overtime"></span>Biaya 5+:</span>
        <span class="order-detail-value val-overtime">${calc.overMin} mnt × ${window.Pricing.fmtIDR(calc.overRate || 0)} = ${window.Pricing.fmtIDR(calc.overCost)}</span>
      </div>
      <div class="order-detail-note">Biaya 5+ dihitung untuk durasi di atas 5 menit.</div>
      <div class="order-detail-row">
        <span class="order-detail-label"><span class="order-detail-dot dot-deadline"></span>Deadline Surcharge:</span>
        <span class="order-detail-value val-deadline">${window.Pricing.fmtIDR(calc.surchargeVal)}</span>
      </div>
      <div class="order-detail-row">
        <span class="order-detail-label"><span class="order-detail-dot dot-buffer"></span>Buffer Fee:</span>
        <span class="order-detail-value val-buffer">${window.Pricing.fmtIDR(calc.bufVal)}</span>
      </div>
      <div class="order-detail-row order-detail-sum-row">
        <span class="order-detail-sum-expression">
          <span class="order-detail-sum-part val-paket">${window.Pricing.fmtIDR(calc.baseFinal)}</span>
          <span class="order-detail-sum-operator">+</span>
          <span class="order-detail-sum-part val-overtime">${window.Pricing.fmtIDR(calc.overCost)}</span>
          <span class="order-detail-sum-operator">+</span>
          <span class="order-detail-sum-part val-deadline">${window.Pricing.fmtIDR(calc.surchargeVal)}</span>
          <span class="order-detail-sum-operator">+</span>
          <span class="order-detail-sum-part val-buffer">${window.Pricing.fmtIDR(calc.bufVal)}</span>
        </span>
      </div>
      <div class="order-detail-subtotal">
        <span>Subtotal (tanpa revisi):</span>
        <span>${window.Pricing.fmtIDR(subtotalWithoutRevision)}</span>
      </div>
      <p><strong>Revisi:</strong> ${revisionInfo.revisiUsed}x (gratis ${revisionInfo.included}x, tambahan ${revisionInfo.extraCount}x)</p>
      <div class="order-detail-row">
        <span class="order-detail-label"><span class="order-detail-dot dot-revisi"></span>Biaya Revisi Tambahan:</span>
        <span class="order-detail-value val-revisi">${window.Pricing.fmtIDR(revisionInfo.fee)} (${revisionPercentText}% × Subtotal ${window.Pricing.fmtIDR(subtotalWithoutRevision)} × ${revisionInfo.extraCount}x)</span>
      </div>
      <div class="order-detail-row order-detail-sum-row">
        <span class="order-detail-sum-expression">
          <span class="order-detail-sum-part">${window.Pricing.fmtIDR(subtotalWithoutRevision)}</span>
          <span class="order-detail-sum-operator">+</span>
          <span class="order-detail-sum-part val-revisi">${window.Pricing.fmtIDR(revisionInfo.fee)}</span>
        </span>
      </div>
      <div class="order-detail-total">Total: ${window.Pricing.fmtIDR(totalWithRevision)}</div>
    `;

    state.lastInvoiceData = { rowData, pkg, calc, revisionInfo, totalWithRevision, decoded, subtotalWithoutRevision };
    updateInvoiceControls(state, rowData.tanggalSelesaiDate);
  }

  function hideBackupRequestButton(state) {
    if (state.backupRequestBtn) {
      state.backupRequestBtn.style.display = "none";
      state.backupRequestBtn.disabled = true;
      state.backupRequestBtn.classList.remove("disabled");
    }
    state.lastOrderData = null;
  }

  function updateBackupRequestButton(state, statusProgres, statusFile) {
    if (!state.backupRequestBtn) return;
    const progressValue = String(statusProgres || "").trim();
    const fileValue = String(statusFile || "").trim();
    const canRequestBackup = progressValue === "Approved" && fileValue === "File Tersedia";
    state.backupRequestBtn.style.display = "block";
    state.backupRequestBtn.disabled = !canRequestBackup;
    state.backupRequestBtn.classList.toggle("disabled", !canRequestBackup);
  }

  function openOrderModal(state) {
    if (!state.orderModal) return;
    if (!state.orderModal.classList.contains("show")) {
      state.orderModal.classList.add("show");
      state.orderModal.setAttribute("aria-hidden", "false");
      lockScroll();
    }
    if (state.kodeInput) state.kodeInput.focus();
  }

  function closeOrderModal(state) {
    if (!state.orderModal) return;
    if (state.orderModal.classList.contains("show")) {
      state.orderModal.classList.remove("show");
      state.orderModal.setAttribute("aria-hidden", "true");
      unlockScroll();
    }
    if (state.openOrderBtn) state.openOrderBtn.focus();
  }

  function saveOrderInput(state) {
    if (!state.kodeInput) return;
    localStorage.setItem(state.storageKey, state.kodeInput.value.trim());
  }

  function restoreOrderInput(state) {
    if (!state.kodeInput) return;
    const lastValue = localStorage.getItem(state.storageKey) || "";
    state.kodeInput.value = lastValue;
    state.kodeInput.dispatchEvent(new Event("input", { bubbles: true }));
    state.kodeInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function cariData(state, options = {}) {
    const { forceRefresh = false } = options;
    const kodeDicari = (state.kodeInput?.value || "").trim();
    hideBackupRequestButton(state);
    resetDetailPanel(state);
    const normalizedInput = normalizeOrderCode(kodeDicari);
    if (!normalizedInput) {
      alert("Masukkan Code Order dulu");
      return;
    }
    if (state.orderModalContent) {
      state.orderModalContent.innerHTML = "<p>Sedang mencari data...</p>";
    }
    openOrderModal(state);
    try {
      const rows = await loadOrderRows(state, {
        force: forceRefresh,
        cache: forceRefresh ? "no-store" : "default",
      });
      const dataRow = rows.slice(1).find((row) => normalizeOrderCode(getCellValue(state.orderColumns, row, "orderCode")) === normalizedInput);
      if (state.orderModalContent) {
        if (dataRow) {
          const tanggalSelesaiRaw = getCellValue(state.orderColumns, dataRow, "finishDate");
          const tanggalSelesaiDate = parseDDMMYYYY(tanggalSelesaiRaw);
          const rowData = {
            judul: getCellValue(state.orderColumns, dataRow, "title") || "-",
            statusProgres: getCellValue(state.orderColumns, dataRow, "statusProgress") || "",
            tanggalOrder: formatTrackerDate(getCellValue(state.orderColumns, dataRow, "orderDate")),
            tanggalSelesai: getTanggalSelesaiDisplay(tanggalSelesaiRaw),
            tanggalSelesaiDate: tanggalSelesaiDate,
            backupExpired: getCellValue(state.orderColumns, dataRow, "backupExpired") || "-",
            statusFile: getCellValue(state.orderColumns, dataRow, "status") || "",
            codeProjek: getCellValue(state.orderColumns, dataRow, "projectCode") || "-",
            codeOrder: getCellValue(state.orderColumns, dataRow, "orderCode") || "-",
            revisi: parseInt(getCellValue(state.orderColumns, dataRow, "revision"), 10) || 0,
          };

          let decoded = null;
          if (kodeDicari.startsWith("KYS-") && window.OrderCode?.decodeKYS) {
            try {
              decoded = window.OrderCode.decodeKYS(kodeDicari);
            } catch (err) {
              console.warn("Decoder KYS gagal:", err);
            }
          }
          const isKysDecoded = !!decoded;
          if (isKysDecoded && decoded?.orderDate) {
            const decodedDate = parseDecodedOrderDate(decoded.orderDate);
            rowData.tanggalOrder = decodedDate ? formatUiDate(decodedDate) : String(decoded.orderDate);
          }

          const progressColor = getProgressColor(rowData.statusProgres);
          const progressValue = rowData.statusProgres || "None";
          const progressMarkup = `<p><strong>Status Progres:</strong> <span class="progress-status" style="color:${progressColor};">${escapeHtml(progressValue)}</span></p>`;

          const statusFileRaw = rowData.statusFile || "";
          const statusFileNormalized = statusFileRaw.trim().toLowerCase();
          const statusFileDisplay = statusFileRaw || "None";
          let fileStatusStyle = "font-weight:bold";
          if (statusFileNormalized === "file tersedia") fileStatusStyle = "color:#4CAF50;font-weight:bold";
          else if (statusFileNormalized === "file tidak tersedia") fileStatusStyle = "color:#F44336;font-weight:bold";

          let html = "";
          html += `<p><strong>Judul:</strong> ${escapeHtml(rowData.judul)}</p>`;
          html += progressMarkup;
          html += `<p><strong>Tanggal Order:</strong> ${escapeHtml(rowData.tanggalOrder)}</p>`;
          html += `<p><strong>Tanggal Selesai:</strong> ${escapeHtml(rowData.tanggalSelesai)}</p>`;
          html += `<p><strong>Backup Expired:</strong> ${escapeHtml(rowData.backupExpired)}</p>`;
          html += `<p><strong>Status File:</strong> <span class="modal-status" style="${fileStatusStyle}">${escapeHtml(statusFileDisplay)}</span></p>`;
          html += `<p><strong>Code Projek:</strong> ${escapeHtml(rowData.codeProjek)}</p>`;
          if (!isKysDecoded) {
            html += `<p><strong>Code Order:</strong> ${escapeHtml(rowData.codeOrder)}</p>`;
          }
          html += `<p><strong>Revisi:</strong> ${rowData.revisi}</p>`;

          state.orderModalContent.innerHTML = html;
          state.lastOrderData = rowData;
          updateBackupRequestButton(state, rowData.statusProgres, rowData.statusFile);

          if (isKysDecoded) {
            await renderDetailPanel(state, decoded, rowData);
          } else {
            resetDetailPanel(state);
          }
        } else {
          state.orderModalContent.innerHTML = "<p>Code Order tidak ditemukan silahkan konfirmasi ke Freelancer.</p>";
          hideBackupRequestButton(state);
          resetDetailPanel(state);
        }
      }
    } catch (error) {
      console.error("Error fetching order data:", error);
      if (state.orderModalContent) {
        state.orderModalContent.innerHTML = "<p>Terjadi kesalahan saat memuat data. Silakan coba lagi.</p>";
      }
      hideBackupRequestButton(state);
      resetDetailPanel(state);
    }
  }

  async function refreshCurrentOrder(state) {
    const kodeDicari = (state.kodeInput?.value || "").trim();
    if (!kodeDicari) {
      alert("Masukkan Code Order dulu");
      return;
    }
    setRefreshLoading(state, true);
    try {
      await cariData(state, { forceRefresh: true });
    } finally {
      setRefreshLoading(state, false);
    }
  }

  async function handleBackupRequestClick(state) {
    if (!state.backupRequestBtn || state.backupRequestBtn.disabled) return;
    if (!state.lastOrderData) return;
    const { prices } = await ensurePriceConfig(state);
    const rawNumber = String(prices?.whatsapp || "").trim();
    const templateRaw = String(prices?.backup_request_message || "").trim();
    if (!rawNumber || !templateRaw) {
      alert("Konfigurasi WhatsApp belum tersedia.");
      return;
    }
    const sanitizedNumber = rawNumber.replace(/[^\d]/g, "");
    if (!sanitizedNumber) {
      alert("Nomor WhatsApp tidak valid.");
      return;
    }
    const judul = state.lastOrderData.judul || "-";
    const codeProjek = state.lastOrderData.codeProjek || "-";
    const codeOrder = state.lastOrderData.codeOrder || "-";
    let messageTemplate = templateRaw.replace(/%0A/gi, "\n");
    let message = messageTemplate
      .replace(/{{\s*judul\s*}}/gi, judul)
      .replace(/{{\s*code_projek\s*}}/gi, codeProjek)
      .replace(/{{\s*code_order\s*}}/gi, codeOrder);
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${sanitizedNumber}?text=${encodedMessage}`;
    window.open(waUrl, "_blank", "noopener");
  }

  function bindEvents(state) {
    if (state.openOrderBtn) state.openOrderBtn.addEventListener("click", () => {
      if (state.orderModalContent) state.orderModalContent.innerHTML = state.defaultOrderMessage;
      restoreOrderInput(state);
      hideBackupRequestButton(state);
      resetDetailPanel(state);
      openOrderModal(state);
    });
    if (state.searchBtn) state.searchBtn.addEventListener("click", () => {
      saveOrderInput(state);
      cariData(state);
    });
    if (state.refreshBtn) state.refreshBtn.addEventListener("click", () => {
      saveOrderInput(state);
      refreshCurrentOrder(state);
    });
    if (state.kodeInput) state.kodeInput.addEventListener("keyup", (e) => { if (e.key === "Enter") cariData(state); });
    if (state.kodeInput) state.kodeInput.addEventListener("input", () => saveOrderInput(state));
    if (state.orderModalClose) state.orderModalClose.addEventListener("click", () => closeOrderModal(state));
    if (state.orderModal) state.orderModal.addEventListener("click", (e) => { if (e.target === state.orderModal) closeOrderModal(state); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.orderModal?.classList.contains("show")) closeOrderModal(state);
    });
    if (state.backupRequestBtn) state.backupRequestBtn.addEventListener("click", () => handleBackupRequestClick(state));
    if (state.exportPdfBtn) state.exportPdfBtn.addEventListener("click", () => {
      if (!state.lastInvoiceData) return;
      renderInvoice(state, state.lastInvoiceData);
      window.print();
    });
  }

  function init(options = {}) {
    const elements = options.elements || {};
    const getEl = (id) => elements[id] || document.getElementById(id);
    trackerState = {
      csvUrl: options.csvUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vRZiGRgDxVjlJupwCAb29TPzNlksU5kISHLkmfpqbdwO_NQ__PEOk8FxuHe_UwzxWe5pcnfTJ1MFX3b/pub?gid=0&single=true&output=csv",
      basePath: options.basePath || "..",
      storageKey: options.storageKey || DEFAULT_STORAGE_KEY,
      defaultOrderMessage: "<p>Masukkan Code Order untuk menampilkan detail.</p>",
      orderRowsCache: null,
      orderColumns: null,
      priceConfigCache: null,
      promoConfigCache: null,
      lastOrderData: null,
      lastInvoiceData: null,
      orderModal: getEl("orderModal"),
      orderModalContent: getEl("popup-isi"),
      orderModalClose: getEl("orderModalClose"),
      kodeInput: getEl("kodeInput"),
      searchBtn: getEl("searchBtn"),
      refreshBtn: getEl("refreshBtn"),
      openOrderBtn: getEl("openOrderBtn"),
      backupRequestBtn: getEl("backupRequestBtn"),
      orderDetailPanel: getEl("orderDetailPanel"),
      orderDetailContent: getEl("order-detail-content"),
      orderDetailWarning: getEl("order-detail-warning"),
      exportPdfBtn: getEl("exportPdfBtn"),
      invoicePrintArea: getEl("invoice-print"),
    };

    bindEvents(trackerState);
    return trackerState;
  }

  function setCode(value, options = {}) {
    if (!trackerState || !trackerState.kodeInput) return;
    trackerState.kodeInput.value = value;
    trackerState.kodeInput.dispatchEvent(new Event("input", { bubbles: true }));
    if (options.save !== false) {
      saveOrderInput(trackerState);
    }
  }

  function search(options = {}) {
    if (!trackerState) return;
    cariData(trackerState, options);
  }

  window.OrderTracker = {
    init,
    setCode,
    search,
  };
})();
