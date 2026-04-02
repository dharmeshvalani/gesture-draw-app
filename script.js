// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Drawing state
let prev = null;
let last = null;
let drawing = false;

let strokes = []; // for undo
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

// MediaPipe
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.4,
  minTrackingConfidence: 0.4
});

// ---------- Gesture Utils ----------
function fingerUp(l, tip, pip) {
  return l[tip].y < l[pip].y;
}

function isDraw(l) {
  return fingerUp(l, 8, 6) &&
         !fingerUp(l, 12, 10) &&
         !fingerUp(l, 16, 14);
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

// ---------- Stability Timers ----------
let palmCount = 0;
let gestureBuffer = [];

// Smooth filter
function smooth(p) {
  if (!last) return p;

  return {
    x: last.x * 0.7 + p.x * 0.3,
    y: last.y * 0.7 + p.y * 0.3
  };
}

// Undo
function undoLast() {
  strokes.pop();
  redrawCanvas();
}

function redrawCanvas() {
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

// ---------- MAIN ----------
hands.onResults((results) => {

  // 🛠 FIX: When hand disappears
  if (!results.multiHandLandmarks) {
    prev = null;
    last = null;
    drawing = false;
    currentStroke = [];
    return;
  }

  const l = results.multiHandLandmarks[0];

  let point = {
    x: (1 - l[8].x) * canvas.width,
    y: l[8].y * canvas.height
  };

  point = smooth(point);
  last = point;

  // ---------- Gesture Stability ----------
  let currentGesture = "none";

  if (isPalm(l)) currentGesture = "palm";
  else if (isFist(l)) currentGesture = "fist";
  else if (isDraw(l)) currentGesture = "draw";

  gestureBuffer.push(currentGesture);
  if (gestureBuffer.length > 5) gestureBuffer.shift();

  const stableGesture = gestureBuffer.every(g => g === currentGesture)
    ? currentGesture
    : "none";

  // ---------- CLEAR ----------
  if (stableGesture === "palm") {
    palmCount++;

    if (palmCount > 15) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes = [];
    }

    drawing = false;
    return;
  } else {
    palmCount = 0;
  }

  // ---------- PAUSE ----------
  if (stableGesture === "fist") {
    drawing = false;
    return;
  }

  // ---------- DRAW ----------
  if (stableGesture === "draw") {

    drawing = true;

    if (prev) {
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 70) {

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);

        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;

        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";

        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        ctx.stroke();

        // save stroke
        currentStroke.push({
          x: point.x,
          y: point.y,
          color,
          size
        });
      }
    }

    prev = point;

  } else {
    // Save completed stroke
    if (drawing && currentStroke.length > 0) {
      strokes.push(currentStroke);
      currentStroke = [];
    }

    drawing = false;
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
