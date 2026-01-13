(() => {
  const listEl = document.querySelector('[data-link-list]');
  const titleEl = document.querySelector('[data-link-title]');
  const emptyEl = document.querySelector('[data-link-empty]');
  if (!listEl) return;

  const getFaviconUrl = (link) => {
    if (link?.favicon) {
      if (/^https?:\/\//i.test(link.favicon)) {
        return link.favicon;
      }
      return `https://www.google.com/s2/favicons?sz=64&domain=${link.favicon}`;
    }
    try {
      const { hostname } = new URL(link.url);
      return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    } catch (error) {
      return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
    }
  };

  const renderLinks = (links = []) => {
    listEl.innerHTML = '';

    if (!links.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
      }
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = true;
    }

    links.forEach((link) => {
      if (!link?.url) return;
      const anchor = document.createElement('a');
      anchor.className = 'link-btn';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      const icon = document.createElement('img');
      icon.loading = 'lazy';
      icon.alt = '';
      icon.src = getFaviconUrl(link);

      const text = document.createElement('span');
      text.textContent = link.label || link.url;

      anchor.append(icon, text);
      listEl.append(anchor);
    });
  };

  fetch('config/links.json')
    .then((response) => response.json())
    .then((data) => {
      if (titleEl && data?.title) {
        titleEl.textContent = data.title;
      }
      renderLinks(data?.links);
    })
    .catch(() => {
      renderLinks();
    });
})();
