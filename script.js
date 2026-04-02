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

let color = "#00ffff";
let size = 5;

let lastGesture = "";
let isDrawing = false;

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
      ctx.moveTo(stroke[i - 1].x, stroke[i - 1].y);
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
    x: last.x * 0.75 + p.x * 0.25,
    y: last.y * 0.75 + p.y * 0.25
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

// MAIN
hands.onResults((results) => {

  // 🔴 FULL RESET WHEN HAND LOST
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    prev = null;
    last = null;
    currentStroke = [];
    lastGesture = "";
    isDrawing = false;
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
    isDrawing = false;
    return;
  }

  // ✊ Pause
  if (isFist(l)) {
    prev = null;
    isDrawing = false;
    return;
  }

  // 🎨 Color change (safe trigger)
  if (isTwoFinger(l) && lastGesture !== "two") {
    const colors = ["#00ffff", "#ff3b3b", "#00ff88", "#ffd500"];
    const index = colors.indexOf(color);
    color = colors[(index + 1) % colors.length];
  }

  // ✏️ Draw
  if (isDraw(l)) {

    isDrawing = true;

    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Prevent jump lines
      if (dist < 80) {
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
    }

    prev = p;

  } else {

    // Save stroke properly
    if (isDrawing && currentStroke.length > 0) {
      strokes.push(currentStroke);
      currentStroke = [];
    }

    isDrawing = false;
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
