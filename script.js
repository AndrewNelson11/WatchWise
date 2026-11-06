// script.js
document.addEventListener('DOMContentLoaded', () => {
  // ---------- Config ----------
  const COUNTRY = 'us';

  // ---------- Elements ----------
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('[data-panel]');
  const titleForm = document.getElementById('titleForm');
  const titleInput = document.getElementById('titleInput');
  const titleType = document.getElementById('titleType');
  const titleResults = document.getElementById('titleResults');
  const genreForm = document.getElementById('genreForm');
  const genreSelect = document.getElementById('genreSelect');
  const genreType = document.getElementById('genreType');
  const genreResults = document.getElementById('genreResults');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  // ---------- Helpers ----------
  async function apiGet(path, params) {
    // Direct all requests to your internal Vercel Serverless Function proxy
    const url = new URL('/api/movies', window.location.origin);
    url.searchParams.set('path', path);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    let response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error('Could not reach the server. Check your internet connection and try again.');
    }

    if (response.status === 429) {
      throw new Error('Too many requests right now. Wait a minute and try again.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('The API key was rejected. Check your configuration values.');
    }
    if (!response.ok) {
      throw new Error('The movie service had a problem. Try again in a moment.');
    }
    return response.json();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
  }

  function formatRuntime(minutes) {
    if (!minutes) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function showKey(show) {
    return show.id || show.imdbId || show.tmdbId || `${show.title}-${show.releaseYear || show.firstAirYear || ''}`;
  }

  function bestImage(imageObj) {
    if (!imageObj) return '';
    const order = ['w240', 'w360', 'w480', 'w600', 'w720', 'w1080'];
    for (const size of order) {
      if (safeUrl(imageObj[size])) return imageObj[size];
    }
    return '';
  }

  function posterFor(show) {
    const set = show.imageSet;
    if (!set) return '';
    return bestImage(set.verticalPoster) || bestImage(set.horizontalPoster) || '';
  }

  const TYPE_ORDER = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };
  const TYPE_LABEL = { free: 'Free', addon: 'Add-on', rent: 'Rent', buy: 'Buy' };

  function streamingChips(show) {
    const options = Array.isArray(show.streamingOptions?.[COUNTRY]) ? show.streamingOptions[COUNTRY] : [];
    const sorted = [...options].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));
    const seen = new Set();
    let html = '';

    sorted.forEach(opt => {
      const name = typeof opt.service === 'string'
        ? opt.service.charAt(0).toUpperCase() + opt.service.slice(1)
        : opt.service?.name || 'Unknown';
      const link = safeUrl(opt.link);
      if (!link || seen.has(name)) return;
      seen.add(name);
      const label = TYPE_LABEL[opt.type];
      html += `<a class="chip" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(name)}${label ? ` <small>${label}</small>` : ''}</a>`;
    });

    return html
      ? `<div class="chips">${html}</div>`
      : '<p class="not-streaming">Not streaming in the US right now.</p>';
  }

  function cardHtml(show) {
    const title = show.title || show.originalTitle || 'Untitled';
    const year = show.releaseYear || show.firstAirYear || '';
    const rating = typeof show.rating === 'number' ? `★ ${(show.rating / 10).toFixed(1)}` : 'No rating';
    const isSeries = show.showType === 'series';

    let length = '';
    if (isSeries && show.seasonCount) {
      length = `${show.seasonCount} season${show.seasonCount === 1 ? '' : 's'}`;
    } else {
      length = formatRuntime(show.runtime);
    }

    const poster = posterFor(show);
    const posterHtml = poster
      ? `<img src="${escapeHtml(poster)}" alt="Poster for ${escapeHtml(title)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;poster-fallback&quot;>No poster</div>'" />`
      : '<div class="poster-fallback">No poster</div>';

    return `
      <article class="card">
        <div class="poster">${posterHtml}</div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(title)}${year ? ` <span class="year">(${escapeHtml(year)})</span>` : ''}</h3>
          <p class="meta">
            <span class="rating">${rating}</span>
            ${length ? `<span>${escapeHtml(length)}</span>` : ''}
            <span>${isSeries ? 'Show' : 'Movie'}</span>
          </p>
          <p class="overview" title="Click to read more">${escapeHtml(show.overview || 'No description available.')}</p>
          <div class="where">
            <span class="where-label">Where to watch</span>
            ${streamingChips(show)}
          </div>
        </div>
      </article>`;
  }

  function showLoading(container) {
    container.hidden = false;
    container.innerHTML = '<div class="status"><span class="spinner"></span><span>Searching…</span></div>';
  }

  function showMessage(container, heading, body, isError = false) {
    container.hidden = false;
    container.innerHTML = `<div class="message${isError ? ' error' : ''}"><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(body)}</p></div>`;
  }

  document.addEventListener('click', e => {
    const overview = e.target.closest('.overview');
    if (overview) overview.classList.toggle('expanded');
  });

  // ---------- Tabs ----------
  function selectTab(name) {
    tabs.forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
    document.querySelectorAll('[data-results]').forEach(section => {
      const hasContent = section.innerHTML.trim() !== '';
      section.hidden = section.dataset.results !== name || !hasContent;
    });
    loadMoreBtn.hidden = !(name === 'genre' && genreState.hasMore);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      selectTab(next.dataset.tab);
    });
  });

  // ---------- Title search ----------
  titleForm.addEventListener('submit', async e => {
    e.preventDefault();
    const query = titleInput.value.trim();
    if (!query) return;

    showLoading(titleResults);
    try {
      const params = {
        title: query,
        country: COUNTRY,
        series_granularity: 'show',
        output_language: 'en'
      };
      if (titleType.value !== 'both') params.show_type = titleType.value;

      const data = await apiGet('/shows/search/title', params);
      if (!Array.isArray(data) || data.length === 0) {
        showMessage(titleResults, `No results for "${query}"`, 'Check the spelling, or switch the type to "Movies and shows" to search both.');
        return;
      }

      titleResults.innerHTML =
        `<p class="results-summary">${data.length} result${data.length === 1 ? '' : 's'} for "${escapeHtml(query)}"</p>` +
        `<div class="grid">${data.map(cardHtml).join('')}</div>`;
    } catch (err) {
      showMessage(titleResults, 'Something went wrong', err.message, true);
    }
  });

  // ---------- Genre browse ----------
  const genreState = {
    genre: '',
    type: '',
    label: '',
    cursor: null,
    hasMore: false,
    seen: new Set(),
    count: 0
  };

  async function loadGenres() {
    let genres;
    try {
      const res = await fetch('genres.json');
      if (!res.ok) throw new Error('missing');
      genres = await res.json();
    } catch {
      try {
        genres = await apiGet('/genres', { output_language: 'en' });
      } catch {
        genreSelect.innerHTML = '<option value="">Genres unavailable</option>';
        return;
      }
    }
    genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id || genre.name || genre;
      option.textContent = genre.name || genre.id || genre;
      genreSelect.appendChild(option);
    });
  }

  async function loadGenreResults(reset) {
    if (reset) {
      genreState.genre = genreSelect.value;
      genreState.type = genreType.value;
      genreState.label = genreSelect.options[genreSelect.selectedIndex].textContent;
      genreState.cursor = null;
      genreState.hasMore = false;
      genreState.seen = new Set();
      genreState.count = 0;
      loadMoreBtn.hidden = true;
      showLoading(genreResults);
    } else {
      loadMoreBtn.disabled = true;
      loadMoreBtn.textContent = 'Loading…';
    }

    try {
      const params = {
        country: COUNTRY,
        show_type: genreState.type,
        genres: genreState.genre,
        output_language: 'en'
      };
      if (genreState.cursor) params.cursor = genreState.cursor;

      const data = await apiGet('/shows/search/filters', params);
      genreState.cursor = data.nextCursor || null;
      genreState.hasMore = Boolean(data.hasMore && data.nextCursor);

      const shows = Array.isArray(data.shows) ? data.shows : Array.isArray(data) ? data : [];
      const newShows = shows.filter(show => {
        const key = showKey(show);
        if (genreState.seen.has(key)) return false;
        genreState.seen.add(key);
        return true;
      });
      genreState.count += newShows.length;

      const summary = `<p class="results-summary">${genreState.count} result${genreState.count === 1 ? '' : 's'} for ${escapeHtml(genreState.label)}</p>`;
      const grid = newShows.map(cardHtml).join('');
      if (reset) {
        genreResults.innerHTML = summary + (grid ? `<div class="grid">${grid}</div>` : '<p class="message">No results found.</p>');
      } else if (grid) {
        genreResults.querySelector('.results-summary').outerHTML = summary;
        genreResults.querySelector('.grid').insertAdjacentHTML('beforeend', grid);
      }
      loadMoreBtn.hidden = !genreState.hasMore;
    } catch (err) {
      if (reset) {
        showMessage(genreResults, 'Something went wrong', err.message, true);
      } else {
        showMessage(genreResults, 'Something went wrong', err.message, true);
      }
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = 'Load more';
    }
  }

  genreForm.addEventListener('submit', e => {
    e.preventDefault();
    loadGenreResults(true);
  });

  loadMoreBtn.addEventListener('click', () => loadGenreResults(false));
  loadGenres();
});