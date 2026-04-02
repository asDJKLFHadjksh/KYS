const TEH_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRZiGRgDxVjlJupwCAb29TPzNlksU5kISHLkmfpqbdwO_NQ__PEOk8FxuHe_UwzxWe5pcnfTJ1MFX3b/pub?gid=273910268&single=true&output=csv";

const TEH_MEDIA_BASE = "media/";
const a0 = "_x";
const b1 = "k9";
const c2 = "kg";
const d3 = {
  a: "v7x9m2p5",
  b: "s1r8n4q2",
  c: "hc2o9fsGyesiANwx",
  d: "EDTE0hVcI9KntEIKCSS8Y5a6",
  e: 120000,
};
const e4 = [105, 109, 112, 111, 114, 116, 75, 101, 121];
const f5 = [100, 101, 114, 105, 118, 101, 75, 101, 121];

const searchInput = document.getElementById("tehSearch");
const categorySelect = document.getElementById("tehCategory");
const listContainer = document.getElementById("tehList");
const gateElements = {
  overlay: document.getElementById("tehGate"),
  lottieContainer: document.getElementById("tehGateLottie"),
  lottieFallback: document.querySelector(".teh-gate__loader-fallback"),
};
const lightboxElements = {
  overlay: document.querySelector(".teh-lightbox"),
  image: document.querySelector(".teh-lightbox__image"),
  closeButton: document.querySelector(".teh-lightbox__close"),
};

const lightboxState = {
  scale: 1,
  tx: 0,
  ty: 0,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  baseWidth: 0,
  baseHeight: 0,
};

let visibleItems = [];

setupCopyInteractions(listContainer);
setupLightbox();
initTehGate();

n7();

searchInput.addEventListener("input", () => applyFilters());
categorySelect.addEventListener("change", () => applyFilters());

async function n7() {
  const h2 = await f0();
  await loadTEH(h2);
}

async function loadTEH(h2) {
  if (!listContainer) {
    return;
  }

  if (typeof window.showLoader === "function") {
    window.showLoader();
  }

  try {
    const response = await fetch(TEH_CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Fetch gagal: ${response.status}`);
    }
    const csvText = await response.text();
    if (!h2) {
      applyGateFromCSV(csvText);
    }
    const items = parseItems(csvText);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    visibleItems = items
      .filter((item) => isEligible(item, today))
      .sort((a, b) => compareItems(a, b));

    buildCategoryOptions(visibleItems);
    renderList(visibleItems);
  } catch (error) {
    console.error("Gagal memuat data TEH:", error);
    listContainer.innerHTML =
      '<p class="teh-empty">Gagal memuat data TEH. Silakan refresh halaman.</p>';
  } finally {
    if (typeof window.hideLoader === "function") {
      window.hideLoader();
    }
  }
}

async function f0() {
  const params = new URLSearchParams(location.search);
  const h2 = g1(params.get(c2));
  const j3 = localStorage.getItem(a0) === b1;
  let k4 = j3;

  if (h2) {
    const l5 = await m6(h2);
    if (l5) {
      localStorage.setItem(a0, b1);
      k4 = true;
    }
  }

  if (k4) {
    toggleTehGate(false);
  }

  return k4;
}

function g1(value) {
  return (value || "").trim();
}

function h8() {
  return Boolean(window.crypto?.subtle);
}

function j9(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function k0(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function l1(values) {
  return String.fromCharCode(...values);
}

async function m2() {
  const encoder = new TextEncoder();
  const n3 = l1(e4);
  const p4 = l1(f5);
  const q5 = await window.crypto.subtle[n3](
    "raw",
    encoder.encode(d3.a),
    "PBKDF2",
    false,
    [p4]
  );

  return window.crypto.subtle[p4](
    {
      name: "PBKDF2",
      salt: encoder.encode(d3.b),
      iterations: d3.e,
      hash: "SHA-256",
    },
    q5,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt", "encrypt"]
  );
}

async function m6(input) {
  if (!h8()) {
    return false;
  }
  try {
    const t7 = await m2();
    const u8 = k0(d3.c);
    const v9 = new TextEncoder().encode(input);
    const w0 = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: u8 },
      t7,
      v9
    );
    return j9(new Uint8Array(w0)) === d3.d;
  } catch (error) {
    return false;
  }
}

function initTehGate() {
  if (!gateElements.overlay) {
    return;
  }

  const lottieContainer = gateElements.lottieContainer;
  const lottieFallback = gateElements.lottieFallback;
  const lottiePath = new URL(
    "../assets/lottie/Loading.json",
    document.baseURI
  ).toString();

  if (window.lottie && lottieContainer) {
    const animation = window.lottie.loadAnimation({
      container: lottieContainer,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: lottiePath,
    });

    animation.addEventListener("DOMLoaded", () => {
      lottieFallback?.classList.add("is-hidden");
    });

    animation.addEventListener("data_failed", () => {
      console.warn("Gagal memuat lottie TEH gate:", lottiePath);
    });
  }
}

function applyGateFromCSV(csvText) {
  const rows = parseCSV(csvText || "");
  if (!rows.length) {
    return;
  }

  const gateValue = findGateValue(rows);
  const isGateActive = gateValue === "I";
  toggleTehGate(isGateActive);
}

function toggleTehGate(isActive) {
  if (!gateElements.overlay) {
    return;
  }
  const wasActive = gateElements.overlay.classList.contains("is-active");
  document.body.classList.toggle("teh-gate-active", isActive);
  gateElements.overlay.classList.toggle("is-active", isActive);
  gateElements.overlay.setAttribute("aria-hidden", isActive ? "false" : "true");
  if (isActive && !wasActive && window.__ModalScrollLock?.lock) {
    window.__ModalScrollLock.lock();
  }
  if (!isActive && wasActive && window.__ModalScrollLock?.unlock) {
    window.__ModalScrollLock.unlock();
  }
}

function findGateValue(rows) {
  const header = rows[0] || [];
  const headerIndex = header.findIndex(
    (cell) => cell.trim().toUpperCase() === "2Z"
  );
  const candidateIndexes = [];
  if (headerIndex !== -1) {
    candidateIndexes.push(headerIndex);
  }

  const fallbackLabels = ["2Z", "Z", "BZ", "ZZ"];
  fallbackLabels.forEach((label) => {
    const index = columnLabelToIndex(label);
    if (index !== null && !candidateIndexes.includes(index)) {
      candidateIndexes.push(index);
    }
  });

  for (const index of candidateIndexes) {
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const value = (rows[rowIndex]?.[index] || "").trim().toUpperCase();
      if (value === "I" || value === "O") {
        return value;
      }
    }
  }

  return null;
}

function columnLabelToIndex(label) {
  const letters = (label || "").replace(/[^A-Z]/gi, "").toUpperCase();
  if (!letters) {
    return null;
  }
  let index = 0;
  for (let i = 0; i < letters.length; i += 1) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

function parseItems(csvText) {
  const rows = parseCSV(csvText).filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );
  if (rows.length <= 1) {
    return [];
  }

  return rows.slice(1).map((row, index) => {
    const [
      title = "",
      materi = "",
      kategori = "",
      evidenceRaw = "",
      publishRaw = "",
      downloadLink = "",
      hideFlag = "",
      pinFlag = "",
    ] = row;

    return {
      title: title.trim() || "(Tanpa judul)",
      materi: materi.trim(),
      categories: parseCategories(kategori),
      evidenceRaw: evidenceRaw.trim(),
      publishLabel: publishRaw.trim(),
      publishDate: parseDate(publishRaw.trim()),
      downloadLink: downloadLink.trim(),
      isHidden: hideFlag.trim().toUpperCase() === "I",
      isPinned: pinFlag.trim().toUpperCase() === "I",
      rowIndex: index,
    };
  });
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      current.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    field += char;
  }

  current.push(field);
  rows.push(current);
  return rows;
}

function parseCategories(raw) {
  return (raw || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length);
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function isEligible(item, today) {
  if (item.isHidden) {
    return false;
  }
  if (!item.publishDate) {
    return false;
  }
  return today.getTime() >= item.publishDate.getTime();
}

function compareItems(a, b) {
  if (a.isPinned !== b.isPinned) {
    return a.isPinned ? -1 : 1;
  }
  const dateA = a.publishDate ? a.publishDate.getTime() : 0;
  const dateB = b.publishDate ? b.publishDate.getTime() : 0;
  if (dateA !== dateB) {
    return dateB - dateA;
  }
  return b.rowIndex - a.rowIndex;
}

function buildCategoryOptions(items) {
  if (!categorySelect) {
    return;
  }
  const categories = new Set();
  items.forEach((item) => {
    item.categories.forEach((category) => categories.add(category));
  });

  const sorted = Array.from(categories).sort((a, b) =>
    a.localeCompare(b, "id")
  );

  categorySelect.innerHTML = '<option value="">Semua Kategori</option>';
  sorted.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

function applyFilters() {
  const query = (searchInput?.value || "").toLowerCase();
  const category = categorySelect?.value || "";

  const filtered = visibleItems.filter((item) => {
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.materi.toLowerCase().includes(query);
    const matchesCategory = !category || item.categories.includes(category);
    return matchesSearch && matchesCategory;
  });

  renderList(filtered);
}

function renderList(items) {
  if (!listContainer) {
    return;
  }
  listContainer.innerHTML = "";

  if (!items.length) {
    listContainer.innerHTML =
      '<p class="teh-empty">Belum ada materi yang sesuai filter.</p>';
    return;
  }

  items.forEach((item) => {
    listContainer.appendChild(buildCard(item));
  });
}

function buildCard(item) {
  const card = document.createElement("article");
  card.className = "teh-card";

  const header = document.createElement("header");
  header.className = "teh-header";

  const title = document.createElement("h3");
  title.className = "teh-title";
  title.textContent = item.title;
  header.appendChild(title);

  if (item.publishLabel) {
    const meta = document.createElement("div");
    meta.className = "teh-publish-meta";
    meta.textContent = formatPublishLabel(item.publishLabel);
    header.appendChild(meta);
  }

  card.appendChild(header);

  const evidenceBlock = buildEvidenceBlock(item);
  if (evidenceBlock) {
    card.appendChild(evidenceBlock);
  }

  const materi = document.createElement("div");
  materi.className = "teh-content";
  materi.appendChild(parseInteractiveMarkers(item.materi));
  card.appendChild(materi);

  if (item.categories.length) {
    const categories = document.createElement("div");
    categories.className = "teh-categories";
    item.categories.forEach((category) => {
      const chip = document.createElement("span");
      chip.className = "teh-category";
      chip.textContent = category;
      categories.appendChild(chip);
    });
    card.appendChild(categories);
  }

  if (item.downloadLink) {
    const actions = document.createElement("div");
    actions.className = "teh-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "teh-download";
    button.textContent = "Download";
    button.addEventListener("click", () => {
      window.open(item.downloadLink, "_blank", "noopener,noreferrer");
    });
    actions.appendChild(button);

    card.appendChild(actions);
  }

  const pinDot = document.createElement("div");
  pinDot.className = `pin-dot ${item.isPinned ? "pin-dot--on" : "pin-dot--off"}`;
  card.appendChild(pinDot);

  return card;
}

function formatPublishLabel(label) {
  return `Publish: ${label}`;
}

function buildEvidenceBlock(item) {
  const evidence = item.evidenceRaw;
  if (!evidence) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "teh-evidence";

  if (isDrivePreview(evidence)) {
    wrapper.classList.add("teh-evidence--video");
    const iframe = document.createElement("iframe");
    iframe.src = evidence;
    iframe.title = item.title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    wrapper.appendChild(iframe);
    return wrapper;
  }

  if (isUrl(evidence)) {
    return null;
  }

  const fileName = evidence;
  const extension = fileName.split(".").pop().toLowerCase();
  const resolvedSrc = `${TEH_MEDIA_BASE}${fileName}`;

  if (["mp4", "webm"].includes(extension)) {
    wrapper.classList.add("teh-evidence--video");
    const video = document.createElement("video");
    video.controls = true;
    video.src = resolvedSrc;
    video.addEventListener("error", () => {
      wrapper.style.display = "none";
    });
    wrapper.appendChild(video);
    return wrapper;
  }

  wrapper.classList.add("teh-evidence--media");
  const image = document.createElement("img");
  image.className = "teh-evidence-img";
  image.src = resolvedSrc;
  image.alt = item.title;
  image.loading = "lazy";
  image.dataset.fullsrc = resolvedSrc;
  image.addEventListener("error", () => {
    wrapper.style.display = "none";
  });
  wrapper.appendChild(image);
  return wrapper;
}

function isUrl(value) {
  return /^https?:\/\//i.test(value);
}

function isDrivePreview(url) {
  return (
    /^https?:\/\//i.test(url) &&
    url.includes("drive.google.com/file/d/") &&
    url.includes("/preview")
  );
}

function parseInteractiveMarkers(rawText) {
  const fragment = document.createDocumentFragment();
  const normalized = (rawText || "").replace(/\r\n?/g, "\n");
  const markerPattern = /\?\[([\s\S]*?)\]\?|\?\{([\s\S]*?)\}\?/g;
  let lastIndex = 0;
  let match;

  while ((match = markerPattern.exec(normalized))) {
    const { index } = match;
    if (index > lastIndex) {
      fragment.appendChild(
        renderSafeTextWithLinks(normalized.slice(lastIndex, index))
      );
    }

    if (match[1] !== undefined) {
      fragment.appendChild(buildInteractiveSpan(match[1], "cc-copy"));
    } else if (match[2] !== undefined) {
      fragment.appendChild(buildInteractiveSpan(match[2], "cc-link", true));
    }

    lastIndex = markerPattern.lastIndex;
  }

  if (lastIndex < normalized.length) {
    fragment.appendChild(renderSafeTextWithLinks(normalized.slice(lastIndex)));
  }

  return fragment;
}

function buildInteractiveSpan(value, className, isLink = false) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = value;
  span.dataset.copy = value;
  if (isLink) {
    span.dataset.open = value;
  }
  return span;
}

function renderSafeTextWithLinks(text) {
  const fragment = document.createDocumentFragment();
  const normalized = (text || "").replace(/\r\n?/g, "\n");
  const linkPattern =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(normalized))) {
    const { index } = match;
    if (index > lastIndex) {
      appendTextWithLineBreaks(fragment, normalized.slice(lastIndex, index));
    }

    if (match[3]) {
      appendLink(fragment, match[3], match[3]);
    } else {
      appendLink(fragment, match[2], match[1]);
    }

    lastIndex = linkPattern.lastIndex;
  }

  if (lastIndex < normalized.length) {
    appendTextWithLineBreaks(fragment, normalized.slice(lastIndex));
  }

  return fragment;
}

function appendTextWithLineBreaks(container, text) {
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (part) {
      container.appendChild(document.createTextNode(part));
    }
    if (index < parts.length - 1) {
      container.appendChild(document.createElement("br"));
    }
  });
}

function appendLink(container, url, label) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  container.appendChild(link);
}

function setupCopyInteractions(container) {
  if (!container) {
    return;
  }

  container.addEventListener("click", (event) => {
    const target = event.target.closest(".cc-copy, .cc-link");
    if (!target || !container.contains(target)) {
      return;
    }
    const value = target.dataset.copy || "";
    copyToClipboard(value);
    triggerCopyFeedback(target);
  });

  container.addEventListener("dblclick", (event) => {
    const target = event.target.closest(".cc-link");
    if (!target || !container.contains(target)) {
      return;
    }
    const url = target.dataset.open;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });
}

const copyFeedbackTimers = new WeakMap();

function triggerCopyFeedback(element) {
  if (!element) {
    return;
  }
  element.classList.add("copied");
  const existingTimer = copyFeedbackTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = window.setTimeout(() => {
    element.classList.remove("copied");
  }, 600);
  copyFeedbackTimers.set(element, timer);
}

async function copyToClipboard(text) {
  if (!text) {
    return;
  }
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn("Clipboard API gagal, coba fallback.", error);
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
  } catch (error) {
    console.warn("Fallback clipboard gagal.", error);
  }
  document.body.removeChild(textarea);
}

function setupLightbox() {
  const { overlay, image, closeButton } = lightboxElements;
  if (!overlay || !image || !closeButton) {
    return;
  }
  image.setAttribute("draggable", "false");

  image.addEventListener("load", () => {
    resetLightboxTransform();
    const rect = image.getBoundingClientRect();
    lightboxState.baseWidth = rect.width;
    lightboxState.baseHeight = rect.height;
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest(".teh-evidence-img");
    if (!target) {
      return;
    }
    event.preventDefault();
    openLightbox(target);
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeLightbox();
    }
  });

  closeButton.addEventListener("click", () => {
    closeLightbox();
  });

  overlay.addEventListener(
    "wheel",
    (event) => {
      if (!overlay.classList.contains("is-open")) {
        return;
      }
      event.preventDefault();
      handleLightboxZoom(event);
    },
    { passive: false }
  );

  image.addEventListener("pointerdown", (event) => {
    if (!overlay.classList.contains("is-open")) {
      return;
    }
    if (lightboxState.scale <= 1.01) {
      return;
    }
    event.preventDefault();
    lightboxState.isDragging = true;
    lightboxState.lastMouseX = event.clientX;
    lightboxState.lastMouseY = event.clientY;
    image.classList.add("is-dragging");
    image.setPointerCapture(event.pointerId);
  });

  image.addEventListener("pointermove", (event) => {
    if (!lightboxState.isDragging) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - lightboxState.lastMouseX;
    const deltaY = event.clientY - lightboxState.lastMouseY;
    lightboxState.lastMouseX = event.clientX;
    lightboxState.lastMouseY = event.clientY;
    lightboxState.tx += deltaX;
    lightboxState.ty += deltaY;
    clampLightboxTranslate();
    applyLightboxTransform();
  });

  const stopDragging = (event) => {
    if (!lightboxState.isDragging) {
      return;
    }
    lightboxState.isDragging = false;
    image.classList.remove("is-dragging");
    if (event?.pointerId !== undefined) {
      image.releasePointerCapture(event.pointerId);
    }
  };

  image.addEventListener("pointerup", stopDragging);
  image.addEventListener("pointercancel", stopDragging);

  image.addEventListener("dblclick", (event) => {
    if (!overlay.classList.contains("is-open")) {
      return;
    }
    event.preventDefault();
    const targetScale = lightboxState.scale > 1 ? 1 : 2;
    zoomLightboxTo(targetScale, event.clientX, event.clientY);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      closeLightbox();
    }
  });
}

function openLightbox(targetImage) {
  const { overlay, image } = lightboxElements;
  if (!overlay || !image) {
    return;
  }
  if (overlay.classList.contains("is-open")) {
    return;
  }
  const fullSrc =
    targetImage.dataset.fullsrc || targetImage.currentSrc || targetImage.src;
  if (!fullSrc) {
    return;
  }
  image.src = fullSrc;
  image.alt = targetImage.alt || "Preview gambar";
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("teh-lightbox-open");
  if (window.__ModalScrollLock?.lock) {
    window.__ModalScrollLock.lock();
  }
  resetLightboxTransform();
}

function closeLightbox() {
  const { overlay, image } = lightboxElements;
  if (!overlay || !image) {
    return;
  }
  if (!overlay.classList.contains("is-open")) {
    return;
  }
  overlay.classList.remove("is-open");
  overlay.setAttribute("aria-hidden", "true");
  image.removeAttribute("src");
  document.body.classList.remove("teh-lightbox-open");
  if (window.__ModalScrollLock?.unlock) {
    window.__ModalScrollLock.unlock();
  }
  resetLightboxTransform();
}

function resetLightboxTransform() {
  lightboxState.scale = 1;
  lightboxState.tx = 0;
  lightboxState.ty = 0;
  lightboxState.isDragging = false;
  applyLightboxTransform();
}

function handleLightboxZoom(event) {
  const direction = event.deltaY > 0 ? -1 : 1;
  const zoomFactor = direction > 0 ? 1.12 : 0.88;
  const nextScale = lightboxState.scale * zoomFactor;
  zoomLightboxTo(nextScale, event.clientX, event.clientY);
}

function zoomLightboxTo(nextScale, clientX, clientY) {
  const { overlay, image } = lightboxElements;
  if (!overlay || !image) {
    return;
  }
  const minScale = 1;
  const maxScale = 4;
  const clampedScale = Math.min(maxScale, Math.max(minScale, nextScale));
  const scaleRatio = clampedScale / lightboxState.scale;
  if (scaleRatio === 1) {
    return;
  }
  const rect = image.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const offsetX = clientX - centerX;
  const offsetY = clientY - centerY;
  lightboxState.tx -= offsetX * (scaleRatio - 1);
  lightboxState.ty -= offsetY * (scaleRatio - 1);
  lightboxState.scale = clampedScale;
  if (lightboxState.scale <= 1.01) {
    lightboxState.tx = 0;
    lightboxState.ty = 0;
  }
  clampLightboxTranslate();
  applyLightboxTransform();
}

function clampLightboxTranslate() {
  const { overlay } = lightboxElements;
  if (!overlay) {
    return;
  }
  const baseWidth =
    lightboxState.baseWidth ||
    lightboxElements.image?.getBoundingClientRect().width ||
    0;
  const baseHeight =
    lightboxState.baseHeight ||
    lightboxElements.image?.getBoundingClientRect().height ||
    0;
  const scaledWidth = baseWidth * lightboxState.scale;
  const scaledHeight = baseHeight * lightboxState.scale;
  const boundsWidth = overlay.clientWidth;
  const boundsHeight = overlay.clientHeight;
  const maxTranslateX = Math.max(0, (scaledWidth - boundsWidth) / 2);
  const maxTranslateY = Math.max(0, (scaledHeight - boundsHeight) / 2);
  lightboxState.tx = Math.min(
    maxTranslateX,
    Math.max(-maxTranslateX, lightboxState.tx)
  );
  lightboxState.ty = Math.min(
    maxTranslateY,
    Math.max(-maxTranslateY, lightboxState.ty)
  );
}

function applyLightboxTransform() {
  const { image } = lightboxElements;
  if (!image) {
    return;
  }
  image.style.transform = `translate(${lightboxState.tx}px, ${lightboxState.ty}px) scale(${lightboxState.scale})`;
  if (lightboxState.scale > 1.01) {
    image.classList.add("is-zoomed");
  } else {
    image.classList.remove("is-zoomed");
  }
}
