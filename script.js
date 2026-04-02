// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let prev = null;
let last = null;
let drawing = false;

let strokes = [];
let currentStroke = [];

let colors = ["#00ffff", "#ff3b3b", "#00ff88", "#ffd500"];
let colorIndex = 0;
let color = colors[colorIndex];

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

// Gesture helpers
function fingerUp(l, tip, pip) {
  return l[tip].y < l[pip].y;
}

function isDraw(l) {
  return fingerUp(l, 8, 6) &&
         !fingerUp(l, 12, 10) &&
         !fingerUp(l, 16, 14);
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

// Smooth
function smooth(p) {
  if (!last) return p;
  return {
    x: last.x * 0.7 + p.x * 0.3,
    y: last.y * 0.7 + p.y * 0.3
  };
}

// Undo
function undo() {
  strokes.pop();
  redraw();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(stroke => {
    for (let i = 1; i < stroke.length; i++) {
      ctx.beginPath();
      ctx.moveTo(stroke[i-1].x, stroke[i-1].y);
      ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.strokeStyle = stroke[i].color;
      ctx.lineWidth = stroke[i].size;
      ctx.stroke();
    }
  });
}

// Gesture buffer
let buffer = [];
let palmHold = 0;
let lastGesture = "";

// Main
hands.onResults((results) => {

  if (!results.multiHandLandmarks) {
    prev = last = null;
    drawing = false;
    return;
  }

  const l = results.multiHandLandmarks[0];

  let p = {
    x: (1 - l[8].x) * canvas.width,
    y: l[8].y * canvas.height
  };

  p = smooth(p);
  last = p;

  // Detect gesture
  let g = "none";
  if (isPalm(l)) g = "palm";
  else if (isFist(l)) g = "fist";
  else if (isTwoFinger(l)) g = "two";
  else if (isDraw(l)) g = "draw";

  buffer.push(g);
  if (buffer.length > 5) buffer.shift();

  const stable = buffer.every(x => x === g) ? g : "none";

  // ✋ Clear
  if (stable === "palm") {
    palmHold++;
    if (palmHold > 15) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      strokes = [];
    }
    return;
  } else {
    palmHold = 0;
  }

  // ✊ Pause
  if (stable === "fist") {
    drawing = false;
    return;
  }

  // ✌️ Two finger → change color
  if (stable === "two" && lastGesture !== "two") {
    colorIndex = (colorIndex + 1) % colors.length;
    color = colors[colorIndex];
  }

  // ✌️ Hold two finger → increase size
  if (stable === "two") {
    size = Math.min(size + 0.1, 20);
  }

  // ✏️ Draw
  if (stable === "draw") {

    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 70) {
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);

        const midX = (prev.x + p.x) / 2;
        const midY = (prev.y + p.y) / 2;

        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";

        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.stroke();

        currentStroke.push({ ...p, color, size });
      }
    }

    prev = p;

  } else {
    if (drawing && currentStroke.length > 0) {
      strokes.push(currentStroke);
      currentStroke = [];
    }
    prev = null;
  }

  lastGesture = stable;
  drawing = (stable === "draw");
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
