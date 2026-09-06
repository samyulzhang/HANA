/* ==========================================================================
   ForegoneAI — HANA
   Motion + canvas layer.  Vanilla JS, no dependencies.
   ========================================================================== */
(function () {
  "use strict";

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COARSE  = window.matchMedia("(pointer: coarse)").matches;

  /* ======================================================================
     1. Nav — stuck state, drawer, active link
     ====================================================================== */
  function nav() {
    const bar = $(".nav");
    const burger = $(".burger");
    const drawer = $(".drawer");

    if (bar) {
      const onScroll = () => bar.classList.toggle("is-stuck", window.scrollY > 24);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (burger && drawer) {
      const toggle = (force) => {
        const open = force !== undefined ? force : !document.body.classList.contains("menu-open");
        document.body.classList.toggle("menu-open", open);
        burger.setAttribute("aria-expanded", String(open));
        drawer.setAttribute("aria-hidden", String(!open));
      };
      burger.addEventListener("click", () => toggle());
      $$("a", drawer).forEach((a) => a.addEventListener("click", () => toggle(false)));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && document.body.classList.contains("menu-open")) toggle(false);
      });
    }

    // active link
    let page = location.pathname.split("/").pop() || "index.html";
    if (page === "") page = "index.html";
    $$(".nav__links a, .drawer__links a").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("/").pop();
      if (href === page) a.classList.add("is-active");
    });
  }

  /* ======================================================================
     2. Scroll progress
     ====================================================================== */
  function progress() {
    const el = $(".progress");
    if (!el) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")";
    };
    window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(run); }, { passive: true });
    run();
  }

  /* ======================================================================
     3. Reveal on scroll
     ====================================================================== */
  function reveals() {
    const els = $$("[data-rv]");
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const d = parseFloat(en.target.dataset.rvDelay || "0");
          if (d) en.target.style.transitionDelay = d + "s";
          en.target.classList.add("in");
          io.unobserve(en.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    els.forEach((e) => io.observe(e));

    // auto-stagger direct children of [data-rv-stagger]
    $$("[data-rv-stagger]").forEach((group) => {
      const step = parseFloat(group.dataset.rvStagger) || 0.07;
      $$("[data-rv]", group).forEach((child, i) => {
        if (!child.dataset.rvDelay) child.dataset.rvDelay = (i * step).toFixed(3);
      });
    });
  }

  /* ======================================================================
     4. Hero headline reveal
     ====================================================================== */
  function heroLines() {
    $$(".rv-stack").forEach((el) => {
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("rv-ready")));
    });
  }

  /* ======================================================================
     4b. Decode — hero headlines resolve out of noise once, on arrival.
         Applied only to [data-scramble] (one headline per page) so it stays
         a punctuation mark, not a tic.
     ====================================================================== */
  function decode() {
    const els = $$("[data-scramble]");
    if (!els.length) return;

    // the real wording stays the accessible name whatever the glyphs do
    els.forEach((el) => {
      if (!el.getAttribute("aria-label")) {
        el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
      }
    });
    if (REDUCED) return;

    const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=+*";
    const pick = () => GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);

    els.forEach((el) => {
      // scramble each line separately so the line structure survives
      const lines = $$(".rv-line > span", el);
      (lines.length ? lines : [el]).forEach((node, li) => {
        const text = node.textContent;
        const chars = text.split("");
        // spaces and punctuation hold still — only letters and digits decode
        const idx = [];
        for (let i = 0; i < chars.length; i++) {
          if (/[A-Za-z0-9]/.test(chars[i])) idx.push(i);
        }
        if (!idx.length) return;

        const step = Math.min(55, 700 / idx.length);
        const base = 340 + li * 120;
        const settle = idx.map((_, n) => base + n * step);
        // Each character holds a glyph for a beat rather than changing every
        // frame. Same overall timing — you can just read the decode happening
        // instead of seeing a blur. Also makes it frame-rate independent.
        const HOLD = 78;
        const swapAt = idx.map(() => 0);
        const shown = idx.map(() => pick());

        // clock starts on the first animation frame, not here: WebGL setup can
        // block the main thread long enough to skip the whole window otherwise
        let t0 = 0, last = "";

        function tick(now) {
          if (!t0) t0 = now;
          const t = now - t0;
          let done = true;
          const out = chars.slice();
          for (let n = 0; n < idx.length; n++) {
            if (t >= settle[n]) continue;
            done = false;
            if (t >= swapAt[n]) {
              shown[n] = pick();
              swapAt[n] = t + HOLD * (0.75 + Math.random() * 0.5);
            }
            out[idx[n]] = shown[n];
          }
          const str = done ? text : out.join("");
          if (str !== last) { node.textContent = str; last = str; }
          if (!done) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    });
  }

  /* ======================================================================
     5. Parallax
     ====================================================================== */
  function parallax() {
    if (REDUCED) return;
    const items = $$("[data-para]");
    if (!items.length) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const vh = innerHeight;
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const speed = parseFloat(el.dataset.para) || 0.12;
        const mid = r.top + r.height / 2 - vh / 2;
        el.style.transform = `translate3d(0, ${(-mid * speed).toFixed(2)}px, 0) scale(1.12)`;
      });
    };
    window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(run); }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ======================================================================
     6. Card pointer glow
     ====================================================================== */
  function cardGlow() {
    if (COARSE) return;
    $$(".card").forEach((c) => {
      c.addEventListener("mousemove", (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        c.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }

  /* ======================================================================
     7. Count-up numbers
     ====================================================================== */
  function counters() {
    const els = $$("[data-count]");
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach((e) => (e.textContent = e.dataset.count));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        io.unobserve(el);
        const end = parseFloat(el.dataset.count);
        const dec = (el.dataset.count.split(".")[1] || "").length;
        const dur = 1500;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min((t - t0) / dur, 1);
          const e = 1 - Math.pow(1 - p, 3);
          el.textContent = (end * e).toFixed(dec);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    els.forEach((e) => io.observe(e));
  }

  /* ======================================================================
     8. Network canvas — the "Human-Aligned Network" motif
     ====================================================================== */
  function network() {
    const cvs = $("[data-net]");
    if (!cvs || REDUCED) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, dpr = 1, nodes = [], raf = 0, running = true;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      const r = cvs.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cvs.width = Math.max(1, Math.floor(w * dpr));
      cvs.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      const target = Math.round(Math.min(120, Math.max(34, (w * h) / 15000)));
      nodes = [];
      for (let i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.5 + 0.6,
          p: Math.random() * Math.PI * 2,
        });
      }
    }

    const LINK = 132;

    function draw(t) {
      raf = 0;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

        // gentle pull toward pointer
        const dx = mouse.x - n.x, dy = mouse.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 34000 && d2 > 1) {
          const f = (1 - d2 / 34000) * 0.014;
          n.vx += dx * f * 0.05;
          n.vy += dy * f * 0.05;
        }
        n.vx *= 0.994; n.vy *= 0.994;
        const sp = Math.hypot(n.vx, n.vy);
        if (sp > 0.5) { n.vx *= 0.5 / sp; n.vy *= 0.5 / sp; }
      }

      // links
      ctx.lineWidth = 0.65;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > LINK) continue;
          const o = (1 - d / LINK) * 0.3;
          ctx.strokeStyle = `rgba(255,255,255,${o.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.0012 + n.p));
        ctx.fillStyle = `rgba(255,255,255,${(0.5 * tw).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running) raf = requestAnimationFrame(draw);
    }

    window.addEventListener("mousemove", (e) => {
      const r = cvs.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    }, { passive: true });
    window.addEventListener("mouseout", () => { mouse.x = -9999; mouse.y = -9999; });

    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

    // pause when offscreen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => {
        es.forEach((en) => {
          running = en.isIntersecting;
          if (running && !raf) raf = requestAnimationFrame(draw);
        });
      }, { threshold: 0 }).observe(cvs);
    }

    resize();
    raf = requestAnimationFrame(draw);
  }

  /* ======================================================================
     8b. WebGL geometric hero — rotating wireframe HANA sphere (Three.js)
         Graceful no-op if Three.js failed to load or WebGL is unavailable.
     ====================================================================== */
  function heroGeometry() {
    const cvs = $("[data-gl]");
    if (!cvs || REDUCED) return;
    if (typeof THREE === "undefined") return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const glow = new THREE.Color(0x57d9ff);
    const ink = new THREE.Color(0xede8e1);

    const group = new THREE.Group();
    scene.add(group);

    /* -- shared builders ------------------------------------------------ */
    const lineMat = (color, opacity) =>
      new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity });
    const solidMat = (color, opacity) =>
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity });

    // wireframe outline of a solid (clean silhouette + facet edges)
    const edges = (geo, color, opacity) =>
      new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color, opacity));

    const ring = (radius, thickness, color, opacity) =>
      new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 128), solidMat(color, opacity));

    // drifting node points on a spherical shell — the motif every page shares
    function shell(count, radius, jitter, size, opacity) {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = radius + (Math.random() - 0.5) * jitter;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({
        color: glow, size: size, transparent: true,
        opacity: opacity === undefined ? 0.85 : opacity, sizeAttenuation: true
      }));
    }

    /* -- per-page form --------------------------------------------------
       Each page carries its own shape via data-gl="<variant>"; they share
       the same wireframe language so the site still reads as one system. */
    const spin = [];                       // [object, dx, dy, dz] each frame
    const variant = cvs.dataset.gl || "orb";



    if (variant === "shard") {
      // Company — angular crystal, few clean planes
      const outer = edges(new THREE.OctahedronGeometry(3.7, 0), glow, 0.72);
      const core = edges(new THREE.OctahedronGeometry(2.0, 1), ink, 0.36);
      const r1 = ring(4.3, 0.011, glow, 0.5);
      r1.rotation.x = Math.PI / 2.6;
      group.add(outer, core, r1, shell(90, 3.7, 0.3, 0.05));
      spin.push([outer, 0, 0.0010, 0], [core, 0.0009, -0.0016, 0], [r1, 0, 0, 0.0010]);

    } else if (variant === "knot") {
      // HANA — one continuous interwoven path: many systems, one architecture
      const knot = new THREE.Mesh(
        new THREE.TorusKnotGeometry(2.25, 0.045, 260, 14, 2, 3),
        solidMat(glow, 0.6)
      );
      const cage = edges(new THREE.IcosahedronGeometry(3.5, 0), ink, 0.16);
      group.add(knot, cage, shell(100, 3.5, 0.3, 0.045));
      spin.push([knot, 0.0007, 0.0012, 0], [cage, 0, -0.0008, 0]);

    } else if (variant === "lattice") {
      // Systems — orthogonal structure, nested frames on a common axis
      const o = edges(new THREE.BoxGeometry(4.1, 4.1, 4.1), glow, 0.68);
      const m = edges(new THREE.BoxGeometry(2.9, 2.9, 2.9), ink, 0.42);
      m.rotation.set(Math.PI / 4, Math.PI / 4, 0);
      const i = edges(new THREE.BoxGeometry(1.6, 1.6, 1.6), glow, 0.6);
      group.add(o, m, i, shell(90, 3.6, 0.35, 0.045));
      spin.push([o, 0, 0.0008, 0], [m, 0.0011, -0.0013, 0], [i, 0, 0.0022, 0.0008]);

    } else if (variant === "meridian") {
      // Research & Insights — a measured grid: latitude / longitude, not facets
      const globe = edges(new THREE.SphereGeometry(3.25, 22, 13), glow, 0.34);
      const core = edges(new THREE.IcosahedronGeometry(1.5, 0), ink, 0.28);
      const r1 = ring(4.2, 0.008, glow, 0.4);
      r1.rotation.x = Math.PI / 2;
      group.add(globe, core, r1, shell(110, 3.25, 0.25, 0.05));
      spin.push([globe, 0, 0.0011, 0], [core, 0.0008, -0.0018, 0], [r1, 0, 0, 0.0009]);

    } else if (variant === "portal") {
      // Contact — an open aperture rather than a closed solid
      const r1 = ring(3.5, 0.016, glow, 0.72);
      const r2 = ring(2.95, 0.011, ink, 0.42);
      r2.rotation.x = Math.PI / 3;
      const r3 = ring(2.4, 0.009, glow, 0.55);
      r3.rotation.y = Math.PI / 3;
      const core = edges(new THREE.IcosahedronGeometry(0.95, 0), glow, 0.65);
      group.add(r1, r2, r3, core, shell(80, 3.5, 0.4, 0.045));
      spin.push([r1, 0, 0, 0.0009], [r2, 0.0012, 0, 0], [r3, 0, 0.0014, 0], [core, 0.002, 0.002, 0]);

    } else {
      // Home — the flagship geodesic orb with gyroscope rings
      const outer = edges(new THREE.IcosahedronGeometry(3.3, 1), glow, 0.55);
      const core = edges(new THREE.IcosahedronGeometry(1.85, 0), ink, 0.3);
      const r1 = ring(4.05, 0.009, glow, 0.45);
      r1.rotation.x = Math.PI / 2.3;
      const r2 = ring(4.45, 0.007, ink, 0.2);
      r2.rotation.set(Math.PI / 2.8, Math.PI / 3, 0);
      const pts = shell(120, 3.3, 0.22, 0.05);
      group.add(outer, core, r1, r2, pts);
      spin.push([outer, 0, 0.0009, 0], [core, 0.0007, -0.0016, 0],
                [r1, 0, 0, 0.0011], [r2, 0, 0, -0.0008], [pts, 0, 0.0004, 0]);
    }

    // Measure what was actually built rather than guessing a scale.
    // A bounding sphere is far too conservative here — it assumes a ring
    // presents face-on, which the fixed tilts never allow — so instead sample
    // the geometry and take the worst vertical extent over a full rotation.
    // Exact, and self-correcting for any shape added later.
    const form = (function () {
      group.updateMatrixWorld(true);

      // Sample the form into a point cloud that covers every pose it will ever
      // strike: each child that animates is sampled around its own spin axes,
      // so a ring that swings edge-on to face-on is measured at its widest,
      // not at whatever pose it happened to hold on frame one. Without this the
      // fit is computed from a silhouette the shape immediately grows out of.
      const spinOf = new Map();
      for (let i = 0; i < spin.length; i++) spinOf.set(spin[i][0], spin[i]);

      const cloud = [];
      const v = new THREE.Vector3();
      const m = new THREE.Matrix4();
      const e = new THREE.Euler();
      const q = new THREE.Quaternion();
      const STEPS = 6, TURN = (Math.PI * 2) / STEPS;
      const range = (on) => {
        if (!on) return [0];
        const out = [];
        for (let i = 0; i < STEPS; i++) out.push(i * TURN);
        return out;
      };

      group.children.forEach((o) => {
        const s = spinOf.get(o);
        const rx = range(s && s[1]), ry = range(s && s[2]), rz = range(s && s[3]);
        o.traverse((c) => {
          const g = c.geometry;
          if (!g || !g.attributes || !g.attributes.position) return;
          const a = g.attributes.position;
          const stride = Math.max(1, Math.floor(a.count / 140));
          for (let i = 0; i < rx.length; i++)
            for (let j = 0; j < ry.length; j++)
              for (let k = 0; k < rz.length; k++) {
                e.set(o.rotation.x + rx[i], o.rotation.y + ry[j],
                      o.rotation.z + rz[k], o.rotation.order);
                q.setFromEuler(e);
                m.compose(o.position, q, o.scale);
                if (c !== o) m.multiply(c.matrix);
                for (let n = 0; n < a.count; n += stride) {
                  cloud.push(v.fromBufferAttribute(a, n).applyMatrix4(m).clone());
                }
              }
        });
      });
      if (!cloud.length) return new Float32Array(0);

      // Thin the cloud to its silhouette envelope: keep only the furthest point
      // in each direction bucket. A few hundred points then bound the whole form
      // for any rotation, which is what makes the exact fit below cheap enough
      // to re-run on every resize.
      const BT = 32, BP = 16, NB = BT * BP;
      const hull = new Float32Array(NB * 3), hullR = new Float32Array(NB);
      for (let i = 0; i < cloud.length; i++) {
        const p = cloud[i];
        const rr = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (rr < 1e-6) continue;
        let bt = Math.floor(((Math.atan2(p.z, p.x) + Math.PI) / (Math.PI * 2)) * BT);
        let bp = Math.floor((Math.acos(Math.max(-1, Math.min(1, p.y / rr))) / Math.PI) * BP);
        if (bt >= BT) bt = BT - 1;
        if (bp >= BP) bp = BP - 1;
        const b = bt * BP + bp;
        if (rr > hullR[b]) {
          hullR[b] = rr;
          hull[b * 3] = p.x; hull[b * 3 + 1] = p.y; hull[b * 3 + 2] = p.z;
        }
      }

      // the group itself sweeps rotation.y continuously and tilts on x with the
      // pointer, so bake that whole range into the envelope as well — the result
      // is every position any part of the form can ever occupy
      const probe = new THREE.Object3D();
      const out = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        for (let x = -0.3; x <= 0.301; x += 0.15) {
          probe.rotation.set(x, a, 0);
          probe.updateMatrix();
          const e0 = probe.matrix.elements;
          for (let b = 0; b < NB; b++) {
            if (!hullR[b]) continue;
            const px = hull[b * 3], py = hull[b * 3 + 1], pz = hull[b * 3 + 2];
            out.push(e0[0] * px + e0[4] * py + e0[8] * pz,
                     e0[1] * px + e0[5] * py + e0[9] * pz,
                     e0[2] * px + e0[6] * py + e0[10] * pz);
          }
        }
      }
      return new Float32Array(out);
    })();

    function resize() {
      const r = cvs.getBoundingClientRect();
      const w = r.width, h = r.height;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      // Centre the form in the frame the viewer can actually SEE, then grow it
      // until the first of the four borders stops it. The visible frame is the
      // canvas minus whatever the fixed nav covers of its top — a form centred
      // in the raw canvas reads as sitting high, because its crown is behind
      // the nav. Everything below is derived, so it stays true at any size.
      if (!form.length) return;
      const tanHalf = Math.tan((camera.fov * Math.PI / 180) / 2);
      const camZ = camera.position.z;
      const k = (h / 2) / tanHalf;      // world→px, before the perspective divide

      // how much of the canvas top the nav hides
      const navEl = document.querySelector(".nav");
      const navBottom = navEl ? navEl.getBoundingClientRect().bottom : 74;
      const occTop = Math.min(Math.max(navBottom - r.top, 0), h * 0.5);

      // sit the centre of the form on the centre of the visible band; on wide
      // screens push it right (world units, independent of scale) so the copy
      // column on the left sits against clean space rather than the shape
      const MARGIN = 0.965;
      const halfH = tanHalf * camZ;
      const oy = -(occTop / 2) * camZ / k;
      const ox = aspect >= 1.15 ? halfH * aspect * 0.30 : 0;
      group.position.x = ox;
      group.position.y = oy;

      // the borders the form has to stay inside, in px from the canvas centre
      const lim = {
        up:    (h / 2 - occTop) * MARGIN,
        down:  (h / 2) * MARGIN,
        side:  (w / 2) * MARGIN
      };

      // Solve for the largest scale that keeps every sampled point inside those
      // borders. Perspective makes this non-linear — the near face of the form
      // magnifies as it grows — so a ratio can't answer it; a bisection can, and
      // it converges in a handful of steps on a few thousand points. The offset
      // is baked into sx/sy so a rightward push automatically shrinks the form
      // if that's what it takes to keep its right edge on-frame.
      const fits = (s) => {
        for (let i = 0; i < form.length; i += 3) {
          const d = camZ - s * form[i + 2];
          if (d < 0.25) return false;
          const sy = -k * (s * form[i + 1] + oy) / d;   // +down, from centre
          const sx =  k * (s * form[i] + ox) / d;
          if (sy < -lim.up || sy > lim.down) return false;
          if (sx < -lim.side || sx > lim.side) return false;
        }
        return true;
      };
      let lo = 0, hi = 4;
      if (fits(hi)) { group.scale.setScalar(hi); return; }
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
      group.scale.setScalar(lo || 0.5);
    }

    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    if (!COARSE) {
      window.addEventListener("mousemove", (e) => {
        mouse.x = (e.clientX / innerWidth) * 2 - 1;
        mouse.y = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });
    }

    let running = true, raf = 0;
    function frame(t) {
      raf = 0;
      target.x += (mouse.y * 0.26 - target.x) * 0.04;
      target.y += (mouse.x * 0.34 - target.y) * 0.04;
      group.rotation.x = target.x;
      group.rotation.y = t * 0.00009 + target.y;
      for (let i = 0; i < spin.length; i++) {
        const s = spin[i];
        s[0].rotation.x += s[1];
        s[0].rotation.y += s[2];
        s[0].rotation.z += s[3];
      }
      renderer.render(scene, camera);
      if (running) raf = requestAnimationFrame(frame);
    }

    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((en) => {
        running = en.isIntersecting;
        if (running && !raf) raf = requestAnimationFrame(frame);
      }), { threshold: 0 }).observe(cvs);
    }

    resize();
    raf = requestAnimationFrame(frame);
  }

  /* ======================================================================
     8c. Constellations — content mapped onto the vertices of a rotating form.
         The markup list is the source of truth and the fallback; this lifts
         each item onto its vertex and shows its detail in a readout box.
     ====================================================================== */
  const CSTL_SHAPES = {
    tetra: {
      tilt: [0.34, 0.12],
      verts: [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]],
      edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]
    },
    octa: {
      tilt: [0.52, 0.34],
      verts: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
      edges: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5],
              [2, 4], [2, 5], [3, 4], [3, 5]]
    },
    ring: {
      tilt: [0.62, 0.18],
      verts: [[1, 0, 0], [0, 1, 0.35], [-1, 0, 0], [0, -1, -0.35]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 0]]
    },
    // smooth continuous curves — points ride the path instead of sitting on
    // corners. curve: [p, q] of a torus knot, matching the HANA hero language.
    knot: { curve: [2, 3], radius: 1.85, tilt: [0.42, 0.16] },
    knotAlt: { curve: [3, 2], radius: 1.85, tilt: [0.56, 0.3] },
    cube: {
      tilt: [0.38, 0.2],
      verts: [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
              [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]],
      edges: [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3],
              [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]]
    }
  };

  function constellations() {
    const boxes = $$("[data-cstl]");
    if (!boxes.length || REDUCED || typeof THREE === "undefined") return;

    const build = (box) => {
      const canvas = $(".cstl__gl", box);
      const items = $$(".cstl__nodes > li", box);
      const panel = $("[data-panel]", box);
      const spec = CSTL_SHAPES[box.dataset.shape] || CSTL_SHAPES.tetra;
      if (!canvas || !items.length) return;
      if (!spec.curve && items.length > spec.verts.length) return;

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      } catch (e) { return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 6.2);
      const glow = new THREE.Color(0x57d9ff);
      const ink = new THREE.Color(0xede8e1);
      const group = new THREE.Group();
      scene.add(group);

      const R = 2.55;
      const tilt = spec.tilt || [0.35, 0.15];
      const linePts = [];
      let pos;

      if (spec.curve) {
        // point on a (p,q) torus knot at t in [0,1)
        const P = spec.curve[0], Q = spec.curve[1], KR = spec.radius || 1.85;
        const at = (t) => {
          const u = t * Math.PI * 2 * P;
          const qp = (Q / P) * u;
          const cs = Math.cos(qp);
          return new THREE.Vector3(
            KR * (2 + cs) * 0.5 * Math.cos(u),
            KR * (2 + cs) * 0.5 * Math.sin(u),
            KR * Math.sin(qp) * 0.5
          );
        };
        // information points spaced evenly along the path
        pos = [];
        for (let i = 0; i < items.length; i++) pos.push(at(i / items.length));
        // the path itself, drawn smoothly
        const SEG = 420;
        for (let i = 0; i < SEG; i++) linePts.push(at(i / SEG), at((i + 1) / SEG));
      } else {
        pos = spec.verts.map((v) => new THREE.Vector3(v[0], v[1], v[2]).normalize().multiplyScalar(R));
        spec.edges.forEach((e) => { linePts.push(pos[e[0]].clone(), pos[e[1]].clone()); });
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(linePts);
      group.add(new THREE.LineSegments(
        lineGeo,
        new THREE.LineBasicMaterial({ color: glow, transparent: true, opacity: spec.curve ? 0.42 : 0.3 })
      ));

      // a marker at every vertex that carries information
      const dots = pos.slice(0, items.length).map((p) => {
        const d = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 16, 16),
          new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.85 })
        );
        d.position.copy(p);
        group.add(d);
        return d;
      });

      // generous invisible spheres so the vertex itself is easy to hover —
      // the visible dot is far too small to be a comfortable target
      const hits = pos.slice(0, items.length).map((p, i) => {
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 12, 12),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hit.position.copy(p);
        hit.userData.i = i;
        group.add(hit);
        return hit;
      });
      /* --- ornament -------------------------------------------------------
         Layers that echo the hero forms. Deliberately kept INSIDE the ring of
         information points and at low opacity: the perimeter is where the
         labels and their dots live, and nothing here may compete with them. */
      const decor = [];
      const ornament = (obj, dx, dy, dz) => { group.add(obj); decor.push([obj, dx, dy, dz]); };

      // counter-rotating core
      ornament(new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.6, 0)),
        new THREE.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.28 })
      ), 0.0009, -0.0017, 0);

      // inner gyroscope rings
      const gyro = (rad, thick, color, op, rx, ry) => {
        const m = new THREE.Mesh(
          new THREE.TorusGeometry(rad, thick, 8, 96),
          new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: op })
        );
        m.rotation.set(rx, ry, 0);
        return m;
      };
      ornament(gyro(1.2, 0.006, glow, 0.32, Math.PI / 2.2, 0), 0, 0, 0.0013);
      ornament(gyro(1.55, 0.004, ink, 0.2, Math.PI / 2.9, Math.PI / 3), 0, 0, -0.0009);

      // faint interior haze, well inside the information points
      const hazeN = 70, hazePos = new Float32Array(hazeN * 3);
      for (let i = 0; i < hazeN; i++) {
        const hr = 1.9 + (Math.random() - 0.5) * 0.55;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        hazePos[i * 3] = hr * Math.sin(ph) * Math.cos(th);
        hazePos[i * 3 + 1] = hr * Math.sin(ph) * Math.sin(th);
        hazePos[i * 3 + 2] = hr * Math.cos(ph);
      }
      const hazeGeo = new THREE.BufferGeometry();
      hazeGeo.setAttribute("position", new THREE.BufferAttribute(hazePos, 3));
      ornament(new THREE.Points(hazeGeo, new THREE.PointsMaterial({
        color: glow, size: 0.03, transparent: true, opacity: 0.45, sizeAttenuation: true
      })), 0, 0.0006, 0);

      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let inside = false, overLabel = -1, overVertex = -1;

      box.classList.add("is-3d");

      /* ---- interaction ---- */
      let active = -1;
      function setActive(i) {
        if (active === i) return;
        active = i;
        items.forEach((li, n) => li.classList.toggle("is-on", n === i));
        dots.forEach((d, n) => d.scale.setScalar(n === i ? 1.9 : 1));
        if (!panel) return;
        if (i < 0) { panel.classList.remove("is-on"); return; }
        const li = items[i];
        const t = $(".cstl__node-t", li);
        const b = $(".cstl__node-b", li);
        panel.textContent = "";
        if (li.dataset.k) {
          const k = document.createElement("span");
          k.className = "k"; k.textContent = li.dataset.k; panel.appendChild(k);
        }
        const h = document.createElement("h4");
        h.textContent = t ? t.textContent : "";
        panel.appendChild(h);
        if (b) {
          const p = document.createElement("p");
          p.textContent = b.textContent;
          panel.appendChild(p);
        }
        panel.classList.add("is-on");
      }

      // label and vertex are two ways into the same state; the label wins
      // when both are true so the readout never flickers between them
      function refresh() { setActive(overLabel >= 0 ? overLabel : overVertex); }

      items.forEach((li, i) => {
        const btn = $(".cstl__node", li) || li;
        btn.addEventListener("mouseenter", () => { overLabel = i; refresh(); });
        btn.addEventListener("mouseleave", () => { if (overLabel === i) { overLabel = -1; refresh(); } });
        btn.addEventListener("focus", () => { overLabel = i; refresh(); });
        btn.addEventListener("blur", () => { if (overLabel === i) { overLabel = -1; refresh(); } });
        btn.addEventListener("click", (e) => {
          if (btn.tagName !== "A") { e.preventDefault(); overLabel = i; refresh(); }
        });
      });

      // clicking a vertex follows its link, where it has one
      box.addEventListener("click", () => {
        if (overVertex < 0 || overLabel >= 0) return;
        const a = $(".cstl__node", items[overVertex]);
        if (a && a.tagName === "A") a.click();
      });
      // the form settles while the pointer is inside, so labels stop moving
      // under the cursor and stay clickable
      let spin = 0.0022, spinTo = 0.0022;
      box.addEventListener("mouseenter", () => { spinTo = 0; });
      box.addEventListener("mouseleave", () => {
        spinTo = 0.0022; inside = false; overLabel = -1; overVertex = -1;
        box.style.cursor = ""; setActive(-1);
      });
      box.addEventListener("focusin", () => { spinTo = 0; });
      box.addEventListener("focusout", () => { spinTo = 0.0022; });

      /* ---- pointer parallax ---- */
      const mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
      if (!COARSE) {
        box.addEventListener("mousemove", (e) => {
          const r = box.getBoundingClientRect();
          mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
          mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
          ndc.x = mouse.x;
          ndc.y = -mouse.y;
          inside = true;
        }, { passive: true });
      }

      let w = 0, h = 0;
      function resize() {
        const r = canvas.getBoundingClientRect();
        w = r.width; h = r.height;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.position.z = w / h < 1 ? 8.2 : 6.2;
        camera.updateProjectionMatrix();
      }

      // project each vertex to screen space and park its label there
      const v = new THREE.Vector3();
      const sides = items.map(function () { return 1; });
      function place() {
        for (let i = 0; i < items.length; i++) {
          v.copy(pos[i]).applyMatrix4(group.matrixWorld).project(camera);
          const x = (v.x * 0.5 + 0.5) * w;
          const y = (-v.y * 0.5 + 0.5) * h;
          const depth = Math.min(Math.max((v.z + 1) / 2, 0), 1);   // 0 near → 1 far
          const li = items[i];
          // fan the label away from the centre so it never covers its own
          // vertex; hysteresis stops it flip-flopping as the form rotates
          const rel = x / w - 0.5;
          if (rel > 0.06) sides[i] = 1; else if (rel < -0.06) sides[i] = -1;
          const off = x + sides[i] * 18;
          li.style.transform =
            (sides[i] < 0 ? "translate(-100%,-50%) " : "translate(0,-50%) ") +
            "translate(" + off.toFixed(1) + "px," + y.toFixed(1) + "px)";
          // the accent tick always faces the vertex it belongs to
          li.classList.toggle("is-left", sides[i] < 0);
          li.style.opacity = (1 - depth * 0.62).toFixed(2);
          li.style.zIndex = String(100 - Math.round(depth * 100));
          if (i === active && panel) {
            const pw = panel.offsetWidth, ph = panel.offsetHeight;
            let px = x + 26, py = y - ph / 2;
            if (px + pw > w - 8) px = x - 26 - pw;
            px = Math.max(8, Math.min(px, w - pw - 8));
            py = Math.max(8, Math.min(py, h - ph - 8));
            panel.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
          }
        }
      }

      let running = true, raf = 0;
      function frame() {
        raf = 0;
        // once a point is engaged the tilt locks, so the label can't drift
        // out from under the cursor while you're reading it
        if (active < 0) {
          target.x += (mouse.y * 0.3 - target.x) * 0.05;
          target.y += (mouse.x * 0.4 - target.y) * 0.05;
        }
        group.rotation.x = tilt[0] + target.x;
        group.rotation.z = tilt[1];
        spin += (spinTo - spin) * 0.07;
        group.rotation.y += spin;
        for (let i = 0; i < decor.length; i++) {
          const d = decor[i];
          d[0].rotation.x += d[1];
          d[0].rotation.y += d[2];
          d[0].rotation.z += d[3];
        }
        group.updateMatrixWorld();
        if (inside) {
          ray.setFromCamera(ndc, camera);
          const hit = ray.intersectObjects(hits, false)[0];
          const idx = hit ? hit.object.userData.i : -1;
          if (idx !== overVertex) {
            overVertex = idx;
            box.style.cursor = idx >= 0 ? "pointer" : "";
            refresh();
          }
        }
        place();
        renderer.render(scene, camera);
        if (running) raf = requestAnimationFrame(frame);
      }

      let rt = 0;
      window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(() => { resize(); }, 180);
      });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => es.forEach((en) => {
          running = en.isIntersecting;
          if (running && !raf) raf = requestAnimationFrame(frame);
        }), { threshold: 0 }).observe(box);
      }

      resize();
      raf = requestAnimationFrame(frame);
    };

    // Build each form only as it nears the viewport. Creating every WebGL
    // context at load blocked the main thread long enough to swallow the
    // hero's decode animation, and most of these are far below the fold.
    if (!("IntersectionObserver" in window)) { boxes.forEach(build); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        build(en.target);
      });
    }, { rootMargin: "400px 0px" });
    boxes.forEach((box) => io.observe(box));
  }

  /* ======================================================================
     9. WebGL amber field  (graceful no-op if unsupported)
     ====================================================================== */
  function field() {
    const cvs = $("[data-field]");
    if (!cvs || REDUCED) return;

    // Compile only as the CTA approaches. This lives at the very bottom of
    // every page, and compiling its shader at load stalled the main thread
    // through the whole hero animation.
    if ("IntersectionObserver" in window) {
      const gate = new IntersectionObserver((es) => {
        if (!es.some((en) => en.isIntersecting)) return;
        gate.disconnect();
        build();
      }, { rootMargin: "500px 0px" });
      gate.observe(cvs);
    } else {
      build();
    }

    function build() {
    const gl = cvs.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
    const FS = `
      precision highp float;
      uniform vec2 u_res;
      uniform float u_t;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f*f*(3.-2.*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0., a = .5;
        for(int i=0;i<5;i++){ v += a*noise(p); p *= 2.03; a *= .5; }
        return v;
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / u_res.xy;
        vec2 q = uv;
        q.x *= u_res.x / u_res.y;

        float t = u_t * 0.035;
        vec2 w = vec2(fbm(q*2.2 + t), fbm(q*2.2 - t + 5.2));
        float n = fbm(q*2.6 + w*1.5 + t*0.7);

        // horizon-style dusk falloff
        float band = smoothstep(0.05, 0.95, uv.y);
        float core = smoothstep(0.62, 0.02, abs(uv.y - 0.42 - n*0.16));

        vec3 deep  = vec3(0.031, 0.027, 0.039);
        vec3 amber = vec3(0.910, 0.588, 0.227);
        vec3 gold  = vec3(0.957, 0.776, 0.478);
        vec3 teal  = vec3(0.475, 0.765, 0.741);

        vec3 col = deep;
        col = mix(col, amber, core * (0.34 + 0.3*n));
        col = mix(col, gold,  core * pow(n, 3.0) * 0.55);
        col = mix(col, teal,  smoothstep(0.55,1.0,uv.y) * n * 0.10);

        // vignette
        vec2 c = uv - 0.5;
        float vig = 1.0 - dot(c,c) * 1.35;
        col *= clamp(vig, 0.0, 1.0);

        float alpha = clamp(core * 0.85 + band * 0.06, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }`;

    function sh(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT   = gl.getUniformLocation(prog, "u_t");

    let running = true, raf = 0;
    function resize() {
      const r = cvs.getBoundingClientRect();
      const d = Math.min(devicePixelRatio || 1, 1.5);
      cvs.width = Math.max(1, Math.floor(r.width * d));
      cvs.height = Math.max(1, Math.floor(r.height * d));
      gl.viewport(0, 0, cvs.width, cvs.height);
      gl.uniform2f(uRes, cvs.width, cvs.height);
    }
    function frame(t) {
      raf = 0;
      gl.uniform1f(uT, t * 0.001);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (running) raf = requestAnimationFrame(frame);
    }
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((en) => {
        running = en.isIntersecting;
        if (running && !raf) raf = requestAnimationFrame(frame);
      }), { threshold: 0 }).observe(cvs);
    }
    resize();
    raf = requestAnimationFrame(frame);
    }
  }

  /* ======================================================================
     10. Videos — play only when visible, honour reduced motion
     ====================================================================== */
  function videos() {
    const vids = $$("video[data-auto]");
    if (!vids.length) return;
    if (REDUCED) { vids.forEach((v) => { v.removeAttribute("autoplay"); v.pause(); }); return; }
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => {
        const v = en.target;
        if (en.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else v.pause();
      });
    }, { threshold: 0.08 });
    vids.forEach((v) => io.observe(v));
  }

  /* ======================================================================
     11. Marquee — duplicate track for a seamless loop
     ====================================================================== */
  function marquee() {
    $$(".marquee__track").forEach((track) => {
      if (track.children.length === 1) track.appendChild(track.firstElementChild.cloneNode(true));
    });
  }

  /* ======================================================================
     12. Contact form (front-end only)
     ====================================================================== */
  function forms() {
    $$("form[data-form]").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!f.reportValidity()) return;
        const ok = $(".form__ok", f.closest("[data-form-wrap]") || f.parentElement);
        const btn = $("button[type=submit]", f);
        if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
        setTimeout(() => {
          f.reset();
          if (btn) { btn.disabled = false; btn.innerHTML = 'Send inquiry <span class="arw" aria-hidden="true">→</span>'; }
          if (ok) { ok.classList.add("show"); ok.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
        }, 700);
      });
    });
  }

  /* ======================================================================
     12b. Insights index — filter entries by stream
     ====================================================================== */
  function insightFilters() {
    const bar = $(".filters");
    if (!bar) return;
    const btns = $$(".filter", bar);
    const posts = $$("[data-cat]");
    const empty = $("[data-empty]");
    if (!btns.length || !posts.length) return;

    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn) return;
      const f = btn.dataset.filter || "all";
      btns.forEach((b) => b.classList.toggle("is-on", b === btn));

      let shown = 0;
      posts.forEach((p) => {
        const hit = f === "all" || p.dataset.cat === f;
        p.classList.toggle("is-hidden", !hit);
        if (hit) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    });

    // pointer glow on entry cards, same as .card
    if (!COARSE) {
      posts.forEach((p) => {
        p.addEventListener("mousemove", (e) => {
          const r = p.getBoundingClientRect();
          p.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
          p.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
        });
      });
    }
  }

  /* ======================================================================
     13. Year stamp
     ====================================================================== */
  function year() {
    $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    nav(); progress(); reveals(); heroLines(); decode(); parallax();
    cardGlow(); counters(); network(); heroGeometry(); constellations();
    field(); videos(); marquee();
    forms(); insightFilters(); year();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
