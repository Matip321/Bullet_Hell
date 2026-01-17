const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Referencje do elementów DOM interfejsu
const ui = {
  score: document.getElementById('score'),
  hp: document.getElementById('hp'),
  menu: document.getElementById('menu-overlay'),
  startSection: document.getElementById('start-section'),
  gameOverSection: document.getElementById('game-over-section'),
  finalScore: document.getElementById('final-score'),
  inputName: document.getElementById('player-name'),
  startBtn: document.getElementById('start-btn'),
  saveBtn: document.getElementById('save-score-btn'),
  restartBtn: document.getElementById('restart-btn'),
  list: document.getElementById('high-scores-list')
};

// Ładowanie zasobów graficznych
const playerImg = new Image();
playerImg.src = 'Grafika/BLUE_SPACECRAFT1.png';

const enemyImg = new Image();
enemyImg.src = 'Grafika/RED_SPACECRAFT1.png';

// Zmienne stanu gry
let gameActive = false;
let score = 0;
let frames = 0;
let animationReq;

const player = { x: 0, y: 0, hp: 5, radius: 20, speed: 5, isInvulnerable: false, lastHit: 0 };
let bullets = [];
let enemies = [];
let particles = [];
const keys = {};

// Dostosowanie rozmiaru Canvas do okna przeglądarki (responsywność)
function resize() {
  if (window.innerWidth > 850) {
    canvas.width = 800;
    canvas.height = 600;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}
window.addEventListener('resize', resize);
resize();

// Ograniczenie pozycji gracza do obszaru gry
function clampPlayerPosition() {
  if (player.x < player.radius) player.x = player.radius;
  if (player.x > canvas.width - player.radius) player.x = canvas.width - player.radius;
  if (player.y < player.radius) player.y = player.radius;
  if (player.y > canvas.height - player.radius) player.y = canvas.height - player.radius;
}

// Obsługa wejścia (klawiatura i mysz/dotyk)
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

function handleInput(clientX, clientY) {
  if (!gameActive) return;

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  player.x = x;
  player.y = y - 50; // Przesunięcie dla lepszej widoczności palcem
  clampPlayerPosition();
}

canvas.addEventListener('mousemove', e => handleInput(e.clientX, e.clientY));
canvas.addEventListener('touchmove', e => { e.preventDefault(); handleInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
canvas.addEventListener('touchstart', e => { e.preventDefault(); if(gameActive) handleInput(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });

// Inicjalizacja nowej gry
function initGame() {
  score = 0;
  frames = 0;
  player.hp = 5;
  player.x = canvas.width / 2;
  player.y = canvas.height - 100;
  player.isInvulnerable = false;

  bullets = [];
  enemies = [];
  particles = [];

  ui.score.innerText = '0';
  ui.hp.innerText = '5';

  gameActive = true;
  ui.menu.style.display = 'none';
  resize();
  animate();
}

// Zatrzymanie pętli gry i wyświetlenie ekranu końcowego
function stopGame() {
  gameActive = false;
  cancelAnimationFrame(animationReq);
  ui.menu.style.display = 'flex';
  ui.startSection.style.display = 'none';
  ui.gameOverSection.style.display = 'flex'; // Ustawienie flex dla poprawnego centrowania
  ui.finalScore.innerText = score;
  updateLeaderboard();
}

// Główna pętla renderująca (Game Loop)
function animate() {
  if (!gameActive) return;
  animationReq = requestAnimationFrame(animate);

  // Czyszczenie ekranu
  ctx.fillStyle = '#000011';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  frames++;

  // Obsługa ruchu klawiaturą
  if (keys['ArrowUp']) player.y -= player.speed;
  if (keys['ArrowDown']) player.y += player.speed;
  if (keys['ArrowLeft']) player.x -= player.speed;
  if (keys['ArrowRight']) player.x += player.speed;
  clampPlayerPosition();

  // Generowanie pocisków gracza
  if (frames % 12 === 0) {
    bullets.push({ x: player.x, y: player.y - 25, vx: 0, vy: -9, isEnemy: false });
  }

  // Rysowanie gracza i obsługa nieśmiertelności
  if (!player.isInvulnerable || frames % 5 === 0) {
    ctx.drawImage(playerImg, player.x - 24, player.y - 24, 48, 48);
  }
  if (player.isInvulnerable && frames - player.lastHit > 90) player.isInvulnerable = false;

  // Logika pocisków (aktualizacja pozycji i kolizje)
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.isEnemy ? 6 : 4, 0, Math.PI*2);
    ctx.fillStyle = b.isEnemy ? '#ff3333' : '#33ccff';
    ctx.fill();

    // Kolizja pocisku wroga z graczem
    if (b.isEnemy && !player.isInvulnerable) {
      let dist = Math.hypot(b.x - player.x, b.y - player.y);
      if (dist < 25) {
        player.hp--;
        ui.hp.innerText = player.hp;
        player.isInvulnerable = true;
        player.lastHit = frames;
        createExplosion(player.x, player.y, 'red');
        bullets.splice(i, 1);
        if (player.hp <= 0) stopGame();
        continue;
      }
    }
    // Usuwanie pocisków poza ekranem
    if (b.y < -50 || b.y > canvas.height + 50 || b.x < -50 || b.x > canvas.width + 50) bullets.splice(i, 1);
  }

  // Logika przeciwników (spawnowanie i strzelanie)
  if (frames % 60 === 0) {
    enemies.push({ x: Math.random() * (canvas.width - 50) + 25, y: -50, shootTimer: Math.random() * 100 });
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.y += 2; e.shootTimer++;
    ctx.drawImage(enemyImg, e.x - 24, e.y - 24, 48, 48);

    // Strzelanie przeciwnika
    if (e.shootTimer > 100) {
      let angle = Math.atan2(player.y - e.y, player.x - e.x);
      bullets.push({ x: e.x, y: e.y, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, isEnemy: true });
      e.shootTimer = 0;
    }

    // Sprawdzenie trafienia przeciwnika przez gracza
    for (let j = bullets.length - 1; j >= 0; j--) {
      let b = bullets[j];
      if (!b.isEnemy) {
        let dist = Math.hypot(b.x - e.x, b.y - e.y);
        if (dist < 30) {
          createExplosion(e.x, e.y, 'orange');
          score += 100;
          ui.score.innerText = score;
          enemies.splice(i, 1);
          bullets.splice(j, 1);
          break;
        }
      }
    }

    // Kolizja bezpośrednia (statek-statek)
    if (!player.isInvulnerable) {
      let distCrash = Math.hypot(player.x - e.x, player.y - e.y);
      if (distCrash < 40) {
        player.hp = 0; ui.hp.innerText = 0; createExplosion(player.x, player.y, 'red'); stopGame();
      }
    }
    if (e.y > canvas.height + 50) enemies.splice(i, 1);
  }

  // Obsługa cząsteczek wybuchów
  particles.forEach((p, i) => {
    p.x += p.vx; p.y += p.vy; p.life -= 0.04;
    ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1.0;
    if(p.life <= 0) particles.splice(i, 1);
  });
}

// Funkcja generująca efekty cząsteczkowe
function createExplosion(x, y, color) {
  for(let i=0; i<12; i++) {
    particles.push({ x: x, y: y, color: color, life: 1.0, vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12 });
  }
}

// Obsługa tablicy wyników (LocalStorage)
function updateLeaderboard() {
  let scores = JSON.parse(localStorage.getItem('scores') || '[]');

  ui.list.innerHTML = scores.map((s, i) =>
    `<li>
            <strong>${i+1}. ${s.name}</strong> : ${s.score} pkt
            <span class="score-date">${s.date || '---'}</span>
        </li>`
  ).join('');
}

ui.saveBtn.onclick = () => {
  let name = ui.inputName.value || "Anonim";
  let scores = JSON.parse(localStorage.getItem('scores') || '[]');
  const now = new Date();
  const dateString = now.toLocaleDateString('pl-PL') + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  scores.push({ name: name, score: score, date: dateString });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(5); // Zachowaj tylko 5 najlepszych wyników
  localStorage.setItem('scores', JSON.stringify(scores));
  updateLeaderboard();
  ui.saveBtn.disabled = true;
  ui.saveBtn.innerText = "Zapisano!";
};

ui.restartBtn.onclick = () => {
  ui.gameOverSection.style.display = 'none';
  ui.startSection.style.display = 'block';
  ui.saveBtn.disabled = false;
  ui.saveBtn.innerText = "Zapisz wynik";
  ui.inputName.value = "";
  initGame();
};

ui.startBtn.onclick = initGame;
updateLeaderboard();