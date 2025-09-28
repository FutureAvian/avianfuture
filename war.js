/*
 * SoliTone - 53 War Game
 * Copyright (c) 2025 Clint Higgins
 * 
 * Original game design and implementation by Clint Higgins.
 */

// 53 War Game Logic

// --- State ---
let gameStarted = false;
let playerDeck = [];
let computerDeck = [];
let playerCard = null;
let computerCard = null;
let warPile = [];
let musicStepIdx = 0;
let lastNoteIdx = null;
let gameOver = false;
let battleInProgress = false;

// --- DOM Elements ---
const bpmSlider = document.getElementById('bpm-slider');
const bpmValue = document.getElementById('bpm-value');
const fundamentalSlider = document.getElementById('fundamental-slider');
const fundamentalInput = document.getElementById('fundamental-input');
const listenBtn = document.getElementById('listen-btn');
const musicToggle = document.getElementById('music-toggle');
const waveformBtn = document.getElementById('waveform-btn');
const swingBtn = document.getElementById('swing-btn');
const startMenu = document.getElementById('start-menu');
const playBtn = document.getElementById('play-btn');
const backBtn = document.getElementById('back-btn');
const resetBtn = document.getElementById('reset-btn');
const gameContainer = document.getElementById('game-container');
const backToSolitaire = document.getElementById('back-to-solitaire');

// --- Game Setup ---
function createWarGame() {
  let deck = [];
  for (let suit of CARD_SUITS) {
    for (let value of CARD_VALUES) {
      deck.push({suit, value, faceUp: false});
    }
  }
  deck = shuffle(deck);
  
  playerDeck = deck.slice(0, 26);
  computerDeck = deck.slice(26, 52);
  warPile = [];
  playerCard = null;
  computerCard = null;
  gameOver = false;
  battleInProgress = false;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderWarGame() {
  let html = `
    <div id="war-area" style="display: flex; justify-content: space-between; align-items: center; width: 800px; margin: 0 auto; padding: 40px;">
      <div id="player-area" style="text-align: center;">
        <h3 style="color: #fff; margin-bottom: 20px;">Player (${playerDeck.length} cards)</h3>
        <div id="player-card" style="width: 120px; height: 180px; border: 2px solid #fff; border-radius: 8px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          ${playerCard ? renderWarCard(playerCard) : '<span style="color: #ccc;">Ready</span>'}
        </div>
        <button id="battle-btn" ${battleInProgress ? 'disabled' : ''} style="background: #ff6600; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">Battle!</button>
      </div>
      
      <div id="battle-area" style="text-align: center;">
        <h3 style="color: #fff; margin-bottom: 20px;">War Pile (${warPile.length} cards)</h3>
        <div style="width: 120px; height: 180px; border: 2px dashed #888; border-radius: 8px; background: rgba(136,136,136,0.1); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
          <span style="color: #888;">Spoils</span>
        </div>
      </div>
      
      <div id="computer-area" style="text-align: center;">
        <h3 style="color: #fff; margin-bottom: 20px;">Computer (${computerDeck.length} cards)</h3>
        <div id="computer-card" style="width: 120px; height: 180px; border: 2px solid #fff; border-radius: 8px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
          ${computerCard ? renderWarCard(computerCard) : '<span style="color: #ccc;">Ready</span>'}
        </div>
      </div>
    </div>
  `;
  
  if (gameOver) {
    let winner = playerDeck.length > 0 ? 'Player' : 'Computer';
    html += `<div style="text-align: center; margin-top: 40px; font-size: 2em; color: #fff;">${winner} Wins!</div>`;
  }
  
  gameContainer.innerHTML = html;
  
  let battleBtn = document.getElementById('battle-btn');
  if (battleBtn && !gameOver) {
    battleBtn.addEventListener('click', playBattle);
  }
}

function renderWarCard(card) {
  if (!card) return '';
  let img = `${CARD_IMAGES_PATH}${card.suit}${card.value}.png`;
  return `<img src="${img}" style="width: 100px; height: 150px; border-radius: 4px;">`;
}

function playBattle() {
  if (battleInProgress || gameOver) return;
  if (playerDeck.length === 0 || computerDeck.length === 0) {
    endGame();
    return;
  }
  
  battleInProgress = true;
  
  // Draw cards
  playerCard = playerDeck.shift();
  computerCard = computerDeck.shift();
  
  // Play notes for the cards
  if (musicEnabled) {
    let playerNote = cardToEDONote(playerCard.suit, playerCard.value);
    let computerNote = cardToEDONote(computerCard.suit, computerCard.value);
    
    playEDONote(playerNote, 0.5);
    setTimeout(() => playEDONote(computerNote, 0.5), 200);
  }
  
  renderWarGame();
  
  setTimeout(() => {
    let playerValue = getCardValue(playerCard);
    let computerValue = getCardValue(computerCard);
    
    if (playerValue > computerValue) {
      // Player wins
      playerDeck.push(playerCard, computerCard);
      playerDeck = playerDeck.concat(warPile);
      warPile = [];
      if (musicEnabled) playEDONote(cardToEDONote(playerCard.suit, playerCard.value), 1.0);
    } else if (computerValue > playerValue) {
      // Computer wins
      computerDeck.push(playerCard, computerCard);
      computerDeck = computerDeck.concat(warPile);
      warPile = [];
      if (musicEnabled) playEDONote(cardToEDONote(computerCard.suit, computerCard.value), 1.0);
    } else {
      // War!
      warPile.push(playerCard, computerCard);
      if (musicEnabled) {
        // Play dissonant chord for war
        playEDONote(26, 0.8); // Tritone
        playEDONote(39, 0.8); // Another dissonant interval
      }
    }
    
    playerCard = null;
    computerCard = null;
    battleInProgress = false;
    
    if (playerDeck.length === 0 || computerDeck.length === 0) {
      endGame();
    } else {
      renderWarGame();
    }
  }, 1000);
}

function getCardValue(card) {
  return card.value === 1 ? 14 : card.value; // Ace high
}

function endGame() {
  gameOver = true;
  renderWarGame();
  
  if (musicEnabled) {
    // Play victory or defeat scale
    let isPlayerWin = playerDeck.length > 0;
    setTimeout(() => {
      if (isPlayerWin) {
        playVictoryScale();
      } else {
        playDefeatScale();
      }
    }, 500);
  }
}

function playVictoryScale() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let t = audioCtx.currentTime;
  let sixteenthNote = 60 / 120 / 4;
  
  // Play ascending major intervals
  let majorIntervals = [0, 17, 31, 44, 53];
  majorIntervals.forEach((interval, i) => {
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = edoFreq(interval);
    let gain = audioCtx.createGain();
    gain.gain.value = 0.3;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + i * sixteenthNote);
    osc.stop(t + (i + 1) * sixteenthNote);
  });
}

function playDefeatScale() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let t = audioCtx.currentTime;
  let sixteenthNote = 60 / 120 / 4;
  
  // Play descending dissonant intervals
  let dissonantIntervals = [52, 39, 26, 13, 0];
  dissonantIntervals.forEach((interval, i) => {
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = edoFreq(interval);
    let gain = audioCtx.createGain();
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t + i * sixteenthNote);
    osc.stop(t + (i + 1) * sixteenthNote);
  });
}

// --- Control Event Listeners ---
bpmSlider.addEventListener('input', e => {
  bpm = parseFloat(bpmSlider.value);
  bpmValue.value = bpm === 5.3 ? '5.3' : Math.round(bpm);
  updateBackground();
});

bpmValue.addEventListener('input', e => {
  let val = parseFloat(bpmValue.value);
  if (val >= BPM_MIN && val <= BPM_MAX) {
    bpm = val;
    bpmSlider.value = val;
    bpmValue.value = val === 5.3 ? '5.3' : Math.round(val);
    updateBackground();
  }
});

fundamentalSlider.addEventListener('input', e => {
  let rawFreq = parseInt(fundamentalSlider.value);
  fundamental = Math.round(snapToEDOFreq(rawFreq));
  fundamentalInput.value = fundamental;
  fundamentalSlider.value = fundamental;
  updateBackground();
});

fundamentalInput.addEventListener('input', e => {
  let val = parseInt(fundamentalInput.value);
  if (val >= 80 && val <= 1500) {
    fundamental = Math.round(snapToEDOFreq(val));
    fundamentalSlider.value = fundamental;
    fundamentalInput.value = fundamental;
    updateBackground();
  }
});

listenBtn.addEventListener('click', () => {
  musicMode = musicMode === 'faceup' ? 'facedown' : 'faceup';
  listenBtn.textContent = musicMode === 'faceup' ? 'Fronts' : 'Backs';
});

musicToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
});

const waveforms = ['sine', 'sawtooth', 'square', 'triangle'];
let waveformIndex = 0;
waveformBtn.addEventListener('click', () => {
  waveformIndex = (waveformIndex + 1) % waveforms.length;
  waveform = waveforms[waveformIndex];
  waveformBtn.textContent = waveform.charAt(0).toUpperCase() + waveform.slice(1);
});

swingBtn.addEventListener('click', () => {
  // Swing not implemented for War game
  swingBtn.textContent = 'Off';
});

playBtn.addEventListener('click', () => {
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  gameStarted = true;
  updateBackground();
  createWarGame();
  renderWarGame();
});

backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

backToSolitaire.addEventListener('click', () => {
  window.location.href = 'index.html';
});

resetBtn.addEventListener('click', () => {
  gameStarted = false;
  gameOver = false;
  battleInProgress = false;
  
  // Reset controls to defaults
  bpm = BPM_DEFAULT;
  fundamental = FUNDAMENTAL_DEFAULT;
  waveform = 'sine';
  musicMode = 'faceup';
  bpmSlider.value = BPM_DEFAULT;
  bpmValue.value = BPM_DEFAULT;
  fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
  fundamentalInput.value = FUNDAMENTAL_DEFAULT;
  waveformBtn.textContent = 'Sine';
  listenBtn.textContent = 'Fronts';
  waveformIndex = 0;
  
  createWarGame();
  renderWarGame();
  updateBackground();
});

// Add holographic effect to start menu title
window.addEventListener('load', () => {
  let startTitle = document.getElementById('start-title');
  if (startTitle) {
    addHolographicEffect(startTitle);
  }
});

function addHolographicEffect(element) {
  const colors = ['#ff0080', '#0080ff', '#00ff80', '#ff8000', '#8000ff', '#ffff00'];
  element.style.textShadow = '3px 3px 0px #000, 6px 6px 0px #222, 9px 9px 0px #444, 12px 12px 0px #666, 15px 15px 0px #888';
  element.style.color = '#fff';
  element.style.fontWeight = 'bold';
  
  let colorIndex = 0;
  setInterval(() => {
    let shadowColors = [];
    for (let i = 0; i < 5; i++) {
      shadowColors.push(colors[(colorIndex + i) % colors.length]);
    }
    element.style.textShadow = `3px 3px 0px ${shadowColors[0]}, 6px 6px 0px ${shadowColors[1]}, 9px 9px 0px ${shadowColors[2]}, 12px 12px 0px ${shadowColors[3]}, 15px 15px 0px ${shadowColors[4]}`;
    colorIndex = (colorIndex + 1) % colors.length;
  }, 200);
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameStarted) {
    e.preventDefault();
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
  }
});

// --- Initialize ---
fundamental = FUNDAMENTAL_DEFAULT;
fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
fundamentalInput.value = FUNDAMENTAL_DEFAULT;
bpm = BPM_DEFAULT;
bpmSlider.value = BPM_DEFAULT;
bpmValue.value = BPM_DEFAULT;