// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const undoBtn = document.getElementById("undoBtn");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");

// State
let prev = null;
let last = null;
let strokes = [];
let currentStroke = [];

let colors = ["#00ffff", "#ff3b3b", "#00ff88", "#ffd500"];
let colorIndex = 0;
let color = colors[colorIndex];

let size = 5;

// Transform (zoom + pan)
let scale = 1;
let offsetX = 0;
let offsetY = 0;

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

// Redraw with transform
function redraw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

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

// Smooth
function smooth(p) {
  if (!last) return p;
  return {
    x: last.x * 0.7 + p.x * 0.3,
    y: last.y * 0.7 + p.y * 0.3
  };
}

// Gesture helpers
function fingerUp(l, tip, pip) {
  return l[tip].y < l[pip].y;
}

function isDraw(l) {
  return fingerUp(l, 8, 6) && !fingerUp(l, 12, 10);
}

function isTwoFinger(l) {
  return fingerUp(l, 8, 6) && fingerUp(l, 12, 10);
}

function isPalm(l) {
  return fingerUp(l, 8, 6) &&
         fingerUp(l, 12, 10) &&
         fingerUp(l, 16, 14);
}

function isFist(l) {
  return !fingerUp(l, 8, 6) &&
         !fingerUp(l, 12, 10);
}

// Pinch distance
function pinchDistance(l) {
  return Math.hypot(
    l[4].x - l[8].x,
    l[4].y - l[8].y
  );
}

// Gesture memory
let lastGesture = "";
let lastPinch = null;
let lastPan = null;

// MediaPipe
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

// Main
hands.onResults((results) => {

  if (!results.multiHandLandmarks) {
    prev = last = null;
    lastPinch = null;
    lastPan = null;
    return;
  }

  const l = results.multiHandLandmarks[0];

  let p = {
    x: (1 - l[8].x) * canvas.width,
    y: l[8].y * canvas.height
  };

  p = smooth(p);
  last = p;

  // ✋ Clear
  if (isPalm(l)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    prev = null;
    return;
  }

  // ✊ Pause
  if (isFist(l)) {
    prev = null;
    return;
  }

  // 🎨 Color change (two finger tap)
  if (isTwoFinger(l) && lastGesture !== "two") {
    colorIndex = (colorIndex + 1) % colors.length;
    color = colors[colorIndex];
  }

  // 🔍 Zoom (pinch)
  const pinch = pinchDistance(l);

  if (pinch) {
    if (lastPinch) {
      const diff = pinch - lastPinch;
      scale += diff * 2;

      scale = Math.max(0.5, Math.min(3, scale));
      redraw();
    }
    lastPinch = pinch;
  }

  // 🖐 Pan (move open hand)
  if (isPalm(l)) {
    if (lastPan) {
      offsetX += p.x - lastPan.x;
      offsetY += p.y - lastPan.y;
      redraw();
    }
    lastPan = p;
  } else {
    lastPan = null;
  }

  // ✏️ Draw
  if (isDraw(l)) {

    if (prev) {
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

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
      strokes.push(currentStroke);
      currentStroke = [];
    }
    prev = null;
  }

  lastGesture = isTwoFinger(l) ? "two" : "";
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
