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
          ctx.strokeStyle = `rgba(232,150,58,${o.toFixed(3)})`;
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
        ctx.fillStyle = `rgba(244,198,122,${(0.5 * tw).toFixed(3)})`;
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
     9. WebGL amber field  (graceful no-op if unsupported)
     ====================================================================== */
  function field() {
    const cvs = $("[data-field]");
    if (!cvs || REDUCED) return;
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
     13. Year stamp
     ====================================================================== */
  function year() {
    $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
  }

  /* ---------------------------------------------------------------- init */
  function init() {
    nav(); progress(); reveals(); heroLines(); parallax();
    cardGlow(); counters(); network(); field(); videos(); marquee();
    forms(); year();
    document.documentElement.classList.add("js-ready");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
