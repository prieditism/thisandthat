const line1Text = "Mārtiņš Priedītis (Martins Prieditis)";
    const line2Text = "New Media & Creative AI";
    const line3Text = "Human–AI Interaction";
    const line4Text = "Audiovisual Systems Designer";
    const line5Plain = "Founder @reverie™";
    const line5Html = 'Founder <a href="https://www.reverie.lv" target="_blank" rel="noopener noreferrer">@reverie™</a>';

    const line6Plain = "building reverie™ technologies";
    const line6Html = 'building <a href="https://reverie.systems/" target="_blank" rel="noopener noreferrer">reverie™ technologies</a>';

    const line7Text = "Machine Hermeneutics as Artistic Practice";

    const line8Plain = "in | orcid | ig | yt | tiktok | email | call";
    const line8Html = `
      <a href="https://www.linkedin.com/in/martins-prieditis" target="_blank" rel="noopener noreferrer">in</a>
      |
      <a href="https://orcid.org/0009-0006-7257-5139" target="_blank" rel="noopener noreferrer">orcid</a>
      |
      <a href="https://www.instagram.com/martins.prieditis" target="_blank" rel="noopener noreferrer">ig</a>
      |
      <a href="https://www.youtube.com/@martinsprieditis" target="_blank" rel="noopener noreferrer">yt</a>
      |
      <a href="https://www.tiktok.com/@martins.prieditis" target="_blank" rel="noopener noreferrer">tiktok</a>
      |
      <a href="mailto:martins@prieditis.eu">email</a>
      |
      <a href="tel:+37126022841">call</a>
    `;

    const line1El = document.getElementById("line1");
    const line2El = document.getElementById("line2");
    const line3El = document.getElementById("line3");
    const line4El = document.getElementById("line4");
    const line5El = document.getElementById("line5");
    const line6El = document.getElementById("line6");
    const line7El = document.getElementById("line7");
    const line8El = document.getElementById("line8");

    const cursor = document.createElement("span");
    cursor.className = "cursor";

    const lines = [
      line1Text,
      line2Text,
      line3Text,
      line4Text,
      line5Plain,
      line6Plain,
      line7Text,
      line8Plain
    ];

    const totalChars = lines.reduce((sum, line) => sum + line.length, 0);

    let activeTarget = null;

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function renderPartialLinkedText(container, fullPlain, fullHtml, count) {
      if (count <= 0) {
        container.innerHTML = "";
        return;
      }

      if (count >= fullPlain.length) {
        container.innerHTML = fullHtml;
        return;
      }

      container.textContent = fullPlain.slice(0, count);
    }

    function setCursorTarget(target) {
      activeTarget = target;
    }

    function mountCursor() {
      if (activeTarget && cursor.parentNode !== activeTarget) {
        activeTarget.appendChild(cursor);
      }
    }

    function updateTyping() {
      const introDelay = window.innerHeight * 0.12;
      const start = introDelay;
      const end = window.innerHeight * 0.88;

      let progress = (window.scrollY - start) / (end - start);
      progress = clamp(progress, 0, 1);

      const visibleChars = Math.floor(totalChars * progress);

      let remaining = visibleChars;

      const c1 = clamp(remaining, 0, line1Text.length);
      remaining -= c1;

      const c2 = clamp(remaining, 0, line2Text.length);
      remaining -= c2;

      const c3 = clamp(remaining, 0, line3Text.length);
      remaining -= c3;

      const c4 = clamp(remaining, 0, line4Text.length);
      remaining -= c4;

      const c5 = clamp(remaining, 0, line5Plain.length);
      remaining -= c5;

      const c6 = clamp(remaining, 0, line6Plain.length);
      remaining -= c6;

      const c7 = clamp(remaining, 0, line7Text.length);
      remaining -= c7;

      const c8 = clamp(remaining, 0, line8Plain.length);

      line1El.textContent = line1Text.slice(0, c1);
      line2El.textContent = line2Text.slice(0, c2);
      line3El.textContent = line3Text.slice(0, c3);
      line4El.textContent = line4Text.slice(0, c4);
      line7El.textContent = line7Text.slice(0, c7);

      renderPartialLinkedText(line5El, line5Plain, line5Html, c5);
      renderPartialLinkedText(line6El, line6Plain, line6Html, c6);
      renderPartialLinkedText(line8El, line8Plain, line8Html, c8);

      const b1 = line1Text.length;
      const b2 = b1 + line2Text.length;
      const b3 = b2 + line3Text.length;
      const b4 = b3 + line4Text.length;
      const b5 = b4 + line5Plain.length;
      const b6 = b5 + line6Plain.length;
      const b7 = b6 + line7Text.length;

      if (visibleChars < b1) {
        setCursorTarget(line1El);
      } else if (visibleChars < b2) {
        setCursorTarget(line2El);
      } else if (visibleChars < b3) {
        setCursorTarget(line3El);
      } else if (visibleChars < b4) {
        setCursorTarget(line4El);
      } else if (visibleChars < b5) {
        setCursorTarget(line5El);
      } else if (visibleChars < b6) {
        setCursorTarget(line6El);
      } else if (visibleChars < b7) {
        setCursorTarget(line7El);
      } else {
        setCursorTarget(line8El);
      }

      mountCursor();
    }

    setInterval(() => {
      cursor.classList.toggle("is-off");
    }, 530);

    window.addEventListener("scroll", updateTyping, { passive: true });
    window.addEventListener("resize", updateTyping);
    window.addEventListener("load", () => {
      setCursorTarget(line1El);
      mountCursor();
      updateTyping();
    });

    setCursorTarget(line1El);
    mountCursor();
    // Render immediately so the pre-rendered HTML does not flash before the load event.
    updateTyping();
