const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRZiGRgDxVjlJupwCAb29TPzNlksU5kISHLkmfpqbdwO_NQ__PEOk8FxuHe_UwzxWe5pcnfTJ1MFX3b/pub?gid=741033517&single=true&output=csv";

const latestContainer = document.getElementById("noticeLatest");
const listContainer = document.getElementById("noticeList");
const MEDIA_BASE = "community/media/";
const MEDIA_BASE_SUBPAGE = "../community/media/";
const lightboxElements = {
  overlay: document.querySelector(".notice-lightbox"),
  image: document.querySelector(".notice-lightbox__image"),
  closeButton: document.querySelector(".notice-lightbox__close"),
};
const lightboxState = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  isPanning: false,
  startX: 0,
  startY: 0,
  startTranslateX: 0,
  startTranslateY: 0,
};
const LIGHTBOX_SCALE_MIN = 1;
const LIGHTBOX_SCALE_MAX = 4.5;
const LIGHTBOX_SCALE_STEP = 0.25;

if (latestContainer || listContainer) {
  loadNotices();
}

setupLightbox();
setupCopyInteractions(latestContainer);
setupCopyInteractions(listContainer);

async function loadNotices() {
  if (typeof window.showLoader === "function") {
    window.showLoader();
  }

  try {
    const response = await fetch(CSV_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Fetch gagal: ${response.status}`);
    }
    const csvText = await response.text();
    const posts = parsePosts(csvText);

    if (latestContainer) {
      renderLatestNotice(posts, latestContainer);
    }

    if (listContainer) {
      renderNoticeList(posts, listContainer);
    }
  } catch (error) {
    console.error("Gagal memuat pemberitahuan:", error);
    if (latestContainer) {
      latestContainer.textContent =
        "Gagal memuat pemberitahuan. Silakan refresh halaman.";
      latestContainer.classList.add("notice-error");
    }
    if (listContainer) {
      listContainer.innerHTML =
        '<p class="notice-error">Gagal memuat daftar postingan. Silakan refresh halaman.</p>';
    }
  } finally {
    if (typeof window.hideLoader === "function") {
      window.hideLoader();
    }
  }
}

function parsePosts(csvText) {
  const rows = parseCSV(csvText).filter((row) =>
    row.some((cell) => cell.trim() !== "")
  );
  if (rows.length <= 1) {
    return [];
  }

  return rows.slice(1).map((row, index) => {
    const [
      title = "",
      description = "",
      imageName = "",
      progressValue = "",
      startRaw = "",
      endRaw = "",
      hideFlag = "",
      pinFlag = "",
    ] = row;

    return {
      title: title.trim() || "(Tanpa judul)",
      description: description.trim(),
      imageName: imageName.trim(),
      progressValue: progressValue.trim(),
      startRaw: startRaw.trim(),
      endRaw: endRaw.trim(),
      hideFlag: hideFlag.trim().toUpperCase(),
      pinFlag: pinFlag.trim().toUpperCase(),
      startDate: parseDate(startRaw.trim()),
      endDate: parseDate(endRaw.trim()),
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

function isScheduled(post, today) {
  if (!post.startDate) {
    return false;
  }
  return today.getTime() < post.startDate.getTime();
}

function isExpired(post, today) {
  if (!post.endDate) {
    return false;
  }
  return today.getTime() > post.endDate.getTime();
}

function isHidden(post) {
  return post.hideFlag === "I";
}

function isPinned(post) {
  return post.pinFlag === "I";
}

function isEligible(post, today) {
  return !isHidden(post) && !isScheduled(post, today) && !isExpired(post, today);
}

function pickLatestNotice(posts, today) {
  const visiblePosts = posts.filter((post) => isEligible(post, today));
  const pinnedPosts = visiblePosts.filter((post) => isPinned(post));
  if (pinnedPosts.length) {
    return pinnedPosts.reduce((latest, current) => {
      if (!latest) {
        return current;
      }
      const latestStart = latest.startDate
        ? latest.startDate.getTime()
        : -Infinity;
      const currentStart = current.startDate
        ? current.startDate.getTime()
        : -Infinity;
      if (currentStart > latestStart) {
        return current;
      }
      if (currentStart === latestStart && current.rowIndex > latest.rowIndex) {
        return current;
      }
      return latest;
    }, null);
  }

  return visiblePosts.reduce((latest, current) => {
    if (!latest) {
      return current;
    }
    const latestStart = latest.startDate
      ? latest.startDate.getTime()
      : -Infinity;
    const currentStart = current.startDate
      ? current.startDate.getTime()
      : -Infinity;
    if (currentStart > latestStart) {
      return current;
    }
    if (currentStart === latestStart && current.rowIndex > latest.rowIndex) {
      return current;
    }
    return latest;
  }, null);
}

function renderLatestNotice(posts, container) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const latest = pickLatestNotice(posts, today);
  container.innerHTML = "";

  if (!latest) {
    const empty = document.createElement("p");
    empty.className = "notice-empty";
    empty.textContent = "Belum ada pemberitahuan terbaru untuk saat ini.";
    container.appendChild(empty);
    return;
  }

  const title = document.createElement("h4");
  title.className = "notice-latest__title";
  title.textContent = latest.title;

  const desc = document.createElement("p");
  desc.className = "notice-latest__desc";
  desc.replaceChildren(
    parseInteractiveMarkers(latest.description || "(Tanpa deskripsi)")
  );

  container.appendChild(title);
  container.appendChild(desc);

  if (latest.imageName) {
    const media = buildNoticeMedia(latest.imageName, latest.title);
    if (media) {
      container.appendChild(media);
    }
  }

  const progressValue = parseProgressValue(latest.progressValue);
  if (progressValue !== null) {
    container.appendChild(buildProgress(progressValue, true));
  }

  const meta = buildNoticeMeta(latest, { compact: true });
  if (meta) {
    container.appendChild(meta);
  }
}

function renderNoticeList(posts, container) {
  if (!posts.length) {
    container.innerHTML = '<p class="notice-empty">Belum ada postingan.</p>';
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visiblePosts = posts.filter((post) => isEligible(post, today));
  if (!visiblePosts.length) {
    container.innerHTML = '<p class="notice-empty">Belum ada postingan.</p>';
    return;
  }
  const sorted = visiblePosts.sort((a, b) => {
    const aPinned = isPinned(a);
    const bPinned = isPinned(b);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    const aStart = a.startDate ? a.startDate.getTime() : -Infinity;
    const bStart = b.startDate ? b.startDate.getTime() : -Infinity;
    if (aStart !== bStart) {
      return bStart - aStart;
    }
    return b.rowIndex - a.rowIndex;
  });

  container.innerHTML = "";

  sorted.forEach((post) => {
    const card = document.createElement("article");
    card.className = "notice-item";

    const header = document.createElement("div");
    header.className = "notice-item__header";

    const meta = buildNoticeMeta(post);
    if (meta) {
      header.appendChild(meta);
    }

    const title = document.createElement("h3");
    title.className = "notice-item__title";
    title.textContent = post.title;
    header.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "notice-item__desc";
    desc.replaceChildren(
      parseInteractiveMarkers(post.description || "(Tanpa deskripsi)")
    );
    header.appendChild(desc);

    card.appendChild(header);

    if (post.imageName) {
      const media = buildNoticeMedia(post.imageName, post.title);
      if (media) {
        card.appendChild(media);
      }
    }

    const progressValue = parseProgressValue(post.progressValue);
    if (progressValue !== null) {
      card.appendChild(buildProgress(progressValue));
    }

    const statusDot = buildStatusDot(post);
    if (statusDot) {
      card.appendChild(statusDot);
    }

    container.appendChild(card);
  });
}

function buildStatusDot(post) {
  const dot = document.createElement("span");
  const variant = isPinned(post) ? "pinned" : "normal";
  dot.className = `notice-status-dot notice-status-dot--${variant}`;
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function parseProgressValue(value) {
  if (!value) {
    return null;
  }
  const number = Number.parseFloat(value.replace("%", ""));
  if (Number.isNaN(number)) {
    return null;
  }
  return Math.min(100, Math.max(0, number));
}

function buildProgress(value, isCompact = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "notice-progress";
  if (isCompact) {
    wrapper.classList.add("notice-progress--compact");
  }

  const track = document.createElement("div");
  track.className = "notice-progress__track";

  const bar = document.createElement("div");
  bar.className = "notice-progress__bar";
  bar.style.width = `${value}%`;

  track.appendChild(bar);

  const label = document.createElement("div");
  label.className = "notice-progress__label";
  label.textContent = `Progress ${Math.round(value)}%`;

  wrapper.appendChild(track);
  wrapper.appendChild(label);

  return wrapper;
}

function buildNoticeMeta(post, { compact = false } = {}) {
  const meta = document.createElement("div");
  meta.className = compact ? "notice-meta notice-meta--compact" : "notice-meta";

  const startLabel = post.startRaw || "—";
  const endLabel = post.endRaw || "—";
  const dateInfo = document.createElement("span");
  dateInfo.textContent = `Publish: ${startLabel} · Expired: ${endLabel}`;
  meta.appendChild(dateInfo);
  return meta;
}

function buildNoticeMedia(imageName, title) {
  const resolvedSrc = resolveMediaSrc(imageName);
  const wrapper = document.createElement("div");
  wrapper.className = "notice-media";

  const image = document.createElement("img");
  image.className = "notice-image";
  image.src = resolvedSrc;
  image.alt = title;
  image.loading = "lazy";
  image.dataset.fullsrc = resolvedSrc;
  image.addEventListener("error", () => {
    wrapper.style.display = "none";
  });

  wrapper.appendChild(image);
  return wrapper;
}

function escapeHTML(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  document.addEventListener("click", (event) => {
    const target = event.target.closest(".notice-image");
    if (!target) {
      return;
    }
    event.preventDefault();
    openLightbox(target);
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
    lightboxState.isPanning = true;
    lightboxState.startX = event.clientX;
    lightboxState.startY = event.clientY;
    lightboxState.startTranslateX = lightboxState.translateX;
    lightboxState.startTranslateY = lightboxState.translateY;
    image.setPointerCapture(event.pointerId);
    setLightboxCursor();
  });

  image.addEventListener("pointermove", (event) => {
    if (!lightboxState.isPanning) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - lightboxState.startX;
    const deltaY = event.clientY - lightboxState.startY;
    lightboxState.translateX = lightboxState.startTranslateX + deltaX;
    lightboxState.translateY = lightboxState.startTranslateY + deltaY;
    applyLightboxTransform();
  });

  image.addEventListener("pointerup", (event) => {
    if (!lightboxState.isPanning) {
      return;
    }
    lightboxState.isPanning = false;
    image.releasePointerCapture(event.pointerId);
    setLightboxCursor();
  });

  image.addEventListener("pointercancel", (event) => {
    if (!lightboxState.isPanning) {
      return;
    }
    lightboxState.isPanning = false;
    image.releasePointerCapture(event.pointerId);
    setLightboxCursor();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeLightbox();
    }
  });

  closeButton.addEventListener("click", () => {
    closeLightbox();
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
  resetLightboxTransform();
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("notice-lightbox-open");
  if (window.__ModalScrollLock?.lock) {
    window.__ModalScrollLock.lock();
  }
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
  document.body.classList.remove("notice-lightbox-open");
  if (window.__ModalScrollLock?.unlock) {
    window.__ModalScrollLock.unlock();
  }
  resetLightboxTransform();
}

function resolveMediaSrc(imageName) {
  if (!imageName) {
    return "";
  }
  const base = window.location.pathname.includes("/community/")
    ? MEDIA_BASE_SUBPAGE
    : MEDIA_BASE;
  return new URL(`${base}${imageName}`, window.location.href).toString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyLightboxTransform() {
  const { image } = lightboxElements;
  if (!image) {
    return;
  }
  image.style.transform = `translate(${lightboxState.translateX}px, ${lightboxState.translateY}px) scale(${lightboxState.scale})`;
  image.style.transition = lightboxState.isPanning
    ? "none"
    : "transform 0.2s ease";
  setLightboxCursor();
}

function setLightboxCursor() {
  const { image } = lightboxElements;
  if (!image) {
    return;
  }
  if (lightboxState.scale > 1.01) {
    image.style.cursor = lightboxState.isPanning ? "grabbing" : "grab";
  } else {
    image.style.cursor = "default";
  }
}

function resetLightboxTransform() {
  lightboxState.scale = 1;
  lightboxState.translateX = 0;
  lightboxState.translateY = 0;
  lightboxState.isPanning = false;
  applyLightboxTransform();
}

function handleLightboxZoom(event) {
  const { image } = lightboxElements;
  if (!image) {
    return;
  }
  const direction = event.deltaY > 0 ? -1 : 1;
  const nextScale = clamp(
    lightboxState.scale + direction * LIGHTBOX_SCALE_STEP,
    LIGHTBOX_SCALE_MIN,
    LIGHTBOX_SCALE_MAX
  );
  if (nextScale === lightboxState.scale) {
    return;
  }

  const rect = image.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const scaleFactor = nextScale / lightboxState.scale;
  lightboxState.translateX =
    offsetX - (offsetX - lightboxState.translateX) * scaleFactor;
  lightboxState.translateY =
    offsetY - (offsetY - lightboxState.translateY) * scaleFactor;
  lightboxState.scale = nextScale;

  if (lightboxState.scale <= 1.01) {
    lightboxState.translateX = 0;
    lightboxState.translateY = 0;
  }

  applyLightboxTransform();
}

// Gambar komunitas diambil dari folder media di repo.
