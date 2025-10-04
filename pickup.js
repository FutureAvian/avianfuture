/*
 * SoliTone - 53 Card Pickup Game
 * Copyright (c) 2024 Clint Higgins
 * 
 * Original game design and implementation by Clint Higgins.
 */

// 53 Card Pickup Game Logic

// --- State ---
let gameStarted = false;
let cardPickupCards = [];
let musicStepIdx = 0;
let delayEnabled = false;
let sustainEnabled = false;
let delayNode = null;
let feedbackNode = null;
let sustainGains = [];
let randomDurations = false;
let durationPattern = [];
let restsEnabled = false;
let restPattern = [];
let lastNoteIdx = null;
let waveform = 'sine'; // Add missing waveform variable
let swingEnabledPickup = false; // Add missing swing variable

// --- DOM Elements ---
const bpmSlider = document.getElementById('bpm-slider');
const bpmValue = document.getElementById('bpm-value');
const fundamentalSlider = document.getElementById('fundamental-slider');
const fundamentalInput = document.getElementById('fundamental-input');
const listenBtn = document.getElementById('listen-btn');
const musicToggle = document.getElementById('music-toggle');
const musicStartBtn = document.getElementById('music-start-btn');
const musicStopBtn = document.getElementById('music-stop-btn');
const waveformBtn = document.getElementById('waveform-btn');
const startMenu = document.getElementById('start-menu');
const playBtn = document.getElementById('play-btn');
const backBtn = document.getElementById('back-btn');
const resetBtn = document.getElementById('reset-btn');
const gameContainer = document.getElementById('game-container');
const backToSolitaire = document.getElementById('back-to-solitaire');

// Waveform buttons
const waveBtns = document.querySelectorAll('.wave-btn');

// --- Game Setup ---
function create53CardPickup() {
  cardPickupCards = [];
  let idx = 0;
  for (let suit of CARD_SUITS) {
    for (let value of CARD_VALUES) {
      cardPickupCards.push({
        suit, value,
        faceUp: Math.random() > 0.5,
        x: Math.random() * 800 + 50,
        y: Math.random() * 200 + 20,
        rotation: 0,
        zIndex: idx++
      });
    }
  }
  cardPickupCards.push({
    suit: 'joker', value: 0,
    faceUp: Math.random() > 0.5,
    x: Math.random() * 800 + 50,
    y: Math.random() * 200 + 20,
    rotation: 0,
    zIndex: idx
  });
  highestZIndex = idx;
}

function render53CardPickup() {
  // This function is now replaced by animateCardDrop
  // Keep for compatibility with updatePickupButtons
  let pickupArea = document.getElementById('pickup-area');
  pickupArea.innerHTML = '';
  
  cardPickupCards.forEach((card, idx) => {
    let cardEl = createCardElement(card, idx);
    pickupArea.appendChild(cardEl);
  });
  
  setupCardEvents();
}

// --- Event Handlers ---
function handlePickupCardClick(e) {
  if (e.defaultPrevented) return;
  let idx = parseInt(e.target.getAttribute('data-idx'));
  let card = cardPickupCards[idx];
  
  // Single-click: flip card
  card.faceUp = !card.faceUp;
  
  if (musicEnabled) {
    if (card.suit !== 'joker') {
      let noteIdx = cardToEDONote(card.suit, card.value);
      playEDONoteWithEffects(noteIdx);
    } else {
      playEDONoteWithEffects(52);
    }
  }
  
  render53CardPickup();
}

function handlePickupDragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.getAttribute('data-idx'));
  e.target.style.cursor = 'grabbing';
  
  // If dragging from stack, flip face up
  let idx = parseInt(e.target.getAttribute('data-idx'));
  let card = cardPickupCards[idx];
  if (Math.abs(card.x - 450) < 10 && Math.abs(card.y - 130) < 10 && !card.faceUp) {
    card.faceUp = true;
    render53CardPickup();
  }
}

function handlePickupDragOver(e) {
  e.preventDefault();
}

let highestZIndex = 53;

function handlePickupDrop(e) {
  e.preventDefault();
  let idx = parseInt(e.dataTransfer.getData('text/plain'));
  let card = cardPickupCards[idx];
  let rect = e.currentTarget.getBoundingClientRect();
  card.x = e.clientX - rect.left - 30;
  card.y = e.clientY - rect.top - 45;
  
  // Set as topmost card
  highestZIndex++;
  card.zIndex = highestZIndex;
  
  render53CardPickup();
}

function stackCards() {
  // Gather all cards and stack them face down
  cardPickupCards.forEach((card, idx) => {
    card.x = 450;
    card.y = 130;
    card.faceUp = false;
    card.zIndex = idx;
  });
  highestZIndex = cardPickupCards.length;
  render53CardPickup();
}

// --- Music Logic ---
let musicLoopInterval = null;
let musicLoopTimeout = null;

function start53PickupMusic() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicEnabled = true;
  lastNoteIdx = null;
  
  // Clear any existing loop
  if (musicLoopTimeout) clearTimeout(musicLoopTimeout);
  if (musicLoopInterval) clearInterval(musicLoopInterval);
  
  function playNextCard() {
    if (!gameStarted || !musicLoopInterval) return;
    
    let triggeringCards = cardPickupCards.filter(card => {
      return musicMode === 'faceup' ? card.faceUp : !card.faceUp;
    });
    
    if (triggeringCards.length === 0) {
      musicLoopTimeout = setTimeout(playNextCard, 60000 / bpm / 2);
      return;
    }
    
    let sortedCards = [...triggeringCards].sort((a, b) => {
      if (Math.abs(a.y - b.y) < 50) return a.x - b.x;
      return a.y - b.y;
    });
    
    let cardIdx = musicStepIdx % sortedCards.length;
    let card = sortedCards[cardIdx];
    
    let originalCardIdx = cardPickupCards.indexOf(card);
    let cardEl = document.querySelector(`[data-idx="${originalCardIdx}"]`);
    if (cardEl) {
      cardEl.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.8)';
      setTimeout(() => {
        if (cardEl) cardEl.style.boxShadow = '';
      }, 150);
    }
    
    let isRest = restsEnabled && restPattern.length > 0 && restPattern[cardIdx];
    
    if (!isRest && musicEnabled) {
      let noteIdx;
      if (card.suit !== 'joker') {
        noteIdx = cardToEDONote(card.suit, card.value);
      } else {
        noteIdx = 52;
      }
      
      // Check if this note is adjacent to the previous note
      let isAdjacent = lastNoteIdx !== null && Math.abs(noteIdx - lastNoteIdx) === 1;
      
      if (isAdjacent) {
        // Play both notes sustained for 1 second with 0.5 second fade out
        playEDONoteWithEffects(lastNoteIdx, 1.5);
        playEDONoteWithEffects(noteIdx, 1.5);
      } else {
        playEDONoteWithEffects(noteIdx);
      }
      
      lastNoteIdx = noteIdx;
    }
    
    musicStepIdx++;
    
    let interval;
    if (randomDurations && durationPattern.length > 0) {
      let durationIdx = musicStepIdx % durationPattern.length;
      interval = 60000 / bpm / durationPattern[durationIdx];
    } else {
      interval = 60000 / bpm / 2;
    }
    musicLoopTimeout = setTimeout(playNextCard, interval);
  }
  
  playNextCard();
}

// --- Audio Effects ---
function setupDelayEffect() {
  if (!audioCtx) return;
  
  if (delayEnabled && !delayNode) {
    delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.3;
    feedbackNode = audioCtx.createGain();
    feedbackNode.gain.value = 0.4;
    
    delayNode.connect(feedbackNode);
    feedbackNode.connect(delayNode);
    delayNode.connect(audioCtx.destination);
  } else if (!delayEnabled && delayNode) {
    try {
      delayNode.disconnect();
      feedbackNode.disconnect();
    } catch(e) {}
    delayNode = null;
    feedbackNode = null;
  }
}

function playEDONoteWithEffects(idx, duration = 0.15) {
  if (!audioCtx) return;
  let freq = edoFreq(idx);
  let normalizedIdx = idx % 53;
  let isAccented = MAJOR_INTERVALS.includes(normalizedIdx);
  
  let osc = audioCtx.createOscillator();
  osc.type = waveform;
  osc.frequency.value = freq;
  let gain = audioCtx.createGain();
  let baseGain = waveform === 'sine' ? 0.2 : 0.15;
  gain.gain.value = isAccented ? baseGain * 1.2 : baseGain;
  
  osc.connect(gain);
  
  // Connect to delay if enabled
  if (delayEnabled && delayNode) {
    gain.connect(delayNode);
  }
  
  gain.connect(audioCtx.destination);
  
  let startTime = audioCtx.currentTime;
  osc.start(startTime);
  
  if (sustainEnabled) {
    sustainGains.push({osc, gain});
    setTimeout(() => {
      let index = sustainGains.findIndex(item => item.osc === osc);
      if (index !== -1) {
        try {
          osc.stop();
        } catch(e) {}
        sustainGains.splice(index, 1);
      }
    }, 2000);
  } else {
    let stopTime = startTime + (isAccented ? duration * 1.05 : duration);
    osc.stop(stopTime);
  }
}

function stopAllSustainedNotes() {
  sustainGains.forEach(item => {
    try {
      // Fade out volume over 1.5 seconds
      item.gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
      
      // Increase delay feedback as volume decreases
      if (delayEnabled && feedbackNode) {
        feedbackNode.gain.exponentialRampToValueAtTime(0.8, audioCtx.currentTime + 1.5);
      }
      
      setTimeout(() => {
        try {
          item.osc.stop();
          // Reset feedback to normal level
          if (feedbackNode) {
            feedbackNode.gain.value = 0.4;
          }
        } catch(e) {}
      }, 1600);
    } catch (e) {}
  });
  sustainGains = [];
}

let isPushing = false;
let pushStartX = 0;
let pushStartY = 0;

function handleAreaMouseDown(e) {
  if (e.target.classList.contains('pickup-card')) return;
  e.target.style.cursor = 'grabbing';
}

function handleAreaMouseMove(e) {
  // No card pushing functionality
}

function handleAreaMouseUp(e) {
  e.target.style.cursor = 'grab';
}

function updatePickupButtons() {
  render53CardPickup();
}

function generateRandomDurations() {
  const durations = [0.5, 1, 2, 4, 8, 16];
  durationPattern = [];
  for (let i = 0; i < 53; i++) {
    durationPattern.push(durations[Math.floor(Math.random() * durations.length)]);
  }
}

function generateRestPattern() {
  let triggeringCards = cardPickupCards.filter(card => {
    return musicMode === 'faceup' ? card.faceUp : !card.faceUp;
  });
  let maxRests = Math.floor(triggeringCards.length * 0.2);
  restPattern = new Array(triggeringCards.length).fill(false);
  
  for (let i = 0; i < maxRests; i++) {
    let pos = Math.floor(Math.random() * triggeringCards.length);
    restPattern[pos] = true;
  }
}

// --- Waveform Selector ---
waveBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove selected class from all buttons
    waveBtns.forEach(b => b.classList.remove('selected'));
    // Add selected class to clicked button
    btn.classList.add('selected');
    // Set waveform based on button data
    waveform = btn.getAttribute('data-wave');
  });
});

// Initialize first waveform as selected
if (waveBtns.length > 0) {
  waveBtns[0].classList.add('selected');
}

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
  musicStepIdx = 0;
});

musicStartBtn.addEventListener('click', () => {
  if (!musicLoopInterval) {
    start53PickupMusic();
    musicStartBtn.textContent = '▶️ Playing';
    musicStartBtn.style.background = '#4CAF50';
    musicStopBtn.style.background = '#f44336';
  }
});

musicStopBtn.addEventListener('click', () => {
  if (musicLoopInterval) {
    clearInterval(musicLoopInterval);
    musicLoopInterval = null;
    musicStartBtn.textContent = '▶️ Start Loop';
    musicStartBtn.style.background = '#2196F3';
    musicStopBtn.style.background = '#666';
  }
});

musicToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
});

playBtn.addEventListener('click', () => {
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  document.getElementById('hud').style.display = 'flex';
  gameStarted = true;
  updateBackground();
  
  // Initialize audio context on user interaction to bypass autoplay restrictions
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // Resume audio context if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  // Show empty background first
  gameContainer.innerHTML = '<div id="pickup-area" style="position: relative; width: 900px; height: 300px; margin: 0 auto;"></div>';
  
  // Create cards and drop them in after 1.5 seconds
  setTimeout(() => {
    create53CardPickup();
    animateCardDrop();
    setTimeout(() => start53PickupMusic(), 500);
  }, 1500);
});

// Expose function to start game automatically (for auto-start feature)
window.startPickupGame = function() {
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  gameStarted = true;
  updateBackground();

  // Initialize audio context on user interaction to bypass autoplay restrictions
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Resume audio context if suspended
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Show empty background first
  gameContainer.innerHTML = '<div id="pickup-area" style="position: relative; width: 900px; height: 300px; margin: 0 auto;"></div>';

  // Create cards and drop them in after 1.5 seconds
  setTimeout(() => {
    create53CardPickup();
    animateCardDrop();
    setTimeout(() => start53PickupMusic(), 500);
  }, 1500);
};

backToSolitaire.addEventListener('click', () => {
  window.location.href = 'index.html';
});

resetBtn.addEventListener('click', () => {
  musicStepIdx = 0;
  delayEnabled = false;
  sustainEnabled = false;
  randomDurations = false;
  restsEnabled = false;
  durationPattern = [];
  restPattern = [];
  sustainGains = [];
  swingEnabledPickup = false;
  
  // Clear music loop
  if (musicLoopTimeout) clearTimeout(musicLoopTimeout);
  if (musicLoopInterval) clearInterval(musicLoopInterval);
  musicLoopInterval = null;
  
  // Reset controls to defaults
  bpm = BPM_DEFAULT;
  fundamental = FUNDAMENTAL_DEFAULT;
  waveform = 'sine';
  musicMode = 'faceup';
  bpmSlider.value = BPM_DEFAULT;
  bpmValue.value = BPM_DEFAULT;
  fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
  fundamentalInput.value = FUNDAMENTAL_DEFAULT;
  listenBtn.textContent = 'Fronts';
  
  // Reset waveform buttons
  waveBtns.forEach(b => b.classList.remove('selected'));
  if (waveBtns.length > 0) {
    waveBtns[0].classList.add('selected');
  }
  
  // Reset music control buttons
  musicStartBtn.textContent = '▶️ Start Loop';
  musicStartBtn.style.background = '#2196F3';
  musicStopBtn.style.background = '#666';
  
  // Shuffle cards to new positions
  create53CardPickup();
  render53CardPickup();
  updateBackground();
});

document.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  
  if (e.code === 'Space') {
    e.preventDefault();
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
  }
  
  if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    let sustainBtn = document.getElementById('sustain-toggle');
    if (sustainBtn && !sustainEnabled) {
      sustainEnabled = true;
      sustainBtn.style.background = '#ff00cc';
      sustainBtn.textContent = 'Sustain ⇧';
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (!gameStarted) return;
  
  if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    let sustainBtn = document.getElementById('sustain-toggle');
    if (sustainBtn && sustainEnabled) {
      sustainEnabled = false;
      sustainBtn.style.background = '#ff0080';
      sustainBtn.textContent = 'Sustain ⇧';
      stopAllSustainedNotes();
    }
  }
});

function animateCardDrop() {
  let pickupArea = document.getElementById('pickup-area');
  let batches = [];
  
  // Group cards into batches of 5-7
  for (let i = 0; i < cardPickupCards.length; i += Math.floor(Math.random() * 3) + 5) {
    batches.push(cardPickupCards.slice(i, i + Math.floor(Math.random() * 3) + 5));
  }
  
  batches.forEach((batch, batchIndex) => {
    setTimeout(() => {
      batch.forEach((card, cardIndex) => {
        let cardEl = createCardElement(card, cardPickupCards.indexOf(card));
        cardEl.style.transform = `translateY(-400px) rotate(${card.rotation}deg)`;
        cardEl.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        pickupArea.appendChild(cardEl);
        
        setTimeout(() => {
          cardEl.style.transform = `translateY(0px) rotate(${card.rotation}deg)`;
        }, cardIndex * 50);
      });
    }, batchIndex * 300);
  });
  
  // Add control buttons after all cards have dropped
  setTimeout(() => {
    addControlButtons();
  }, batches.length * 300 + 1000);
}

function createCardElement(card, idx) {
  if (card.suit === 'joker') {
    if (card.faceUp) {
      let cardEl = document.createElement('div');
      cardEl.className = 'pickup-card joker-card';
      cardEl.setAttribute('data-idx', idx);
      cardEl.draggable = true;
      cardEl.style.position = 'absolute';
      cardEl.style.left = card.x + 'px';
      cardEl.style.top = card.y + 'px';
      cardEl.style.width = '60px';
      cardEl.style.height = '90px';
      cardEl.style.cursor = 'grab';
      cardEl.style.zIndex = card.zIndex || idx;
      cardEl.style.background = 'white';
      cardEl.style.border = '2px solid black';
      cardEl.style.borderRadius = '6px';
      cardEl.style.display = 'flex';
      cardEl.style.flexDirection = 'column';
      cardEl.style.justifyContent = 'center';
      cardEl.style.alignItems = 'center';
      cardEl.innerHTML = `
        <div style="position: absolute; top: 2px; left: 2px; font-size: 8px; color: red;">♥</div>
        <div style="position: absolute; top: 2px; right: 2px; font-size: 8px; color: black;">♠</div>
        <div style="font-size: 10px; font-weight: bold; color: black;">JOKER</div>
        <div style="position: absolute; bottom: 2px; left: 2px; font-size: 8px; color: red;">♦</div>
        <div style="position: absolute; bottom: 2px; right: 2px; font-size: 8px; color: black;">♣</div>
      `;
      return cardEl;
    } else {
      let cardEl = document.createElement('img');
      cardEl.src = `${CARD_IMAGES_PATH}reverse.png`;
      cardEl.className = 'pickup-card';
      cardEl.setAttribute('data-idx', idx);
      cardEl.draggable = true;
      cardEl.style.position = 'absolute';
      cardEl.style.left = card.x + 'px';
      cardEl.style.top = card.y + 'px';
      cardEl.style.width = '60px';
      cardEl.style.height = '90px';
      cardEl.style.cursor = 'grab';
      cardEl.style.zIndex = card.zIndex || idx;
      return cardEl;
    }
  } else {
    let cardEl = document.createElement('img');
    cardEl.src = card.faceUp ? `${CARD_IMAGES_PATH}${card.suit}${card.value}.png` : `${CARD_IMAGES_PATH}reverse.png`;
    cardEl.className = 'pickup-card';
    cardEl.setAttribute('data-idx', idx);
    cardEl.draggable = true;
    cardEl.style.position = 'absolute';
    cardEl.style.left = card.x + 'px';
    cardEl.style.top = card.y + 'px';
    cardEl.style.width = '60px';
    cardEl.style.height = '90px';
    cardEl.style.cursor = 'grab';
    cardEl.style.zIndex = card.zIndex || idx;
    return cardEl;
  }
}

function addControlButtons() {
  let pickupArea = document.getElementById('pickup-area');
  let controlsHtml = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-top: 20px; max-width: 800px; margin-left: auto; margin-right: auto;">
      <!-- Column 1: Face controls -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="all-face-up" style="background: #0080ff; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">All Face Up</button>
        <button id="all-face-down" style="background: #ff6600; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">All Face Down</button>
      </div>
      
      <!-- Column 2: Stack and Swing -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="stack-cards-btn" style="background: #4040ff; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">Stack Cards</button>
        <button id="swing-btn-pickup" style="background: #cccc00; color: #000; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">Swing: Off</button>
      </div>
      
      <!-- Column 3: Delay and Sustain -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="delay-toggle" style="background: #9900cc; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">Delay: Off</button>
        <button id="sustain-toggle" style="background: #ff0080; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; user-select: none; height: 40px; transition: background 0.2s; font-size: 12px;">Sustain ⇧</button>
      </div>
      
      <!-- Column 4: Duration and Rest -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="random-durations" style="background: #00cc66; color: #fff; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 11px;">Random Durations</button>
        <button id="rest-toggle" style="background: #ffcc00; color: #000; border: none; padding: 12px 8px; border-radius: 4px; cursor: pointer; height: 40px; transition: background 0.2s; font-size: 12px;">Random Rests</button>
      </div>
    </div>
  `;
  pickupArea.insertAdjacentHTML('afterend', controlsHtml);
  
  // Add event listeners
  setupControlButtons();
  setupCardEvents();
}

function setupCardEvents() {
  document.querySelectorAll('.pickup-card').forEach(cardEl => {
    cardEl.addEventListener('click', handlePickupCardClick);
    cardEl.addEventListener('dragstart', handlePickupDragStart);
  });
  
  let pickupArea = document.getElementById('pickup-area');
  pickupArea.addEventListener('dragover', handlePickupDragOver);
  pickupArea.addEventListener('drop', handlePickupDrop);
  pickupArea.addEventListener('mousedown', handleAreaMouseDown);
  pickupArea.addEventListener('mousemove', handleAreaMouseMove);
  pickupArea.addEventListener('mouseup', handleAreaMouseUp);
}

function setupControlButtons() {
  document.getElementById('all-face-up').addEventListener('click', (e) => {
    cardPickupCards.forEach(card => card.faceUp = true);
    updatePickupButtons();
    e.target.style.background = '#00a0ff';
    setTimeout(() => e.target.style.background = '#0080ff', 150);
  });
  
  document.getElementById('all-face-down').addEventListener('click', (e) => {
    cardPickupCards.forEach(card => card.faceUp = false);
    updatePickupButtons();
    e.target.style.background = '#ff8800';
    setTimeout(() => e.target.style.background = '#ff6600', 150);
  });
  
  document.getElementById('stack-cards-btn').addEventListener('click', (e) => {
    stackCards();
    e.target.style.background = '#6060ff';
    setTimeout(() => e.target.style.background = '#4040ff', 150);
  });
  
  document.getElementById('delay-toggle').addEventListener('click', (e) => {
    delayEnabled = !delayEnabled;
    e.target.textContent = `Delay: ${delayEnabled ? 'On' : 'Off'}`;
    e.target.style.background = delayEnabled ? '#cc00ff' : '#9900cc';
    setupDelayEffect();
  });
  
  document.getElementById('swing-btn-pickup').addEventListener('click', (e) => {
    swingEnabledPickup = !swingEnabledPickup;
    e.target.textContent = `Swing: ${swingEnabledPickup ? 'On' : 'Off'}`;
    e.target.style.background = swingEnabledPickup ? '#ffff00' : '#cccc00';
    e.target.style.color = swingEnabledPickup ? '#000' : '#000';
  });
  
  document.getElementById('random-durations').addEventListener('click', (e) => {
    randomDurations = !randomDurations;
    if (randomDurations) {
      generateRandomDurations();
      e.target.textContent = 'Back to 8th Notes';
      e.target.style.background = '#ff3366';
    } else {
      durationPattern = [];
      e.target.textContent = 'Random Durations';
      e.target.style.background = '#00cc66';
    }
  });
  
  document.getElementById('rest-toggle').addEventListener('click', (e) => {
    restsEnabled = !restsEnabled;
    if (restsEnabled) {
      generateRestPattern();
      e.target.textContent = 'Unrest';
      e.target.style.background = '#ff9900';
      e.target.style.color = '#fff';
    } else {
      restPattern = [];
      e.target.textContent = 'Random Rests';
      e.target.style.background = '#ffcc00';
      e.target.style.color = '#000';
    }
  });
  
  let sustainBtn = document.getElementById('sustain-toggle');
  sustainBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sustainEnabled = true;
    sustainBtn.style.background = '#ff00cc';
    sustainBtn.textContent = 'Sustaining ⇧';
  });
  sustainBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    sustainEnabled = false;
    sustainBtn.style.background = '#ff0080';
    sustainBtn.textContent = 'Sustain ⇧';
    stopAllSustainedNotes();
  });
  sustainBtn.addEventListener('mouseleave', (e) => {
    if (sustainEnabled) {
      sustainEnabled = false;
      sustainBtn.style.background = '#ff0080';
      sustainBtn.textContent = 'Sustain ⇧';
      stopAllSustainedNotes();
    }
  });
  sustainBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sustainEnabled = true;
    sustainBtn.style.background = '#ff00cc';
    sustainBtn.textContent = 'Sustaining ⇧';
  });
  sustainBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    sustainEnabled = false;
    sustainBtn.style.background = '#ff0080';
    sustainBtn.textContent = 'Sustain ⇧';
    stopAllSustainedNotes();
  });
}

function addHolographicEffect(element) {
  // Set initial styling
  element.style.color = '#fff';
  element.style.fontWeight = 'bold';
  element.style.lineHeight = '0.8';
  element.style.textShadow = '3px 3px 0px #000, 6px 6px 0px #222, 9px 9px 0px #444, 12px 12px 0px #666, 15px 15px 0px #888';
  
  const colors = ['#ff0080', '#0080ff', '#00ff80', '#ff8000', '#8000ff', '#ffff00'];
  
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

// Add holographic effect to start menu title
window.addEventListener('load', () => {
  let startTitle = document.getElementById('start-title');
  if (startTitle) {
    addHolographicEffect(startTitle);
  }
});

// --- Initialize ---
fundamental = FUNDAMENTAL_DEFAULT;
fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
fundamentalInput.value = FUNDAMENTAL_DEFAULT;
bpm = BPM_DEFAULT;
bpmSlider.value = BPM_DEFAULT;
bpmValue.value = BPM_DEFAULT;

// --- Auto-start if coming from SoliTone ---
window.addEventListener('load', () => {
  if (window.location.search.includes('autostart=true') || document.referrer.includes('index.html')) {
    // Auto-start the game
    setTimeout(() => {
      playBtn.click();
    }, 500);
  }
});