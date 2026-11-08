/* =========================================================
   SYVEX — interactions
   Entry screen, background film audio, typewriter, cursor trail.
   ========================================================= */

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const html = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const DISCORD_ID = '1541054427996094575';

  const entry = $('#entry');
  const entryButton = $('#entryButton');
  const topbar = $('#topbar');
  const main = $('#main');
  const footer = $('.site-footer');
  const skipLink = $('.skip-link');
  const video = $('#bgVideo');
  const soundToggle = $('#soundToggle');
  const soundLabel = $('#soundLabel');
  const soundPanel = $('.sound-panel');
  const playPause = $('#playPause');
  const audioMute = $('#audioMute');
  const audioSeek = $('#audioSeek');
  const audioCurrent = $('#audioCurrent');
  const audioDuration = $('#audioDuration');
  const audioState = $('#audioState');
  const volumeRange = $('#volumeRange');
  const waveform = $('#waveform');
  const typewriter = $('#typewriter');
  const toast = $('#toast');
  const scrollProgress = $('#scrollProgress');
  const backToTop = $('#backToTop');
  const cursor = $('#cursor');
  const trailCanvas = $('#trailCanvas');

  let entered = false;
  let typeTimer = 0;
  let toastTimer = 0;
  let seeking = false;
  let resumeAfterHidden = false;
  let revealObserver = null;

  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  window.scrollTo(0, 0);

  /* -------------------------------------------------------
     Keep the page behind the entry screen out of the tab order
     ------------------------------------------------------- */
  const inertElements = [topbar, main, footer, skipLink].filter(Boolean);
  inertElements.forEach((element) => {
    element.inert = true;
  });

  /* -------------------------------------------------------
     Toast
     ------------------------------------------------------- */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  /* -------------------------------------------------------
     Clock
     ------------------------------------------------------- */
  const fullClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const shortClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  function updateClock() {
    const now = new Date();
    const full = fullClock.format(now);
    const short = shortClock.format(now);

    $$('[data-clock="full"]').forEach((node) => {
      node.textContent = full;
    });

    $$('[data-clock="short"]').forEach((node) => {
      node.textContent = short;
    });

    const entryTime = $('#entryTime');
    if (entryTime) entryTime.textContent = short;
  }

  updateClock();
  window.setInterval(updateClock, 1000);

  /* -------------------------------------------------------
     Reveal animations
     ------------------------------------------------------- */
  function revealAll() {
    $$('.reveal').forEach((element) => element.classList.add('is-visible'));
  }

  function startReveals() {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    if (revealObserver) revealObserver.disconnect();

    revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entryItem) => {
          if (!entryItem.isIntersecting) return;
          entryItem.target.classList.add('is-visible');
          observer.unobserve(entryItem.target);
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -7% 0px'
      }
    );

    $$('.reveal').forEach((element) => revealObserver.observe(element));
  }

  /* -------------------------------------------------------
     Typewriter
     ------------------------------------------------------- */
  const typeLines = [
    'independent developer',
    'interface engineer',
    'game developer',
    'football fan'
  ];

  let typeIndex = 0;
  let typeCharacter = 0;
  let deleting = false;

  function typeLoop() {
    if (!typewriter) return;

    if (reduceMotion) {
      typewriter.textContent = typeLines[0];
      return;
    }

    const line = typeLines[typeIndex];

    if (!deleting) {
      typeCharacter += 1;
      typewriter.textContent = line.slice(0, typeCharacter);

      if (typeCharacter >= line.length) {
        deleting = true;
        typeTimer = window.setTimeout(typeLoop, 1900);
        return;
      }

      typeTimer = window.setTimeout(typeLoop, 55 + Math.random() * 35);
      return;
    }

    typeCharacter -= 1;
    typewriter.textContent = line.slice(0, typeCharacter);

    if (typeCharacter <= 0) {
      deleting = false;
      typeIndex = (typeIndex + 1) % typeLines.length;
      typeTimer = window.setTimeout(typeLoop, 320);
      return;
    }

    typeTimer = window.setTimeout(typeLoop, 28);
  }

  function startTypewriter() {
    if (!typewriter || typewriter.dataset.started === 'true') return;
    typewriter.dataset.started = 'true';
    typeCharacter = 0;
    deleting = false;
    typeIndex = 0;
    typewriter.textContent = '';
    typeLoop();
  }

  /* -------------------------------------------------------
     Video / audio
     ------------------------------------------------------- */
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const whole = Math.floor(seconds);
    const minutes = Math.floor(whole / 60);
    const rest = String(whole % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function updateRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
    input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, percent))}%`);
  }

  function isMuted() {
    return !video || video.muted || video.volume === 0;
  }

  function syncMediaUI() {
    if (!video) return;

    const playing = !video.paused && !video.ended;
    const muted = isMuted();
    const duration = Number.isFinite(video.duration) ? video.duration : 0;

    body.classList.toggle('video-playing', playing);
    body.classList.toggle('sound-muted', muted);

    if (soundToggle) {
      soundToggle.setAttribute('aria-pressed', String(!muted));
      soundToggle.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
      soundToggle.classList.toggle('is-active', playing && !muted);
    }

    if (soundLabel) {
      soundLabel.textContent = muted ? 'Sound off' : 'Sound on';
    }

    if (soundPanel) {
      soundPanel.classList.toggle('is-playing', playing);
    }

    if (playPause) {
      playPause.setAttribute('aria-label', playing ? 'Pause background film' : 'Play background film');
    }

    if (audioMute) {
      audioMute.classList.toggle('is-muted', muted);
      audioMute.setAttribute('aria-label', muted ? 'Unmute background film' : 'Mute background film');
    }

    if (audioState) {
      audioState.textContent = muted ? 'Muted' : playing ? 'Playing' : 'Paused';
    }

    if (audioDuration && duration > 0) {
      audioDuration.textContent = formatTime(duration);
    }

    if (audioCurrent) {
      audioCurrent.textContent = formatTime(video.currentTime);
    }

    if (audioSeek) {
      if (!seeking && duration > 0) {
        audioSeek.value = String(Math.round((video.currentTime / duration) * 1000));
        updateRangeFill(audioSeek);
      }
    }

    if (volumeRange) {
      volumeRange.value = String(Math.round(muted ? 0 : video.volume * 100));
      updateRangeFill(volumeRange);
    }
  }

  function playFilm() {
    if (!video) return;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        syncMediaUI();
      });
    }
  }

  function setSoundOn() {
    if (!video) return;
    video.muted = false;
    if (video.volume === 0) video.volume = 0.6;
    if (video.paused) playFilm();
    syncMediaUI();
  }

  function setSoundOff() {
    if (!video) return;
    video.muted = true;
    syncMediaUI();
  }

  function toggleSound() {
    if (!video) return;
    if (isMuted()) {
      setSoundOn();
    } else {
      setSoundOff();
    }
  }

  function initVideo() {
    if (!video) return;

    video.muted = true;
    video.volume = 0.6;

    video.addEventListener('loadedmetadata', () => {
      if (audioDuration && Number.isFinite(video.duration)) {
        audioDuration.textContent = formatTime(video.duration);
      }
      syncMediaUI();
    });

    video.addEventListener('timeupdate', syncMediaUI);
    video.addEventListener('play', syncMediaUI);
    video.addEventListener('pause', syncMediaUI);
    video.addEventListener('volumechange', syncMediaUI);
    video.addEventListener('ended', syncMediaUI);

    video.addEventListener('error', () => {
      body.classList.add('video-error');
    });

    const initialPlay = video.play();
    if (initialPlay && typeof initialPlay.catch === 'function') {
      initialPlay.catch(() => {
        /* The poster stays visible until the visitor enters. */
      });
    }

    syncMediaUI();
  }

  if (video) {
    initVideo();

    soundToggle?.addEventListener('click', toggleSound);
    audioMute?.addEventListener('click', toggleSound);

    playPause?.addEventListener('click', () => {
      if (!video) return;
      if (video.paused) {
        playFilm();
      } else {
        video.pause();
      }
      syncMediaUI();
    });

    audioSeek?.addEventListener('input', () => {
      if (!video) return;
      seeking = true;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const ratio = Number(audioSeek.value) / 1000;
      if (audioCurrent) audioCurrent.textContent = formatTime(duration * ratio);
      updateRangeFill(audioSeek);
    });

    audioSeek?.addEventListener('change', () => {
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration > 0) {
        video.currentTime = (Number(audioSeek.value) / 1000) * duration;
      }
      seeking = false;
      syncMediaUI();
    });

    volumeRange?.addEventListener('input', () => {
      if (!video) return;
      const nextVolume = Number(volumeRange.value) / 100;
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
      updateRangeFill(volumeRange);
      syncMediaUI();
    });

    document.addEventListener('visibilitychange', () => {
      if (!video) return;

      if (document.hidden) {
        resumeAfterHidden = !video.paused;
        if (resumeAfterHidden) video.pause();
        return;
      }

      if (resumeAfterHidden && entered) {
        playFilm();
      }
      resumeAfterHidden = false;
    });
  }

  /* -------------------------------------------------------
     Waveform
     ------------------------------------------------------- */
  function buildWaveform() {
    if (!waveform) return;

    const count = 32;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      const bar = document.createElement('i');
      const height = 9 + Math.round(Math.abs(Math.sin(index * 1.67)) * 27);
      bar.style.setProperty('--h', `${height}px`);
      bar.style.setProperty('--i', String(index));
      fragment.appendChild(bar);
    }

    waveform.appendChild(fragment);
  }

  buildWaveform();
  if (audioSeek) updateRangeFill(audioSeek);
  if (volumeRange) updateRangeFill(volumeRange);

  /* -------------------------------------------------------
     Copy Discord ID
     ------------------------------------------------------- */
  async function copyDiscordId() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(DISCORD_ID);
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = DISCORD_ID;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        /* Fall through to the toast below. */
      }
      textarea.remove();
    }

    showToast('Discord ID copied');
  }

  $$('[data-copy-discord]').forEach((button) => {
    button.addEventListener('click', copyDiscordId);
  });

  /* -------------------------------------------------------
     Entry
     ------------------------------------------------------- */
  function enterSite() {
    if (entered) return;
    entered = true;

    body.classList.remove('entry-open');
    body.classList.add('entered');
    inertElements.forEach((element) => {
      element.inert = false;
    });

    if (entry) {
      entry.setAttribute('aria-hidden', 'true');
      entry.inert = true;
    }

    if (video) {
      video.muted = false;
      if (video.volume === 0) video.volume = 0.6;
      playFilm();
      syncMediaUI();
    }

    startReveals();
    startTypewriter();
    updateClock();
    updateScrollState();

    if (entry) {
      window.setTimeout(() => {
        entry.style.display = 'none';
      }, reduceMotion ? 20 : 1100);
    }

    const brand = $('.brand', topbar || document);
    if (brand) {
      window.setTimeout(() => {
        brand.focus({ preventScroll: true });
      }, reduceMotion ? 20 : 750);
    }
  }

  entryButton?.addEventListener('click', enterSite);

  entry?.addEventListener('click', () => {
    enterSite();
  });

  document.addEventListener('keydown', (event) => {
    if (entered) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    enterSite();
  });

  /* -------------------------------------------------------
     Scroll state
     ------------------------------------------------------- */
  let scrollTicking = false;

  function updateScrollState() {
    const scrollTop = window.scrollY || window.pageYOffset;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(scrollTop / scrollable, 1) : 0;

    if (topbar) topbar.classList.toggle('is-scrolled', scrollTop > 36);
    if (scrollProgress) scrollProgress.style.transform = `scaleX(${progress})`;
    if (backToTop) backToTop.classList.toggle('is-visible', scrollTop > 620);
  }

  window.addEventListener(
    'scroll',
    () => {
      if (scrollTicking) return;
      scrollTicking = true;
      window.requestAnimationFrame(() => {
        updateScrollState();
        scrollTicking = false;
      });
    },
    { passive: true }
  );

  window.addEventListener('resize', updateScrollState);
  updateScrollState();

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* -------------------------------------------------------
     Custom Windows-style cursor + trail
     ------------------------------------------------------- */
  function initCursor() {
    if (!cursor || !trailCanvas || !finePointer || reduceMotion) return;

    const context = trailCanvas.getContext('2d');
    if (!context) return;

    html.classList.add('cursor-ready');

    let width = 0;
    let height = 0;
    let dpr = 1;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let lastPointTime = 0;
    let points = [];
    let frame = 0;

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      trailCanvas.width = Math.floor(width * dpr);
      trailCanvas.height = Math.floor(height * dpr);
      trailCanvas.style.width = `${width}px`;
      trailCanvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function showCursor() {
      cursor.classList.add('is-visible');
      trailCanvas.classList.add('is-visible');
    }

    function hideCursor() {
      cursor.classList.remove('is-visible');
      trailCanvas.classList.remove('is-visible');
    }

    function onPointerMove(event) {
      mouseX = event.clientX;
      mouseY = event.clientY;
      showCursor();

      const now = performance.now();
      if (now - lastPointTime > 14) {
        points.push({
          x: mouseX,
          y: mouseY,
          life: 1,
          size: 1.1 + Math.random() * 1.2
        });

        if (points.length > 70) points.shift();
        lastPointTime = now;
      }
    }

    function onPointerOver(event) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('a, button, input, [role="button"]')) {
        cursor.classList.add('is-hover');
      }
    }

    function onPointerOut(event) {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('a, button, input, [role="button"]')) {
        cursor.classList.remove('is-hover');
      }
    }

    function render() {
      cursorX += (mouseX - cursorX) * 0.24;
      cursorY += (mouseY - cursorY) * 0.24;
      cursor.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

      context.clearRect(0, 0, width, height);

      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        point.life -= 0.034;

        if (point.life <= 0) continue;

        if (index > 0 && points[index - 1].life > 0) {
          context.beginPath();
          context.moveTo(points[index - 1].x, points[index - 1].y);
          context.lineTo(point.x, point.y);
          context.strokeStyle = `rgba(255, 255, 255, ${point.life * 0.055})`;
          context.lineWidth = 1;
          context.stroke();
        }

        context.beginPath();
        context.arc(point.x, point.y, Math.max(0.2, point.size * point.life), 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${point.life * 0.2})`;
        context.fill();
      }

      points = points.filter((point) => point.life > 0);
      frame = window.requestAnimationFrame(render);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerover', onPointerOver, { passive: true });
    document.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('mouseleave', hideCursor);
    document.documentElement.addEventListener('mouseleave', hideCursor);
    window.addEventListener('blur', hideCursor);
    window.addEventListener('focus', showCursor);

    frame = window.requestAnimationFrame(render);

    window.addEventListener('pagehide', () => {
      window.cancelAnimationFrame(frame);
    });
  }

  initCursor();

  /* -------------------------------------------------------
     Failsafe: if something unexpected happens, never trap the
     visitor behind the entry screen.
     ------------------------------------------------------- */
  window.addEventListener('error', () => {
    if (entered) return;
    entered = true;
    body.classList.remove('entry-open');
    body.classList.add('entered');
    inertElements.forEach((element) => {
      element.inert = false;
    });
    if (entry) {
      entry.setAttribute('aria-hidden', 'true');
      entry.style.display = 'none';
    }
    revealAll();
  });
})();
