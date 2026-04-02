// Elements
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const clearBtn = document.getElementById("clearBtn");
const saveBtn = document.getElementById("saveBtn");
const colorPicker = document.getElementById("colorPicker");
const brushSize = document.getElementById("brushSize");

let prevX = null;
let prevY = null;

let color = colorPicker.value;
let size = brushSize.value;

// Smooth filter
let lastX = null;
let lastY = null;
const smoothFactor = 0.7;

// Resize
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Controls
colorPicker.oninput = () => color = colorPicker.value;
brushSize.oninput = () => size = brushSize.value;

clearBtn.onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);

saveBtn.onclick = () => {
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = canvas.toDataURL();
  link.click();
};

// MediaPipe
const hands = new Hands({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

// Better gesture detection
function isIndexOnly(l) {
  return (
    l[8].y < l[6].y &&   // index up
    l[12].y > l[10].y && // middle down
    l[16].y > l[14].y && // ring down
    l[20].y > l[18].y    // pinky down
  );
}

function isOpenPalm(l) {
  return (
    l[8].y < l[6].y &&
    l[12].y < l[10].y &&
    l[16].y < l[14].y &&
    l[20].y < l[18].y
  );
}

// Main logic
hands.onResults((results) => {

  if (!results.multiHandLandmarks) {
    prevX = prevY = null;
    lastX = lastY = null;
    return;
  }

  const l = results.multiHandLandmarks[0];

  // Index finger tip only
  let x = (1 - l[8].x) * canvas.width;
  let y = l[8].y * canvas.height;

  // Smooth movement
  if (lastX !== null) {
    x = lastX * smoothFactor + x * (1 - smoothFactor);
    y = lastY * smoothFactor + y * (1 - smoothFactor);
  }

  lastX = x;
  lastY = y;

  // ✋ Erase
  if (isOpenPalm(l)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prevX = prevY = null;
    return;
  }

  // ✏️ Draw only when index finger alone
  if (isIndexOnly(l)) {

    if (prevX !== null && prevY !== null) {

      // Distance check (avoid jumps)
      const dx = x - prevX;
      const dy = y - prevY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 80) {
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);

        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        ctx.lineCap = "round";

        ctx.shadowColor = color;
        ctx.shadowBlur = 12;

        ctx.stroke();
      }
    }

    prevX = x;
    prevY = y;

  } else {
    prevX = prevY = null;
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
