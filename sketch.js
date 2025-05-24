let handPose;
let video;
let hands = [];
let options = { flipped: true };

let items = [];
let bombs = [];
let paddleRightX;
let paddleWidth = 100; // 接盤寬度改為100
let paddleHeight = 20;
let score = 0;

let emojis = ['📱', '💻', '🖥️', '⌨️', '🖱️'];
let badEmojis = ['🤡', '👽', '👾', '💀', '😈', '👻', '👹']; // 壞的 emoji 新增👻👹

let life = 3;
let heartTrace = [];
let maxTraceLength = 100;
let heartCooldown = 0;
let minSpacing = 50;

// 新增：左手食指斜線軌跡
let leftSlashTrace = [];
let maxLeftSlashTraceLength = 20;

function preload() {
  handPose = ml5.handPose(options);
}

function setup() {
  createCanvas(640, 480);
  textAlign(CENTER, CENTER);
  textSize(32);
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();
  handPose.detectStart(video, gotHands);

  setInterval(() => {
    addNewItem(badEmojis, -5, 5);
  }, 2000); // 2.5秒產生一次壞emoji

  setInterval(() => {
    addNewItem(emojis, 10, 3);
  }, 2000);

  setInterval(() => {
    let x = getNonOverlappingX(items.concat(bombs));
    bombs.push({
      x: x,
      y: 0,
      symbol: '💣',
      speed: 12 // 炸彈掉落速度加快
    });
  }, 2500);
}

function draw() {
  background(0);
  image(video, 0, 0, width, height);

  // 顯示生命值
  fill(255);
  textSize(24);
  textAlign(RIGHT, TOP);
  let lifeDisplay = '❤️'.repeat(life);
  text(lifeDisplay, width - 10, 10);

  // 右手控制 paddle
  paddleRightX = width / 2;
  let leftIndex = null;

  for (let hand of hands) {
    let type = hand.handedness?.toLowerCase();
    let index = hand.keypoints[8];
    if (index && index.x !== undefined) {
      if (type === 'right') {
        paddleRightX = index.x;
      } else if (type === 'left') {
        leftIndex = index;
      }
    }
  }

  // 左手食指軌跡記錄與斜線判斷
  if (leftIndex) {
    leftSlashTrace.push({ x: leftIndex.x, y: leftIndex.y });
    if (leftSlashTrace.length > maxLeftSlashTraceLength) {
      leftSlashTrace.shift();
    }
    if (isSlashGesture(leftSlashTrace)) {
      removeNearestBadEmoji();
      leftSlashTrace = [];
    }
  } else {
    leftSlashTrace = [];
  }

  // 畫 paddle
  fill(0, 200, 255);
  rectMode(CENTER);
  rect(paddleRightX, height - 30, paddleWidth, paddleHeight);

  // 掉落 emoji 處理
  for (let i = items.length - 1; i >= 0; i--) {
    let it = items[i];
    it.y += it.speed;
    text(it.symbol, it.x, it.y);

    let hit = (
      it.y >= height - 30 - paddleHeight / 2 &&
      it.y <= height - 30 + paddleHeight / 2 &&
      it.x > paddleRightX - paddleWidth / 2 &&
      it.x < paddleRightX + paddleWidth / 2
    );

    if (hit) {
      score += it.score;
      items.splice(i, 1);
    } else if (it.y > height + 30) {
      items.splice(i, 1);
    }
  }

  // 處理炸彈
  for (let i = bombs.length - 1; i >= 0; i--) {
    let b = bombs[i];
    b.y += b.speed;
    text(b.symbol, b.x, b.y);

    let hit = (
      b.y >= height - 30 - paddleHeight / 2 &&
      b.y <= height - 30 + paddleHeight / 2 &&
      b.x > paddleRightX - paddleWidth / 2 &&
      b.x < paddleRightX + paddleWidth / 2
    );

    if (hit) {
      life--;
      bombs.splice(i, 1);
    } else if (b.y > height + 30) {
      bombs.splice(i, 1);
    }
  }

  // 遊戲結束（生命歸零或分數<0）
  if (life <= 0 || score < 0) {
    fill(255, 0, 0);
    textSize(48);
    textAlign(CENTER, CENTER);
    text("GAME OVER", width / 2, height / 2);
    fill(255);
    textSize(32);
    text("Score: " + score, width / 2, height / 2 + 60);
    noLoop();
    return;
  }

  // 左手畫愛心軌跡
  if (leftIndex) {
    heartTrace.push({ x: leftIndex.x, y: leftIndex.y });
    if (heartTrace.length > maxTraceLength) {
      heartTrace.shift();
    }

    noFill();
    stroke(255, 100, 200);
    strokeWeight(6);
    beginShape();
    for (let pt of heartTrace) {
      vertex(pt.x, pt.y);
    }
    endShape();
    strokeWeight(1);

    if (isHeartShape(heartTrace) && heartCooldown <= 0) {
      life = min(life + 1, 3);
      heartCooldown = 60; // 停留 1 秒
    }
  }

  // 心形 cooldown
  if (heartCooldown > 0) {
    heartCooldown--;
    if (heartCooldown === 0) {
      heartTrace = [];
    }
  }

  // 顯示分數
  fill(255);
  textSize(24);
  textAlign(LEFT, TOP);
  text("Score: " + score, 10, 10);
}

function gotHands(results) {
  hands = results;
}

function addNewItem(emojiList, score, speed) {
  let x = getNonOverlappingX(items.concat(bombs));
  let symbol = random(emojiList);
  items.push({
    x: x,
    y: 0,
    symbol: symbol,
    speed: speed,
    score: score
  });
}

function getNonOverlappingX(existing) {
  let attempts = 0;
  while (attempts < 100) {
    let x = random(30, width - 30);
    let tooClose = existing.some(it => abs(it.x - x) < minSpacing);
    if (!tooClose) return x;
    attempts++;
  }
  return random(30, width - 30); // fallback
}

function isHeartShape(trace) {
  if (trace.length < 30) return false;
  let top = trace[0].y;
  let bottom = trace[0].y;
  for (let pt of trace) {
    top = min(top, pt.y);
    bottom = max(bottom, pt.y);
  }
  return (bottom - top > 50);
}

// 斜線手勢偵測（左上到右下或右上到左下）
function isSlashGesture(trace) {
  if (trace.length < 6) return false;
  let start = trace[0];
  let end = trace[trace.length - 1];
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  // 斜率大於0.5且移動距離夠大（左上到右下或右上到左下）
  return (dx > 30 && dy > 30 && abs(dx/dy) > 0.5) ||
         (dx < -30 && dy > 30 && abs(dx/dy) > 0.5);
}

// 消除離接盤最近的壞emoji
function removeNearestBadEmoji() {
  let minDist = Infinity;
  let idx = -1;
  for (let i = 0; i < items.length; i++) {
    if (badEmojis.includes(items[i].symbol)) {
      let d = dist(items[i].x, items[i].y, paddleRightX, height - 30);
      if (d < minDist) {
        minDist = d;
        idx = i;
      }
    }
  }
  if (idx !== -1) items.splice(idx, 1);
}
