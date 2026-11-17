/* WattWise 3D smart house — REAL 3D (Three.js geometry, materials, lights). Nothing here is a flat image or a CSS rotation.
   - Glass-walled two-storey model with a furnished Lounge, Bedroom and Bathroom, warm interior lights, a glowing energy orb.
   - Rotates smoothly around its vertical (Y) axis, drag with mouse/touch to rotate, auto-rotation pauses while dragging
     and slows on hover, then resumes. */
(function () {
  const T = window.THREE;
  const WattHouse = {
    init(container, opts = {}) {
      if (!T) { container.innerHTML = '<p style="padding:40px;text-align:center">3D view needs Three.js (vendor/three.min.js).</p>'; return null; }
      let renderer;
      try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
      catch (e) { container.innerHTML = '<p style="padding:40px;text-align:center;color:#788078">3D view needs WebGL, which is not available in this browser.</p>'; return null; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
      const canvas = renderer.domElement; canvas.setAttribute("aria-label", "Interactive 3D model of a smart home. Drag to rotate."); canvas.setAttribute("role", "img");
      canvas.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
      container.appendChild(canvas);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(36, 1, 0.1, 100);
      const house = new T.Group(); scene.add(house);

      /* ---------- lights ---------- */
      scene.add(new T.HemisphereLight(0xf3f7ee, 0xb9c9ad, 1.15));
      const sun = new T.DirectionalLight(0xfff1d6, 1.5); sun.position.set(6, 12, 9); scene.add(sun);
      const fill = new T.DirectionalLight(0xdfeeff, 0.5); fill.position.set(-8, 5, -6); scene.add(fill);

      /* ---------- helpers ---------- */
      const M = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.02, ...o });
      const glassMat = new T.MeshPhysicalMaterial({ color: 0xe3f1ea, transparent: true, opacity: 0.14, roughness: 0.08, metalness: 0, side: T.DoubleSide, depthWrite: false });
      const edgeMat = new T.LineBasicMaterial({ color: 0x5b6a5f, transparent: true, opacity: 0.55 });
      function box(w, h, d, color, x, y, z, o = {}) {
        const m = new T.Mesh(new T.BoxGeometry(w, h, d), o.mat || M(color, o.m)); m.position.set(x, y, z); (o.parent || house).add(m); return m;
      }
      function glass(w, h, d, x, y, z) {
        const g = new T.BoxGeometry(w, h, d), m = new T.Mesh(g, glassMat); m.position.set(x, y, z); m.renderOrder = 5; house.add(m);
        const e = new T.LineSegments(new T.EdgesGeometry(g), edgeMat); e.position.copy(m.position); house.add(e); return m;
      }
      function cyl(rt, rb, h, color, x, y, z, seg = 24, o = {}) { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), o.mat || M(color, o.m)); m.position.set(x, y, z); house.add(m); return m; }
      function sphere(r, color, x, y, z, o = {}) { const m = new T.Mesh(new T.SphereGeometry(r, 20, 16), o.mat || M(color, o.m)); m.position.set(x, y, z); house.add(m); return m; }
      function plant(x, y, z, s = 1) {
        cyl(0.2 * s, 0.16 * s, 0.34 * s, 0xf2efe6, x, y + 0.17 * s, z, 16);
        [[0, 0.62, 0, 0.3], [0.14, 0.45, 0.08, 0.22], [-0.13, 0.5, -0.07, 0.24]].forEach(([dx, dy, dz, r]) => sphere(r * s, 0x4f8a5b, x + dx * s, y + dy * s + 0.2 * s, z + dz * s));
      }
      function lamp(x, y, z, color = 0xffd9a0) { cyl(0.025, 0.025, 0.9, 0x888888, x, y + 0.45, z, 8); const b = sphere(0.17, color, x, y + 1.0, z, { mat: new T.MeshBasicMaterial({ color }) }); return b; }
      function labelSprite(text) {
        const c = document.createElement("canvas"); c.width = 320; c.height = 96; const g = c.getContext("2d");
        g.fillStyle = "rgba(255,255,255,.92)"; g.strokeStyle = "rgba(49,93,58,.35)"; g.lineWidth = 3; const r = 44;
        g.beginPath(); g.moveTo(r, 6); g.arcTo(314, 6, 314, 90, r); g.arcTo(314, 90, 6, 90, r); g.arcTo(6, 90, 6, 6, r); g.arcTo(6, 6, 314, 6, r); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#23452C"; g.font = "700 40px Inter,Segoe UI,Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 160, 50);
        const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(1.9, 0.57, 1); s.renderOrder = 20; return s;
      }

      /* ---------- ground, slabs ---------- */
      const grass = cyl(8.6, 8.9, 0.35, 0x93bb82, 0, -0.42, 0, 64); house.add(grass);
      cyl(7.4, 7.4, 0.04, 0xa5c894, 0, -0.23, 0, 64);
      box(9.8, 0.24, 5.8, 0xf1eee4, 0, -0.1, 0);                 // ground slab
      box(9.8, 0.22, 5.8, 0xf6f3ea, 0, 2.7, 0);                  // mid slab / terrace floor
      box(3.2, 0.03, 1.6, 0xcfc8b8, 2.6, -0.3, 3.7);            // stepping stones
      box(1.0, 0.03, 0.7, 0xcfc8b8, 2.6, -0.3, 4.6);

      /* ---------- floors (room identity) ---------- */
      box(5.9, 0.04, 4.9, 0xd9b98c, -1.5, 0.04, 0);              // lounge wood
      box(2.9, 0.04, 4.9, 0xe7eef0, 3.0, 0.04, 0);               // bathroom tiles
      box(5.9, 0.04, 4.9, 0xd8c3a5, -1.5, 2.84, 0);              // bedroom
      box(2.9, 0.04, 4.9, 0xe3e8dc, 3.0, 2.84, 0);               // terrace deck

      /* ---------- glass shell + frame ---------- */
      glass(9, 2.6, 5, 0, 1.3, 0);                                // ground floor shell
      glass(6, 2.4, 5, -1.5, 4.0, 0);                             // bedroom shell
      box(0.12, 2.6, 4.9, 0xf4f1e8, 1.5, 1.3, 0, { m: { transparent: true, opacity: 0.8 } });   // lounge | bathroom partition
      // corner posts + wood accent
      [[-4.5, -2.5], [-4.5, 2.5], [4.5, -2.5], [4.5, 2.5], [1.5, 2.5], [1.5, -2.5]].forEach(([x, z]) => box(0.14, 2.6, 0.14, 0xf8f6ee, x, 1.3, z));
      [[-4.5, -2.5], [-4.5, 2.5], [1.5, -2.5], [1.5, 2.5]].forEach(([x, z]) => box(0.14, 2.4, 0.14, 0xf8f6ee, x, 4.0, z));
      box(0.34, 5.2, 0.12, 0xc29a6b, 1.5, 2.6, 2.55);              // timber accent column
      box(2.6, 2.4, 0.1, 0xc9a878, -3.1, 4.0, -2.55);               // timber cladding (rear of bedroom)
      // terrace railing
      box(3.0, 0.9, 0.05, 0xdfeee8, 3.0, 3.35, 2.5, { m: { transparent: true, opacity: 0.35 } }); box(0.05, 0.9, 4.9, 0xdfeee8, 4.5, 3.35, 0, { m: { transparent: true, opacity: 0.35 } });
      box(3.0, 0.05, 0.06, 0x5b6a5f, 3.0, 3.8, 2.5); box(0.06, 0.05, 4.9, 0x5b6a5f, 4.5, 3.8, 0);

      /* ---------- roof (gable over the bedroom) ---------- */
      const run = 2.85, rise = 1.25, L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
      const roofMat = M(0x5d6663, { roughness: 0.9 });
      [1, -1].forEach((s) => { const p = box(6.7, 0.16, L + 0.35, 0, -1.5, 5.2 + rise / 2 + 0.08, s * (run / 2), { mat: roofMat }); p.rotation.x = s * ang; });
      box(6.8, 0.14, 0.2, 0x4a524f, -1.5, 5.2 + rise + 0.12, 0);   // ridge
      [-4.5, 1.5].forEach((x) => { const sh = new T.Shape(); sh.moveTo(-2.5, 0); sh.lineTo(2.5, 0); sh.lineTo(0, rise); sh.closePath();
        const m = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshStandardMaterial({ color: 0xe8efe6, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false })); m.rotation.y = Math.PI / 2; m.position.set(x, 5.2, 0); house.add(m); });
      box(2.6, 0.2, 1.8, 0xf1eee4, 3.0, 3.0, 2.0, { m: { transparent: true, opacity: 0 } }).visible = false;

      /* ---------- LOUNGE (ground, left) ---------- */
      box(2.6, 0.02, 1.7, 0xe9e1cf, -1.6, 0.075, 0.4);            // rug
      box(2.1, 0.42, 0.9, 0x7fa886, -1.6, 0.3, -1.65); box(2.1, 0.6, 0.2, 0x6e9777, -1.6, 0.72, -2.05); box(0.2, 0.55, 0.9, 0x6e9777, -2.7, 0.45, -1.65); box(0.2, 0.55, 0.9, 0x6e9777, -0.5, 0.45, -1.65);
      box(0.5, 0.3, 0.12, 0xf0e4c8, -2.1, 0.62, -1.62); box(0.5, 0.3, 0.12, 0xe8d0a0, -1.1, 0.62, -1.62);
      cyl(0.55, 0.55, 0.08, 0xcaa675, -1.6, 0.42, 0.2, 28); cyl(0.06, 0.06, 0.38, 0x8a6b45, -1.6, 0.22, 0.2, 10);
      box(0.18, 1.3, 2.4, 0xf3efe6, -4.35, 0.7, 0); const tv = box(0.08, 0.85, 1.5, 0x15191a, -4.24, 1.15, 0, { m: { roughness: 0.2, metalness: 0.4 } });
      box(0.02, 0.7, 1.35, 0x2a3a3f, -4.19, 1.15, 0, { mat: new T.MeshBasicMaterial({ color: 0x27414a }) });
      const lamp1 = lamp(-3.55, 0.05, -1.8); plant(-3.9, 0.05, 1.9, 1.5); plant(0.9, 0.05, -2.0, 1.2);
      box(0.9, 0.05, 0.9, 0xe8dcc0, 0.8, 0.9, 1.6, { m: { transparent: true, opacity: 0 } }).visible = false;
      cyl(0.17, 0.17, 0.5, 0x5b6663, 0.9, 0.3, 1.9, 20); // pouf

      /* ---------- BATHROOM (ground, right) ---------- */
      box(2.1, 0.55, 0.95, 0xfbfbf8, 3.3, 0.33, -2.0); box(1.85, 0.12, 0.7, 0xdfeaf0, 3.3, 0.6, -2.0);   // bathtub
      cyl(0.04, 0.04, 0.6, 0xb7c0c4, 4.35, 0.8, -2.0, 8); box(0.05, 1.8, 1.0, 0xdfeef0, 4.1, 1.0, -0.7, { m: { transparent: true, opacity: 0.35 } }); // shower glass
      box(0.8, 0.85, 0.5, 0xf5f2ea, 2.35, 0.47, 2.1); cyl(0.26, 0.2, 0.1, 0xffffff, 2.35, 0.95, 2.1, 20);  // vanity + basin
      box(0.02, 0.9, 0.7, 0xfdfdf4, 2.35, 1.7, 2.45, { mat: new T.MeshBasicMaterial({ color: 0xeaf4f2 }) });  // mirror
      cyl(0.17, 0.2, 0.34, 0xffffff, 3.9, 0.22, 1.7, 18); box(0.3, 0.4, 0.14, 0xffffff, 3.9, 0.45, 2.0);  // toilet
      plant(4.15, 0.05, 2.05, 0.9);

      /* ---------- BEDROOM (upper, left) ---------- */
      box(2.4, 0.42, 2.5, 0xb88f5f, -2.8, 3.1, -1.0); box(2.2, 0.28, 2.3, 0xfaf8f1, -2.8, 3.45, -1.0); box(2.2, 0.12, 1.0, 0x8fb39a, -2.8, 3.62, -0.5);
      box(0.8, 0.14, 0.4, 0xffffff, -3.4, 3.65, -1.9); box(0.8, 0.14, 0.4, 0xffffff, -2.2, 3.65, -1.9); box(2.5, 1.1, 0.12, 0xa57d4f, -2.8, 3.55, -2.3);
      box(0.5, 0.5, 0.5, 0xd9c6a2, -1.2, 3.1, -2.0); const lamp2 = lamp(-1.2, 3.35, -2.0);
      box(0.8, 2.2, 1.3, 0xefe7d6, -4.05, 3.95, 1.3); box(2.2, 0.02, 1.5, 0xdfe8d8, -2.2, 2.88, 0.9); plant(-0.3, 2.85, 1.8, 1.3);
      box(0.9, 1.1, 0.04, 0xfdf3d4, -0.7, 4.0, -2.45, { mat: new T.MeshBasicMaterial({ color: 0xffe9b8 }) });   // warm window

      /* ---------- terrace ---------- */
      plant(4.0, 2.85, 1.7, 1.3); plant(2.0, 2.85, -1.9, 1.1);
      box(0.9, 0.05, 0.9, 0xcaa675, 2.8, 3.1, -1.5); cyl(0.04, 0.04, 0.3, 0x8a6b45, 2.8, 2.95, -1.5, 8);

      /* ---------- garden ---------- */
      function tree(x, z, s) { cyl(0.12 * s, 0.17 * s, 1.2 * s, 0x8a6b45, x, 0.4, z, 8); [[0, 1.5, 0, 0.8], [0.4, 1.2, 0.2, 0.55], [-0.4, 1.25, -0.1, 0.6]].forEach(([dx, dy, dz, r]) => sphere(r * s, 0x5f9a62, x + dx * s, dy * s, z + dz * s)); }
      tree(-6.3, 1.3, 1.2); tree(6.5, -0.8, 1.0); tree(-5.6, -2.8, 0.8);
      [[-5.0, 3.3, 0.5], [-3.6, 3.4, 0.45], [-1.2, 3.35, 0.4], [5.2, 3.0, 0.5], [6.0, 2.2, 0.4], [-5.2, -3.2, 0.45], [4.8, -3.4, 0.5]].forEach(([x, z, r]) => sphere(r, 0x6aa86d, x, -0.1 + r * 0.5, z));

      /* ---------- warm interior lights ---------- */
      const warm = 0xffc98a, lights = [];
      [[-1.6, 2.2, 0, 1.4], [3.0, 2.2, 0, 1.0], [-2.0, 5.0, 0, 1.4]].forEach(([x, y, z, i]) => { const p = new T.PointLight(warm, i, 7, 1.6); p.position.set(x, y, z); house.add(p); lights.push(p); });
      [[-1.6, 2.55, 0.4], [-1.6, 2.55, -1.2], [3.0, 2.55, 0], [-2.0, 5.1, -0.8], [-2.0, 5.1, 0.8]].forEach(([x, y, z]) => cyl(0.14, 0.14, 0.04, 0xfff0c8, x, y, z, 16, { mat: new T.MeshBasicMaterial({ color: 0xfff0c8 }) }));

      /* ---------- room labels ---------- */
      [["Lounge", -1.6, 2.15, 2.6], ["Bathroom", 3.0, 2.15, 2.6], ["Bedroom", -1.5, 5.15, 2.7]].forEach(([n, x, y, z]) => { const s = labelSprite(n); s.position.set(x, y, z); house.add(s); });

      /* ---------- glowing energy orb ---------- */
      function orbTexture() {
        const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
        const rg = g.createRadialGradient(128, 128, 10, 128, 128, 128); rg.addColorStop(0, "rgba(190,255,200,.95)"); rg.addColorStop(0.35, "rgba(110,200,130,.55)"); rg.addColorStop(1, "rgba(80,180,110,0)"); g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
        g.beginPath(); g.arc(128, 128, 62, 0, 7); g.fillStyle = "#3b7a48"; g.fill(); g.lineWidth = 7; g.strokeStyle = "#e9ffe9"; g.stroke();
        g.beginPath(); g.moveTo(138, 88); g.lineTo(106, 134); g.lineTo(126, 134); g.lineTo(118, 170); g.lineTo(152, 120); g.lineTo(130, 120); g.closePath(); g.fillStyle = "#fff"; g.fill();
        const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
      }
      const orb = new T.Sprite(new T.SpriteMaterial({ map: orbTexture(), transparent: true, depthTest: false, blending: T.NormalBlending })); orb.scale.set(2.2, 2.2, 1); orb.position.set(2.9, 4.5, 0); orb.renderOrder = 30; house.add(orb);
      const orbLight = new T.PointLight(0x7fe39a, 1.4, 6); orbLight.position.copy(orb.position); house.add(orbLight);
      // data pulses travelling from the orb to each room
      const targets = [new T.Vector3(-1.6, 1.3, 0), new T.Vector3(-2.2, 3.6, 0), new T.Vector3(3.0, 1.2, 0)], pulses = [];
      targets.forEach((tg, i) => {
        const mid = orb.position.clone().add(tg).multiplyScalar(0.5); mid.y += 1.0; mid.z += (i - 1) * 0.6;
        const curve = new T.QuadraticBezierCurve3(orb.position.clone(), mid, tg);
        house.add(new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(30)), new T.LineBasicMaterial({ color: 0x5bb06f, transparent: true, opacity: 0.45 })));
        const dot = sphere(0.09, 0x9dffb0, 0, 0, 0, { mat: new T.MeshBasicMaterial({ color: 0x9dffb0 }) }); pulses.push({ curve, dot, off: i / 3 });
      });

      /* ---------- soft shadow blob ---------- */
      const sc = document.createElement("canvas"); sc.width = sc.height = 128; const sg = sc.getContext("2d"); const gr = sg.createRadialGradient(64, 64, 8, 64, 64, 64); gr.addColorStop(0, "rgba(35,69,44,.28)"); gr.addColorStop(1, "rgba(35,69,44,0)"); sg.fillStyle = gr; sg.fillRect(0, 0, 128, 128);
      const shadow = new T.Mesh(new T.PlaneGeometry(22, 22), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.88; scene.add(shadow);

      /* ---------- interaction + animation ---------- */
      let rot = -0.55, vel = 0, dragging = false, hover = false, lastX = 0, lastY = 0, idleSince = performance.now(), elev = 0.34, auto = opts.autoRotate !== false;
      const S = { speed: 0.32 };
      const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = "grabbing"; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} };
      const move = (e) => { if (!dragging) return; const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; rot += dx * 0.009; vel = dx * 0.009 * 60; elev = Math.max(0.05, Math.min(0.85, elev + dy * 0.004)); idleSince = performance.now(); };
      const up = () => { dragging = false; canvas.style.cursor = "grab"; idleSince = performance.now(); };
      canvas.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      canvas.addEventListener("pointerenter", () => (hover = true)); canvas.addEventListener("pointerleave", () => (hover = false));
      canvas.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") rot -= 0.15; if (e.key === "ArrowRight") rot += 0.15; }); canvas.tabIndex = 0;

      function resize() { const w = container.clientWidth || 600, h = container.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); const s = Math.min(1, w / h / 1.15); camera.userData.dist = 26 / Math.max(0.66, s); }
      new ResizeObserver(resize).observe(container); resize();

      let visible = true, last = performance.now(), t0 = last, frames = 0;
      new IntersectionObserver((en) => (visible = en[0].isIntersecting)).observe(container);
      function frame(now) {
        requestAnimationFrame(frame);
        if (!visible || document.hidden) { last = now; return; }
        const dt = Math.min(0.05, (now - last) / 1000); last = now; frames++;
        if (!dragging) {
          vel *= Math.pow(0.04, dt);                       // inertia from a drag
          rot += vel * dt;
          const idle = (now - idleSince) / 1000;          // resume auto-rotation 1.2 s after interaction
          if (auto && idle > 1.2) rot += S.speed * (hover ? 0.35 : 1) * dt * Math.min(1, (idle - 1.2) / 1.2);
        }
        house.rotation.y = rot;
        const d = camera.userData.dist || 24;
        camera.position.set(0, 3.2 + Math.sin(elev) * d * 0.9, Math.cos(elev) * d); camera.lookAt(0, 1.9, 0);
        const tt = (now - t0) / 1000;
        const pulse = 1 + Math.sin(tt * 2.2) * 0.07; orb.scale.set(2.2 * pulse, 2.2 * pulse, 1); orbLight.intensity = 1.3 + Math.sin(tt * 2.2) * 0.35;
        lights.forEach((l, i) => (l.intensity = (i === 2 ? 1.4 : i === 1 ? 1.0 : 1.4) + Math.sin(tt * 1.3 + i) * 0.05));
        pulses.forEach((p) => { const u = (tt * 0.28 + p.off) % 1; p.dot.position.copy(p.curve.getPoint(u)); p.dot.scale.setScalar(0.7 + Math.sin(u * Math.PI) * 0.8); });
        renderer.render(scene, camera);
      }
      requestAnimationFrame(frame);
      const api = { get rotation() { return rot; }, set autoRotate(v) { auto = v; }, get autoRotate() { return auto; }, get frames() { return frames; }, setRotation(v) { rot = v; } };
      window.__house = api; return api;
    },
  };
  window.WattHouse = WattHouse;
})();
