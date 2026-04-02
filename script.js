// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");

// Drawing state
let prevX = null;
let prevY = null;

let color = colorPicker.value;
let size = brushSize.value;

// Resize canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Controls
colorPicker.oninput = () => color = colorPicker.value;
brushSize.oninput = () => size = brushSize.value;

clearBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

saveBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = canvas.toDataURL();
  link.click();
};

// MediaPipe setup
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// Better mobile detection
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Gesture detection
function isOpenPalm(l) {
  return l[8].y < l[6].y &&
         l[12].y < l[10].y &&
         l[16].y < l[14].y &&
         l[20].y < l[18].y;
}

function isIndexUp(l) {
  return l[8].y < l[6].y;
}

// Main tracking
hands.onResults((results) => {

  console.log("Hand Results:", results); // FIX 2

  if (!results.multiHandLandmarks) {
    prevX = prevY = null;
    return;
  }

  const landmarks = results.multiHandLandmarks[0];

  // FIX 5 (DEBUG RED DOTS)
  ctx.fillStyle = "red";
  for (let i = 0; i < landmarks.length; i++) {
    let px = (1 - landmarks[i].x) * canvas.width;
    let py = landmarks[i].y * canvas.height;

    ctx.beginPath();
    ctx.arc(px, py, 4, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Index finger position
  const x = (1 - landmarks[8].x) * canvas.width;
  const y = landmarks[8].y * canvas.height;

  // ERASE (open palm)
  if (isOpenPalm(landmarks)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prevX = prevY = null;
    return;
  }

  // DRAW (index finger)
  if (isIndexUp(landmarks)) {

    // Smooth interpolation
    if (prevX && prevY) {
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);

      // smoothing effect
      const smoothX = (prevX + x) / 2;
      const smoothY = (prevY + y) / 2;

      ctx.lineTo(smoothX, smoothY);

      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";

      // Glow effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;

      ctx.stroke();
    }

    prevX = x;
    prevY = y;

  } else {
    prevX = prevY = null;
  }
});

// Camera start (FIXED)
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
