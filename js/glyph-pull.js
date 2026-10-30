const ENABLE_GLYPH_PULL_TEST = true;

  // Desktop: auto trigger before absolute bottom so wheel/trackpad always reaches it.
  const DESKTOP_TRIGGER_PROGRESS = 0.91;
  const DESKTOP_REARM_PROGRESS = 0.82;

  // Touch: once the page is near the end, the next upward finger pull controls the effect.
  const TOUCH_ARM_PROGRESS = 0.70;
  const TOUCH_PULL_DISTANCE = 82;

  if (ENABLE_GLYPH_PULL_TEST) {
    const heroEl = document.querySelector(".hero");
    const sourceLines = Array.from(document.querySelectorAll(".hero .typing-line"));
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const hasTouchInput = () => (navigator.maxTouchPoints || 0) > 0;
    const isTouchViewport = () =>
      coarsePointer.matches && window.innerWidth <= 980;

    let overlayEl = null;
    let glyphStates = [];
    let glyphPullRunning = false;
    let desktopArmed = true;
    let autoSequenceRunning = false;
    let releaseRaf = 0;
    let autoRaf = 0;

    let touchCandidate = false;
    let touchActive = false;
    let touchStartY = 0;
    let touchStartProgress = 0;
    let touchFocusX = window.innerWidth * 0.5;
    let touchFocusY = window.innerHeight * 0.5;
    let mobileScrollArmed = true;
    let currentPull = 0;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function getScrollProgress() {
      const y = window.pageYOffset || window.scrollY || 0;
      const doc = document.documentElement;
      const body = document.body;

      const scrollHeight = Math.max(
        body.scrollHeight, doc.scrollHeight,
        body.offsetHeight, doc.offsetHeight,
        body.clientHeight, doc.clientHeight
      );

      const maxScroll = Math.max(1, scrollHeight - window.innerHeight);
      return clamp(y / maxScroll, 0, 1);
    }

    function collectGlyphsFromElement(root) {
      const glyphs = [];
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            return node.nodeValue && node.nodeValue.length
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
        }
      );

      let textNode;
      while ((textNode = walker.nextNode())) {
        const text = textNode.nodeValue;

        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === "\n" || ch === "\r") continue;

          const range = document.createRange();
          range.setStart(textNode, i);
          range.setEnd(textNode, i + 1);

          const rect = range.getBoundingClientRect();
          range.detach?.();

          if (!rect || rect.width <= 0 || rect.height <= 0) continue;

          glyphs.push({
            char: ch,
            rect,
            style: getComputedStyle(textNode.parentElement || root)
          });
        }
      }

      return glyphs;
    }

    function makeGlyphElement(glyph) {
      const el = document.createElement("span");
      el.className = "glyph-pull-char";
      el.textContent = glyph.char === " " ? "\u00A0" : glyph.char;

      const mobile = isTouchViewport() || window.innerWidth <= 980;
      const renderScale = mobile ? 1 : 2.75;

      const baseFontPx = parseFloat(glyph.style.fontSize) || glyph.rect.height;
      const baseLinePx = parseFloat(glyph.style.lineHeight) || glyph.rect.height;

      el.dataset.renderScale = String(renderScale);

      el.style.left = `${glyph.rect.left}px`;
      el.style.top = `${glyph.rect.top}px`;
      el.style.width = `${glyph.rect.width * renderScale}px`;
      el.style.height = `${glyph.rect.height * renderScale}px`;

      el.style.fontFamily = glyph.style.fontFamily;
      el.style.fontSize = `${baseFontPx * renderScale}px`;
      el.style.fontWeight = glyph.style.fontWeight;
      el.style.fontStyle = glyph.style.fontStyle;
      el.style.lineHeight = `${baseLinePx * renderScale}px`;
      el.style.letterSpacing = glyph.style.letterSpacing;
      el.style.color = glyph.style.color;
      el.style.textTransform = glyph.style.textTransform;
      el.style.textDecoration = glyph.style.textDecoration;

      // Anchor the oversampled glyph back onto the exact original character box.
      el.style.transformOrigin = "0 0";
      el.style.transform = `scale(${(1 / renderScale).toFixed(4)})`;

      return el;
    }

    function getPullVector(
      glyph,
      index,
      total,
      centerX = window.innerWidth * 0.5,
      centerY = window.innerHeight * 0.48
    ) {
      const cx = glyph.rect.left + glyph.rect.width * 0.5;
      const cy = glyph.rect.top + glyph.rect.height * 0.5;

      let vx = cx - centerX;
      let vy = cy - centerY;
      const length = Math.max(1, Math.hypot(vx, vy));
      vx /= length;
      vy /= length;

      // Deterministic per-letter direction; never random between frames.
      const a = Math.sin(index * 1.91 + total * 0.137);
      const b = Math.cos(index * 2.47 + total * 0.091);
      const c = Math.sin(index * 0.83 + total * 0.053);

      const mobile = isTouchViewport() || window.innerWidth <= 980;

      const radial = mobile ? 78 : 158;
      const scatterX = mobile ? 48 : 108;
      const scatterY = mobile ? 32 : 72;

      const dx = vx * radial + a * scatterX + c * scatterX * 0.28;
      const dy = vy * radial * 0.68 + b * scatterY;

      const baseScale = mobile ? 1.88 : 2.10;
      const scaleVariation = mobile ? 0.58 : 0.70;
      const scale = baseScale + ((a + 1) * 0.5) * scaleVariation;

      const rotate = a * (mobile ? 5.5 : 8.0);

      return { dx, dy, scale, rotate };
    }

    function ensureOverlay() {
      if (overlayEl) return true;

      const glyphData = [];
      sourceLines.forEach((line) => {
        glyphData.push(...collectGlyphsFromElement(line));
      });

      if (!glyphData.length) return false;

      overlayEl = document.createElement("div");
      overlayEl.id = "glyph-pull-overlay";
      document.body.appendChild(overlayEl);

      const total = glyphData.length;
      glyphStates = glyphData.map((glyph, index) => {
        const el = makeGlyphElement(glyph);
        const vector = getPullVector(glyph, index, total);
        overlayEl.appendChild(el);
        return { el, glyph, index, total, ...vector };
      });

      heroEl.classList.add("glyph-pull-source-hidden");
      glyphPullRunning = true;
      return true;
    }

    function easedPull(p) {
      const sign = p < 0 ? -1 : 1;
      const x = clamp(Math.abs(p), 0, 1);
      return sign * (1 - Math.pow(1 - x, 3));
    }

    function setPullProgress(progress) {
      if (!ensureOverlay()) return;

      currentPull = progress;
      const p = easedPull(progress);

      glyphStates.forEach((g) => {
        let dx = g.dx;
        let dy = g.dy;
        let scale = g.scale;
        let rotate = g.rotate;

        if (touchActive && hasTouchInput()) {
          const liveVector = getPullVector(
            g.glyph,
            g.index,
            g.total,
            touchFocusX,
            touchFocusY
          );
          dx = liveVector.dx;
          dy = liveVector.dy;
          scale = liveVector.scale;
          rotate = liveVector.rotate;
        }

        const x = dx * p;
        const y = dy * p;
        const visualScale = 1 + (scale - 1) * p;
        const renderScale = parseFloat(g.el.dataset.renderScale || "1");
        const cssScale = visualScale / renderScale;
        const rotation = rotate * p;

        // Pure 2D transform keeps text significantly sharper than perspective/
        // translateZ scaling in Chromium while preserving the "coming closer" read.
        g.el.style.transform =
          `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) ` +
          `scale(${cssScale.toFixed(4)}) rotate(${rotation.toFixed(2)}deg)`;
      });
    }

    function cleanupGlyphPull() {
      cancelAnimationFrame(releaseRaf);
      cancelAnimationFrame(autoRaf);
      releaseRaf = 0;
      autoRaf = 0;

      if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
      }

      glyphStates = [];
      currentPull = 0;
      glyphPullRunning = false;
      autoSequenceRunning = false;
      heroEl.classList.remove("glyph-pull-source-hidden");
    }

    function springRelease(from = currentPull) {
      cancelAnimationFrame(releaseRaf);
      cancelAnimationFrame(autoRaf);
      autoRaf = 0;
      autoSequenceRunning = false;

      if (!overlayEl) return;

      const start = performance.now();
      const duration = 430;

      function frame(now) {
        const t = clamp((now - start) / duration, 0, 1);

        // Damped spring: starts exactly at 'from', crosses slightly past zero,
        // then settles quickly back in the original typography.
        const spring =
          Math.exp(-5.4 * t) * Math.cos(10.4 * t);

        const releaseValue = isTouchViewport()
          ? from * spring
          : from * Math.max(-0.08, spring);

        setPullProgress(releaseValue);

        if (t < 1) {
          releaseRaf = requestAnimationFrame(frame);
        } else {
          cleanupGlyphPull();
        }
      }

      releaseRaf = requestAnimationFrame(frame);
    }

    function autoPullHoldRelease(allowTouchAuto = false) {
      if (
        autoSequenceRunning ||
        touchActive ||
        (isTouchViewport() && !allowTouchAuto)
      ) return;

      autoSequenceRunning = true;
      if (!ensureOverlay()) {
        autoSequenceRunning = false;
        return;
      }

      const start = performance.now();
      const mobileAuto = isTouchViewport() && allowTouchAuto;
      const pullMs = mobileAuto ? 165 : 180;
      const holdMs = mobileAuto ? 210 : 260;
      const totalBeforeRelease = pullMs + holdMs;

      function frame(now) {
        const elapsed = now - start;

        if (elapsed <= pullMs) {
          const t = clamp(elapsed / pullMs, 0, 1);
          const fastEase = 1 - Math.pow(1 - t, 3);
          setPullProgress(fastEase);
          autoRaf = requestAnimationFrame(frame);
          return;
        }

        setPullProgress(1);

        if (elapsed < totalBeforeRelease) {
          autoRaf = requestAnimationFrame(frame);
          return;
        }

        autoRaf = 0;
        springRelease(1);
      }

      autoRaf = requestAnimationFrame(frame);
    }

    let lastDesktopY = window.scrollY || 0;

    function desktopShouldTrigger() {
      if (isTouchViewport()) return false;
      if (autoSequenceRunning || touchActive || touchCandidate) return false;

      const progress = getScrollProgress();
      return progress >= DESKTOP_TRIGGER_PROGRESS;
    }

    function triggerDesktopEffect() {
      if (!desktopShouldTrigger() || !desktopArmed) return;
      desktopArmed = false;
      autoPullHoldRelease();
    }

    function handleDesktopScroll() {
      if (isTouchViewport()) return;

      const y = window.scrollY || window.pageYOffset || 0;
      const movingDown = y > lastDesktopY + 1;
      lastDesktopY = y;

      if (movingDown && desktopShouldTrigger()) {
        triggerDesktopEffect();
      }

      if (getScrollProgress() <= DESKTOP_REARM_PROGRESS) {
        desktopArmed = true;
      }
    }

    window.addEventListener("scroll", handleDesktopScroll, { passive: true });

    window.addEventListener(
      "wheel",
      (event) => {
        if (isTouchViewport()) return;
        if (event.deltaY > 0 && getScrollProgress() >= 0.72) {
          triggerDesktopEffect();
        }
      },
      { passive: true }
    );

    // Keyboard/PageDown/End fallback.
    window.addEventListener("keydown", (event) => {
      if (isTouchViewport()) return;
      if (
        ["ArrowDown", "PageDown", "End", " "].includes(event.key) &&
        getScrollProgress() >= 0.72
      ) {
        setTimeout(triggerDesktopEffect, 0);
      }
    });

    window.addEventListener("load", () => {
      lastDesktopY = window.scrollY || 0;
    });

    function handleMobileScrollTrigger() {
      if (!isTouchViewport()) return;

      const progress = getScrollProgress();

      const atHardBottom =
        progress >= 0.995 ||
        (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 3);

      if (
        atHardBottom &&
        mobileScrollArmed &&
        !touchActive &&
        !glyphPullRunning &&
        !autoSequenceRunning
      ) {
        mobileScrollArmed = false;

        // This is the missing first-swipe path:
        // scrolling itself launches the effect; no second finger pull required.
        touchCandidate = false;
        autoPullHoldRelease(true);
        return;
      }

      if (
        progress <= 0.62 &&
        !glyphPullRunning &&
        !autoSequenceRunning
      ) {
        mobileScrollArmed = true;
      }
    }

    window.addEventListener("scroll", handleMobileScrollTrigger, { passive: true });

    window.addEventListener(
      "touchstart",
      (event) => {
        if (!hasTouchInput()) return;
        if (event.touches.length !== 1) return;

        touchStartProgress = getScrollProgress();
        touchCandidate = touchStartProgress >= 0.52;
        touchActive = false;

        touchFocusX = event.touches[0].clientX;
        touchFocusY = event.touches[0].clientY;

        if (touchCandidate) {
          touchStartY = event.touches[0].clientY;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (event) => {
        if (!touchCandidate || event.touches.length !== 1) return;

        const y = event.touches[0].clientY;
        touchFocusX = event.touches[0].clientX;
        touchFocusY = y;

        const upwardPull = touchStartY - y;
        const liveProgress = getScrollProgress();

        // Activate during the SAME first gesture as soon as scrolling reaches
        // the end-zone. The user no longer needs to lift and drag a second time.
        if (
          !touchActive &&
          upwardPull > 5 &&
          (liveProgress >= TOUCH_ARM_PROGRESS || touchStartProgress >= TOUCH_ARM_PROGRESS)
        ) {
          touchActive = true;
          mobileScrollArmed = false;
          // Rebase the gesture at the activation point so the pull begins
          // immediately and naturally instead of jumping to a large value.
          touchStartY = y + 5;
          ensureOverlay();
        }

        if (!touchActive) return;

        event.preventDefault();

        const pull = clamp((touchStartY - y) / TOUCH_PULL_DISTANCE, 0, 1);
        setPullProgress(pull);
        // Holding the finger in place simply leaves this exact transform frozen.
      },
      { passive: false }
    );

    function finishTouchPull() {
      if (!touchCandidate) return;

      const wasActive = touchActive;
      touchCandidate = false;
      touchActive = false;

      if (wasActive && overlayEl) {
        springRelease(currentPull);
      }
    }

    window.addEventListener("touchend", finishTouchPull, { passive: true });
    window.addEventListener("touchcancel", finishTouchPull, { passive: true });

    window.addEventListener(
      "resize",
      () => {
        if (glyphPullRunning) cleanupGlyphPull();
      },
      { passive: true }
    );
  }
