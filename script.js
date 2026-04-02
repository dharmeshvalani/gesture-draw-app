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

// Resize canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Update controls
colorPicker.oninput = () => color = colorPicker.value;
brushSize.oninput = () => size = brushSize.value;

// Clear
clearBtn.onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

// Save Image
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

hands.setOptions({
  maxNumHands: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

// Gestures
function isOpenPalm(l) {
  return l[8].y < l[6].y &&
         l[12].y < l[10].y &&
         l[16].y < l[14].y &&
         l[20].y < l[18].y;
}

function isIndexUp(l) {
  return l[8].y < l[6].y;
}

// Draw
hands.onResults((res) => {
  if (!res.multiHandLandmarks) return;

  const l = res.multiHandLandmarks[0];

  const x = (1 - l[8].x) * canvas.width;
  const y = l[8].y * canvas.height;

  if (isOpenPalm(l)) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prevX = prevY = null;
    return;
  }

  if (isIndexUp(l)) {
    if (prevX && prevY) {
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);

      // Glow effect
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
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

// Camera
const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({ image: video });
  },
  width: 640,
  height: 480
});

camera.start();
