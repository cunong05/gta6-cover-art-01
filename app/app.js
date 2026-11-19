/* Vice Cover Studio — GTA-style multi-panel cover maker.
   Plain canvas 2D, no libraries, no network. Photos stay on the machine. */
'use strict';

const $ = (id) => document.getElementById(id);
const preview = $('preview');

/* ---------------------------------------------------------------- state */

const SIZES = {
  '1080x1350': { w: 1080, h: 1350 },
  '1080x1080': { w: 1080, h: 1080 },
  '1920x1080': { w: 1920, h: 1080 },
};

/** One panel's photo placement. ox/oy are fractions of the panel box. */
function freshPanel(photo) {
  return { photo: photo, zoom: 1, ox: 0, oy: 0, flip: false };
}

const state = {
  photos: [],            // HTMLImageElement[]
  photoNames: [],
  layout: 'hero3',
  grade: 'sunset',
  titleStyle: 'sunset',
  texture: 'both',
  title: 'VICE CITY',
  subtitle: 'Neon nights, palm dreams',
  size: '1080x1350',
  selected: 0,
  panels: [freshPanel(0), freshPanel(1), freshPanel(0), freshPanel(1)],
};

const LAYOUTS = {
  full: { count: 1, label: 'Full-bleed' },
  split: { count: 2, label: 'Diagonal split' },
  hero3: { count: 3, label: 'Hero + 2' },
  grid4: { count: 4, label: 'Grid 4' },
};

/* ------------------------------------------------------- panel geometry */

/** Panel polygons as fractions of (w, h), in draw order. Diagonal GTA cuts. */
function layoutPolygons(layout, w, h) {
  const F = (pts) => pts.map(([fx, fy]) => [fx * w, fy * h]);
  switch (layout) {
    case 'full':
      return [F([[0, 0], [1, 0], [1, 1], [0, 1]])];
    case 'split':
      return [
        F([[0, 0], [1, 0], [0.45, 1], [0, 1]]),
        F([[1, 0], [1, 1], [0.45, 1]]),
      ];
    case 'hero3':
      return [
        F([[0, 0], [0.62, 0], [0.56, 1], [0, 1]]),
        F([[0.62, 0], [1, 0], [1, 0.5], [0.59, 0.5]]),
        F([[0.59, 0.5], [1, 0.5], [1, 1], [0.56, 1]]),
      ];
    case 'grid4':
    default:
      return [
        F([[0, 0], [0.52, 0], [0.48, 0.52], [0, 0.48]]),
        F([[0.52, 0], [1, 0], [1, 0.48], [0.48, 0.52]]),
        F([[0, 0.48], [0.48, 0.52], [0.44, 1], [0, 1]]),
        F([[0.48, 0.52], [1, 0.48], [1, 1], [0.44, 1]]),
      ];
  }
}

function polygonBounds(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ------------------------------------------------------------ textures */

let grainPattern = null;
function makeGrainPattern(ctx) {
  if (grainPattern) return grainPattern;
  const tile = document.createElement('canvas');
  tile.width = 128; tile.height = 128;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(tile, 'repeat');
  return grainPattern;
}

let halftonePattern = null;
function makeHalftonePattern(ctx) {
  if (halftonePattern) return halftonePattern;
  const tile = document.createElement('canvas');
  tile.width = 14; tile.height = 14;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#000';
  tctx.beginPath(); tctx.arc(7, 7, 2.2, 0, Math.PI * 2); tctx.fill();
  halftonePattern = ctx.createPattern(tile, 'repeat');
  return halftonePattern;
}

/* ---------------------------------------------------------------- drawing */

const GRADES = {
  sunset: {
    stops: [[0, '#ff8c1a'], [0.45, '#ff5e8a'], [1, '#5b1a8a']],
    glow: 'rgba(255, 122, 24, 0.55)',
  },
  neon: {
    stops: [[0, '#22d3ee'], [0.5, '#7c3aed'], [1, '#ff2e88']],
    glow: 'rgba(34, 211, 238, 0.5)',
  },
  gold: {
    stops: [[0, '#2aa5a0'], [0.5, '#e8c33c'], [1, '#ffe89a']],
    glow: 'rgba(255, 232, 154, 0.5)',
  },
};

function clipPolygon(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.clip();
}

function drawPhotoInPanel(ctx, img, poly, panel) {
  const box = polygonBounds(poly);
  ctx.save();
  clipPolygon(ctx, poly);
  // Cover-fit the panel box, then zoom and pan.
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const cx = box.x + box.w / 2 + panel.ox * box.w;
  const cy = box.y + box.h / 2 + panel.oy * box.h;
  if (panel.flip) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  }
  ctx.restore();
}

function drawPanelPlaceholder(ctx, poly, index) {
  const box = polygonBounds(poly);
  ctx.save();
  clipPolygon(ctx, poly);
  const grad = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
  grad.addColorStop(0, '#3a2b5c');
  grad.addColorStop(1, '#1a1030');
  ctx.fillStyle = grad;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `700 ${Math.max(14, box.w * 0.05)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`PANEL ${index + 1} — ADD A PHOTO`, box.x + box.w / 2, box.y + box.h / 2);
  ctx.restore();
}

function drawGrade(ctx, w, h, grade) {
  const g = GRADES[grade] || GRADES.sunset;
  const grad = ctx.createLinearGradient(0, 0, w * 0.7, h);
  for (const [stop, color] of g.stops) grad.addColorStop(stop, color);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // Vignette: darken the edges so the title pops.
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawTextures(ctx, w, h, texture) {
  if (texture === 'none') return;
  ctx.save();
  if (texture === 'both' || texture === 'grain') {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = makeGrainPattern(ctx);
    ctx.fillRect(0, 0, w, h);
  }
  if (texture === 'both') {
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = makeHalftonePattern(ctx);
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

const TITLE_STYLES = {
  sunset: { fill: ['#fff7d6', '#ffb347', '#ff5e3a'], stroke: '#7a1042', shadow: '#ff2e88' },
  neon: { fill: ['#e6fbff', '#22d3ee', '#ff2e88'], stroke: '#12002e', shadow: '#22d3ee' },
  gold: { fill: ['#fffbe6', '#ffe27a', '#c9a227'], stroke: '#043d3c', shadow: '#ffb347' },
};

function drawTitleBlock(ctx, w, h) {
  const style = TITLE_STYLES[state.titleStyle] || TITLE_STYLES.sunset;
  const title = (state.title || 'VICE CITY').toUpperCase();
  const sub = state.subtitle || '';
  const pad = w * 0.045;
  const titleSize = Math.min(w * 0.115, (w - pad * 2) / Math.max(1, title.length * 0.62));
  const subSize = Math.max(w * 0.028, 18);
  const bandH = titleSize * 1.9 + subSize * 1.6;
  const bandY = h - bandH;

  ctx.save();
  // Dark band behind the lettering so it reads over any photo.
  const band = ctx.createLinearGradient(0, bandY, 0, h);
  band.addColorStop(0, 'rgba(0,0,0,0)');
  band.addColorStop(0.35, 'rgba(0,0,0,0.55)');
  band.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = band;
  ctx.fillRect(0, bandY, w, bandH);

  // Slanted poster lettering.
  ctx.translate(pad, bandY + subSize * 1.5);
  ctx.transform(1, 0, -0.1, 1, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Subtitle first, in a neon-script-ish italic.
  if (sub) {
    ctx.font = `italic 700 ${subSize}px "Segoe Script", "Brush Script MT", cursive, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = style.shadow;
    ctx.shadowBlur = subSize * 0.7;
    ctx.fillText(sub, 0, 0);
    ctx.shadowBlur = 0;
  }

  // Big title with gradient fill, thick outline and drop shadow.
  const grad = ctx.createLinearGradient(0, subSize * 0.9, 0, subSize * 0.9 + titleSize);
  grad.addColorStop(0, style.fill[0]);
  grad.addColorStop(0.55, style.fill[1]);
  grad.addColorStop(1, style.fill[2]);
  ctx.font = `900 ${titleSize}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowOffsetX = titleSize * 0.06;
  ctx.shadowOffsetY = titleSize * 0.07;
  ctx.shadowBlur = titleSize * 0.05;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = titleSize * 0.14;
  ctx.strokeText(title, 0, subSize * 0.9 + titleSize);
  ctx.fillStyle = grad;
  ctx.fillText(title, 0, subSize * 0.9 + titleSize);
  ctx.restore();
}

function drawCover(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#120a1e';
  ctx.fillRect(0, 0, w, h);
  const polys = layoutPolygons(state.layout, w, h);
  const count = LAYOUTS[state.layout].count;
  for (let i = 0; i < count; i++) {
    const panel = state.panels[i];
    const img = panel.photo >= 0 ? state.photos[panel.photo] : null;
    if (img) drawPhotoInPanel(ctx, img, polys[i], panel);
    else drawPanelPlaceholder(ctx, polys[i], i);
  }
  // White poster seams between panels.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.lineJoin = 'round';
  for (const poly of polys) {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
    ctx.stroke();
  }
  // Outer frame.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(3, w * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  drawGrade(ctx, w, h, state.grade);
  drawTextures(ctx, w, h, state.texture);
  drawTitleBlock(ctx, w, h);
}

/* ------------------------------------------------------------- preview */

function renderPreview() {
  const size = SIZES[state.size];
  const scale = 540 / size.w;
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  const ctx = preview.getContext('2d');
  drawCover(ctx, preview.width, preview.height);
}

/* -------------------------------------------------------------- export */

function exportCover(w, h, filename) {
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off.getContext('2d'), w, h);
  return new Promise((resolve, reject) => {
    off.toBlob((blob) => {
      if (!blob) { reject(new Error('export failed')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve(blob);
    }, 'image/png');
  });
}

/** Automation hook: returns a PNG data URL of the cover at the given size. */
window.viceExportDataURL = async function (w, h) {
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  drawCover(off.getContext('2d'), w, h);
  return off.toDataURL('image/png');
};

/* -------------------------------------------------------------- photos */

function addPhoto(img, name) {
  if (state.photos.length >= 4) {
    state.photos.shift();
    state.photoNames.shift();
  }
  state.photos.push(img);
  state.photoNames.push(name);
  // Point empty panels at the new photo.
  for (const p of state.panels) if (p.photo < 0) p.photo = state.photos.length - 1;
  refreshThumbs();
  refreshPanelPhotoSelect();
  renderPreview();
}

function loadPhotoFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => addPhoto(img, file.name);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function loadSample(url, name) {
  const img = new Image();
  img.onload = () => addPhoto(img, name);
  img.onerror = () => { /* samples are optional; ignore a missing file */ };
  img.src = url;
}

function refreshThumbs() {
  const box = $('thumbs');
  box.innerHTML = '';
  state.photos.forEach((img, i) => {
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = state.photoNames[i] || `Photo ${i + 1}`;
    t.title = t.alt;
    t.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      refreshPanelPhotoSelect();
      renderPreview();
    });
    box.appendChild(t);
  });
}

function refreshPanelPhotoSelect() {
  const sel = $('panelPhoto');
  const current = state.panels[state.selected].photo;
  sel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = '— empty —';
  sel.appendChild(none);
  state.photos.forEach((img, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Photo ${i + 1} (${state.photoNames[i] || 'image'})`;
    sel.appendChild(opt);
  });
  sel.value = String(current);
}

/* -------------------------------------------------------------- controls */

function setLayout(layout) {
  state.layout = layout;
  state.selected = 0;
  document.querySelectorAll('#layoutButtons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === layout);
  });
  refreshPanelPhotoSelect();
  syncPanelControls();
  renderPreview();
}

function setGrade(grade) {
  state.grade = grade;
  document.querySelectorAll('#gradeButtons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === grade);
  });
  renderPreview();
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  $('zoom').value = String(Math.round(panel.zoom * 100));
  $('zoomOut').textContent = `${Math.round(panel.zoom * 100)}%`;
  refreshPanelPhotoSelect();
}

function bindControls() {
  $('photoInput').addEventListener('change', (e) => {
    for (const file of e.target.files) loadPhotoFile(file);
    e.target.value = '';
  });
  $('sampleSunset').addEventListener('click', () => loadSample('samples/sunset.jpg', 'Sunset skyline'));
  $('sampleNeon').addEventListener('click', () => loadSample('samples/neon.jpg', 'Neon street'));
  document.querySelectorAll('#layoutButtons button').forEach((b) => {
    b.addEventListener('click', () => setLayout(b.dataset.layout));
  });
  document.querySelectorAll('#gradeButtons button').forEach((b) => {
    b.addEventListener('click', () => setGrade(b.dataset.grade));
  });
  $('panelPhoto').addEventListener('change', (e) => {
    state.panels[state.selected].photo = Number(e.target.value);
    renderPreview();
  });
  $('zoom').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value) / 100;
    $('zoomOut').textContent = `${e.target.value}%`;
    renderPreview();
  });
  $('flipBtn').addEventListener('click', () => {
    state.panels[state.selected].flip = !state.panels[state.selected].flip;
    renderPreview();
  });
  $('fillAllBtn').addEventListener('click', () => {
    if (state.photos.length === 0) return;
    for (const p of state.panels) p.photo = 0;
    renderPreview();
  });
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('titleStyle').addEventListener('change', (e) => { state.titleStyle = e.target.value; renderPreview(); });
  $('textureSelect').addEventListener('change', (e) => { state.texture = e.target.value; renderPreview(); });
  $('sizeSelect').addEventListener('change', (e) => { state.size = e.target.value; renderPreview(); });

  const doExport = (sizeKey) => {
    const s = SIZES[sizeKey];
    return exportCover(s.w, s.h, `vice-cover-${s.w}x${s.h}.png`);
  };
  $('exportBtn').addEventListener('click', () => doExport(state.size));
  $('exportSquare').addEventListener('click', () => doExport('1080x1080'));
  $('exportPortrait').addEventListener('click', () => doExport('1080x1350'));
  $('exportWide').addEventListener('click', () => doExport('1920x1080'));

  // Drag to position the selected panel's photo; click selects a panel.
  let dragging = false;
  let lastX = 0, lastY = 0;
  let moved = false;
  const toCanvas = (e) => {
    const rect = preview.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (preview.width / rect.width),
      y: (e.clientY - rect.top) * (preview.height / rect.height),
    };
  };
  preview.addEventListener('pointerdown', (e) => {
    const p = toCanvas(e);
    const polys = layoutPolygons(state.layout, preview.width, preview.height);
    for (let i = polys.length - 1; i >= 0; i--) {
      if (pointInPolygon(p.x, p.y, polys[i])) { state.selected = i; break; }
    }
    syncPanelControls();
    dragging = true;
    moved = false;
    lastX = p.x; lastY = p.y;
    preview.classList.add('dragging');
    preview.setPointerCapture(e.pointerId);
    renderPreview();
  });
  preview.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = toCanvas(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
    const polys = layoutPolygons(state.layout, preview.width, preview.height);
    const box = polygonBounds(polys[state.selected]);
    const panel = state.panels[state.selected];
    panel.ox += dx / box.w;
    panel.oy += dy / box.h;
    // Keep the photo from sliding entirely out of its panel.
    panel.ox = Math.max(-0.6, Math.min(0.6, panel.ox));
    panel.oy = Math.max(-0.6, Math.min(0.6, panel.oy));
    lastX = p.x; lastY = p.y;
    if (moved) renderPreview();
  });
  const endDrag = () => { dragging = false; preview.classList.remove('dragging'); };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
}

/* ------------------------------------------------------------------ init */

bindControls();
syncPanelControls();
renderPreview();
// Load the two built-in sample scenes so the app opens with cover art.
loadSample('samples/sunset.jpg', 'Sunset skyline');
loadSample('samples/neon.jpg', 'Neon street');
