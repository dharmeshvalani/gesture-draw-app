// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let prev = null;
let last = null;

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
  minDetectionConfidence: 0.4,   // 🔥 lower = better weak detection
  minTrackingConfidence: 0.4
});

// Gesture detection
function fingerUp(l, tip, pip) {
  return l[tip].y < l[pip].y;
}

function isDrawGesture(l) {
  return fingerUp(l, 8, 6) &&  // index up
         !fingerUp(l, 12, 10) &&
         !fingerUp(l, 16, 14) &&
         !fingerUp(l, 20, 18);
}

function isPalm(l) {
  return fingerUp(l, 8, 6) &&
         fingerUp(l, 12, 10) &&
         fingerUp(l, 16, 14) &&
         fingerUp(l, 20, 18);
}

function isFist(l) {
  return !fingerUp(l, 8, 6) &&
         !fingerUp(l, 12, 10);
}

// Gesture timers (avoid flicker)
let palmTimer = 0;

// Smooth filter
function smoothPoint(newPoint) {
  if (!last) return newPoint;

  return {
    x: last.x * 0.7 + newPoint.x * 0.3,
    y: last.y * 0.7 + newPoint.y * 0.3
  };
}

// Main logic
hands.onResults((results) => {

  if (!results.multiHandLandmarks) {
    prev = last = null;
    return;
  }

  const l = results.multiHandLandmarks[0];

  let point = {
    x: (1 - l[8].x) * canvas.width,
    y: l[8].y * canvas.height
  };

  point = smoothPoint(point);
  last = point;

  // ✋ CLEAR (hold palm)
  if (isPalm(l)) {
    palmTimer++;

    if (palmTimer > 10) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    prev = null;
    return;
  } else {
    palmTimer = 0;
  }

  // ✊ PAUSE
  if (isFist(l)) {
    prev = null;
    return;
  }

  // ✏️ DRAW
  if (isDrawGesture(l)) {

    if (prev) {

      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // noise filter
      if (dist < 60) {

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);

        // smooth curve
        const midX = (prev.x + point.x) / 2;
        const midY = (prev.y + point.y) / 2;

        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";

        ctx.shadowColor = color;
        ctx.shadowBlur = 10;

        ctx.stroke();
      }
    }

    prev = point;

  } else {
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
