// Interactive 3D cabinet run for the home hero. Drag to rotate; doors and drawers animate.
import * as THREE from 'three';

const TAUPE = 0xB1A595, WHITE = 0xF4F1EC, INK = 0x2B2A27, TOP = 0x3A3834;

export function mountHero(container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch { return () => {}; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3834, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(TAUPE, 1.6);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.02 });
  const mCarcass = mat(WHITE), mDoor = mat(TAUPE), mTop = mat(TOP), mHandle = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.3, metalness: 0.6 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8E8272, transparent: true, opacity: 0.35 });

  function box(w, h, d, m, x = 0, y = 0, z = 0, parent) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (m === mDoor) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat));
    (parent || model).add(mesh);
    return mesh;
  }

  const model = new THREE.Group();
  const animated = [];

  // Swinging door: pivot at hinge edge.
  function door(w, h, x, y, z, hingeLeft, parent, phase) {
    const pivot = new THREE.Group();
    pivot.position.set(x + (hingeLeft ? -w / 2 : w / 2), y, z);
    const d = box(w - 0.012, h - 0.012, 0.022, mDoor, hingeLeft ? w / 2 : -w / 2, 0, 0.011, pivot);
    box(0.016, Math.min(0.22, h * 0.4), 0.02, mHandle, hingeLeft ? w - 0.06 : -w + 0.06, h > 0.5 ? (y > 1 ? -h / 2 + 0.14 : h / 2 - 0.14) : 0, 0.035, pivot);
    (parent || model).add(pivot);
    animated.push({ kind: 'door', obj: pivot, dir: hingeLeft ? -1 : 1, phase });
    return d;
  }
  // Sliding drawer.
  function drawer(w, h, x, y, z, phase) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    box(w - 0.012, h - 0.012, 0.022, mDoor, 0, 0, 0.011, g);
    box(w * 0.4, 0.016, 0.02, mHandle, 0, h / 2 - 0.06, 0.035, g);
    box(w - 0.06, h - 0.08, 0.5, mCarcass, 0, -0.01, -0.25, g);
    model.add(g);
    animated.push({ kind: 'drawer', obj: g, z0: z, phase });
  }

  // Base run: 3 units of 0.6m
  const bw = 0.6, bh = 0.72, bd = 0.58, kick = 0.1;
  box(bw * 3, kick, bd - 0.06, mat(INK), 0, kick / 2, -0.03);
  box(bw * 3, bh, bd, mCarcass, 0, kick + bh / 2, 0);
  box(bw * 3 + 0.04, 0.04, bd + 0.04, mTop, 0, kick + bh + 0.02, 0.02);
  const fz = bd / 2 + 0.001;
  door(bw, bh, -bw, kick + bh / 2, fz, true, null, 0);
  [0.28, 0.22, 0.22].reduce((top, h, i) => { drawer(bw, h, 0, top - h / 2, fz, 1.2 + i * 0.35); return top - h; }, kick + bh);
  door(bw / 2, bh, bw * 0.75, kick + bh / 2, fz, false, null, 2.6);
  door(bw / 2, bh, bw * 1.25, kick + bh / 2, fz, true, null, 2.6);

  // Uppers
  const uh = 0.7, ud = 0.34, uy = kick + bh + 0.04 + 0.5 + uh / 2;
  box(bw * 3, uh, ud, mCarcass, 0, uy, -(bd - ud) / 2);
  const uz = -(bd - ud) / 2 + ud / 2 + 0.001;
  door(bw, uh, -bw, uy, uz, true, null, 3.6);
  door(bw, uh, 0, uy, uz, false, null, 4.4);
  door(bw, uh, bw, uy, uz, true, null, 5.2);

  // Tall pantry on the right
  const th = kick + bh + 0.04 + 0.5 + uh;
  box(bw, th - kick, bd, mCarcass, bw * 2, kick + (th - kick) / 2, 0);
  box(bw, kick, bd - 0.06, mat(INK), bw * 2, kick / 2, -0.03);
  door(bw, th - kick, bw * 2, kick + (th - kick) / 2, fz, false, null, 6.2);

  // Soft floor shadow
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g2 = c.getContext('2d');
  const grad = g2.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = grad;
  g2.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.3, 0.001, 0);
  model.add(shadow);

  const pivot = new THREE.Group();
  model.position.set(-0.3, -th / 2, 0);
  pivot.add(model);
  scene.add(pivot);

  // Interaction
  let rotY = -0.55, velY = 0, dragging = false, lastX = 0, lastT = 0, userTouched = 0;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; userTouched = performance.now(); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    velY = dx * 0.008;
    rotY += velY;
  });
  const end = () => { dragging = false; userTouched = performance.now(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = camera.aspect < 1.3;
    camera.fov = narrow ? 34 : 28;
    camera.position.set(0, 1.1, narrow ? 6.4 : 5.6);
    camera.lookAt(0, 0.1, 0);
    camera.updateProjectionMatrix();
    pivot.position.set(narrow ? 0.5 : 1.2, narrow ? -0.3 : 0, 0);
    pivot.scale.setScalar(narrow ? 0.68 : 1);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, raf = 0, t0 = performance.now();
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) loop(); });
  io.observe(container);

  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    if (!dragging) {
      velY *= 0.94;
      rotY += velY;
      if (performance.now() - userTouched > 2500 && !reduce) rotY += Math.sin(t * 0.25) * 0.0025;
    }
    pivot.rotation.y = rotY;
    pivot.rotation.x = 0.06 + Math.sin(t * 0.4) * (reduce ? 0 : 0.015);
    for (const a of animated) {
      // Each part opens for a short window inside an 8s cycle.
      const k = reduce ? 0 : Math.max(0, Math.sin(((t * 0.78 + 8 - a.phase) % 8) / 8 * Math.PI * 4)) ** 2 * (((t * 0.78 + 8 - a.phase) % 8) < 2 ? 1 : 0);
      if (a.kind === 'door') a.obj.rotation.y = a.dir * k * 1.35;
      else a.obj.position.z = a.z0 + k * 0.32;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  const onVis = () => { if (!document.hidden && !raf) loop(); };
  document.addEventListener('visibilitychange', onVis);
  loop();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    renderer.dispose();
    scene.traverse(o => { o.geometry?.dispose(); });
    el.remove();
  };
}
