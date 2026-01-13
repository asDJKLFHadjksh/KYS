(() => {
  const LOADER_PATH = new URL(
    "../assets/lottie/Loading.json",
    document.baseURI
  ).toString();
  const LOADER_ID = "global-lottie-loader";
  const STYLE_ID = "global-lottie-loader-style";
  let loadingCount = 0;
  let animationReady = false;
  let loaderDisabled = false;

  ensureStyles();
  const container = ensureContainer();

  if (!container) {
    loaderDisabled = true;
    return;
  }

  if (!window.lottie) {
    console.warn("Lottie belum tersedia. Loader tidak diinisialisasi.");
    loaderDisabled = true;
    return;
  }

  const animation = window.lottie.loadAnimation({
    container,
    renderer: "svg",
    loop: true,
    autoplay: true,
    path: LOADER_PATH,
  });

  animation.addEventListener("DOMLoaded", () => {
    animationReady = true;
    updateVisibility();
  });

  animation.addEventListener("data_failed", () => {
    console.warn("Gagal memuat Lottie loader dari:", LOADER_PATH);
    loaderDisabled = true;
    animationReady = false;
    container.style.display = "none";
  });

  window.showLoader = () => {
    loadingCount += 1;
    updateVisibility();
  };

  window.hideLoader = () => {
    loadingCount = Math.max(loadingCount - 1, 0);
    updateVisibility();
  };

  function updateVisibility() {
    if (loaderDisabled || !animationReady) {
      return;
    }
    container.style.display = loadingCount > 0 ? "block" : "none";
  }

  function ensureContainer() {
    const existing = document.getElementById(LOADER_ID);
    if (existing) {
      return existing;
    }

    const element = document.createElement("div");
    element.id = LOADER_ID;
    element.setAttribute("aria-hidden", "true");
    element.style.display = "none";
    document.body.appendChild(element);
    return element;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${LOADER_ID} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 9999;
        width: 56px;
        height: 56px;
        background: transparent;
        pointer-events: none;
      }

      @media (max-width: 640px) {
        #${LOADER_ID} {
          width: 44px;
          height: 44px;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();
