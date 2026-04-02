// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const undoBtn = document.getElementById("undoBtn");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");

// Drawing state
let prev = null;
let last = null;

let strokes = [];
let currentStroke = [];

let color = "#00ffff";
let size = 5;

// Resize
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Buttons
clearBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes = [];
};

undoBtn.onclick = () => {
  strokes.pop();
  redraw();
};

saveBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = canvas.toDataURL();
  link.click();
};

// Redraw
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  strokes.forEach(stroke => {
    for (let i = 1; i < stroke.length; i++) {
      ctx.beginPath();
      ctx.moveTo(stroke[i-1].x, stroke[i-1].y);
      ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.strokeStyle = stroke[i].color;
      ctx.lineWidth = stroke[i].size;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  });
}

// ---------- SMOOTH ----------
function smooth(p) {
  if (!last) return p;
  return {
    x: last.x * 0.7 + p.x * 0.3,
    y: last.y * 0.7 + p.y * 0.3
  };
}

// ---------- GESTURES ----------
function fingerUp(l, tip, pip) {
  return l[tip].y < l[pip].y;
}

function isDraw(l) {
  return fingerUp(l, 8, 6) && !fingerUp(l, 12, 10);
}

function isPalm(l) {
  return fingerUp(l, 8, 6) &&
         fingerUp(l, 12, 10) &&
         fingerUp(l, 16, 14);
}

// ---------- SHAPE AI ----------
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Line
function isLine(points) {
  if (points.length < 5) return false;

  const start = points[0];
  const end = points[points.length - 1];

  let error = 0;

  for (let p of points) {
    const d = Math.abs(
      (end.y - start.y) * p.x -
      (end.x - start.x) * p.y +
      end.x * start.y -
      end.y * start.x
    ) / Math.hypot(end.y - start.y, end.x - start.x);

    error += d;
  }

  return error / points.length < 12;
}

// Circle
function isCircle(points) {
  if (points.length < 10) return false;

  if (dist(points[0], points[points.length - 1]) > 50) return false;

  let cx = 0, cy = 0;
  points.forEach(p => { cx += p.x; cy += p.y; });

  cx /= points.length;
  cy /= points.length;

  let r = 0;
  points.forEach(p => r += dist(p, {x: cx, y: cy}));
  r /= points.length;

  let error = 0;
  points.forEach(p => {
    error += Math.abs(dist(p, {x: cx, y: cy}) - r);
  });

  return error / points.length < 12;
}

// Rectangle
function isRectangle(points) {
  if (points.length < 10) return false;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  if (width < 40 || height < 40) return false;

  let edgePoints = 0;

  points.forEach(p => {
    const nearEdge =
      Math.abs(p.x - minX) < 15 ||
      Math.abs(p.x - maxX) < 15 ||
      Math.abs(p.y - minY) < 15 ||
      Math.abs(p.y - maxY) < 15;

    if (nearEdge) edgePoints++;
  });

  return edgePoints / points.length > 0.6;
}

// Draw perfect
function drawPerfectShape(points) {

  if (isCircle(points)) {
    let cx = 0, cy = 0;

    points.forEach(p => {
      cx += p.x;
      cy += p.y;
    });

    cx /= points.length;
    cy /= points.length;

    let r = 0;
    points.forEach(p => r += dist(p, {x: cx, y: cy}));
    r /= points.length;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = points[0].color;
    ctx.lineWidth = points[0].size;
    ctx.stroke();
    return true;
  }

  if (isRectangle(points)) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });

    ctx.beginPath();
    ctx.rect(minX, minY, maxX - minX, maxY - minY);
    ctx.strokeStyle = points[0].color;
    ctx.lineWidth = points[0].size;
    ctx.stroke();
    return true;
  }

  if (isLine(points)) {
    const start = points[0];
    const end = points[points.length - 1];

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = start.color;
    ctx.lineWidth = start.size;
    ctx.stroke();
    return true;
  }

  return false;
}

// ---------- MAIN ----------
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults((results) => {

  if (!results.multiHandLandmarks) {
    prev = last = null;
    return;
  }

  const l = results.multiHandLandmarks[0];

  let p = {
    x: (1 - l[8].x) * canvas.width,
    y: l[8].y * canvas.height
  };

  p = smooth(p);
  last = p;

  // Clear
  if (isPalm(l)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    prev = null;
    return;
  }

  // Draw
  if (isDraw(l)) {

    if (prev) {
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);

      const midX = (prev.x + p.x) / 2;
      const midY = (prev.y + p.y) / 2;

      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);

      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";

      ctx.stroke();

      currentStroke.push({ ...p, color, size });
    }

    prev = p;

  } else {

    if (currentStroke.length > 0) {

      const corrected = drawPerfectShape(currentStroke);

      if (!corrected) {
        strokes.push(currentStroke);
      }

      currentStroke = [];
    }

    prev = null;
  }
});

// Camera
const camera = new Camera(video, {
  onFrame: async () => {
    if (video.readyState === 4) {
      await hands.send({ image: video });
    }
  },
  width: 640,
  height: 480
});

camera.start();

// Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
      }
