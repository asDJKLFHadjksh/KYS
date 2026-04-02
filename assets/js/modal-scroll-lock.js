(function () {
  let lockCount = 0;
  let savedScrollY = 0;

  function lock() {
    if (lockCount === 0) {
      savedScrollY =
        window.scrollY || document.documentElement.scrollTop || 0;

      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    lockCount += 1;
  }

  function unlock() {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, savedScrollY);
    }
  }

  window.__ModalScrollLock = {
    lock,
    unlock,
  };
})();
