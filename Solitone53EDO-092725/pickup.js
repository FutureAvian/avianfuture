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

// --- DOM Elements ---
const bpmSlider = document.getElementById('bpm-slider');
const bpmValue = document.getElementById('bpm-value');
const fundamentalSlider = document.getElementById('fundamental-slider');
const fundamentalInput = document.getElementById('fundamental-input');
const listenBtn = document.getElementById('listen-btn');
const musicToggle = document.getElementById('music-toggle');
const waveformBtn = document.getElementById('waveform-btn');
const startMenu = document.getElementById('start-menu');
const playBtn = document.getElementById('play-btn');
const backBtn = document.getElementById('back-btn');
const resetBtn = document.getElementById('reset-btn');
const gameContainer = document.getElementById('game-container');
const backToSolitaire = document.getElementById('back-to-solitaire');

// --- Game Setup ---
function create53CardPickup() {
  cardPickupCards = [];
  for (let suit of CARD_SUITS) {
    for (let value of CARD_VALUES) {
      cardPickupCards.push({
        suit, value,
        faceUp: Math.random() > 0.5,
        x: Math.random() * 800 + 50,
        y: Math.random() * 200 + 20,
        rotation: 0
      });
    }
  }
  cardPickupCards.push({
    suit: 'joker', value: 0,
    faceUp: Math.random() > 0.5,
    x: Math.random() * 800 + 50,
    y: Math.random() * 200 + 20,
    rotation: 0
  });
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
}

function handlePickupDragOver(e) {
  e.preventDefault();
}

function handlePickupDrop(e) {
  e.preventDefault();
  let idx = parseInt(e.dataTransfer.getData('text/plain'));
  let card = cardPickupCards[idx];
  let rect = e.currentTarget.getBoundingClientRect();
  card.x = e.clientX - rect.left - 30;
  card.y = e.clientY - rect.top - 45;
  render53CardPickup();
}

// --- Music Logic ---
function start53PickupMusic() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicEnabled = true;
  lastNoteIdx = null;
  
  function playNextCard() {
    if (!gameStarted) return;
    
    let triggeringCards = cardPickupCards.filter(card => {
      return musicMode === 'faceup' ? card.faceUp : !card.faceUp;
    });
    
    if (triggeringCards.length === 0) {
      setTimeout(playNextCard, 60000 / bpm / 2);
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
    setTimeout(playNextCard, interval);
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
  musicStepIdx = 0;
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

playBtn.addEventListener('click', () => {
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  gameStarted = true;
  updateBackground();
  
  // Show empty background first
  gameContainer.innerHTML = '<div id="pickup-area" style="position: relative; width: 900px; height: 300px; margin: 0 auto;"></div>';
  
  // Create cards and drop them in after 1.5 seconds
  setTimeout(() => {
    create53CardPickup();
    animateCardDrop();
    start53PickupMusic();
  }, 1500);
});

backBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

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
  
  // Shuffle cards to new positions
  create53CardPickup();
  render53CardPickup();
  updateBackground();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameStarted) {
    e.preventDefault();
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
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
      cardEl.style.zIndex = idx;
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
      cardEl.style.zIndex = idx;
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
    cardEl.style.zIndex = idx;
    return cardEl;
  }
}

function addControlButtons() {
  let pickupArea = document.getElementById('pickup-area');
  let controlsHtml = `
    <div style="text-align: center; margin-top: 10px;">
      <button id="all-face-up" style="background: #0080ff; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px;">All Face Up</button>
      <button id="all-face-down" style="background: #ff6600; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px;">All Face Down</button>
      <button id="delay-toggle" style="background: #9900cc; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px;">Delay: Off</button>
      <button id="sustain-toggle" style="background: #ff0080; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px; user-select: none;">Hold to Sustain</button>
      <button id="random-durations" style="background: #00cc66; color: #fff; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px;">Random Durations</button>
      <button id="rest-toggle" style="background: #ffcc00; color: #000; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 0 5px;">Random Rests</button>
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
  document.getElementById('all-face-up').addEventListener('click', () => {
    cardPickupCards.forEach(card => card.faceUp = true);
    updatePickupButtons();
  });
  
  document.getElementById('all-face-down').addEventListener('click', () => {
    cardPickupCards.forEach(card => card.faceUp = false);
    updatePickupButtons();
  });
  
  document.getElementById('delay-toggle').addEventListener('click', () => {
    delayEnabled = !delayEnabled;
    document.getElementById('delay-toggle').textContent = `Delay: ${delayEnabled ? 'On' : 'Off'}`;
    document.getElementById('delay-toggle').style.background = delayEnabled ? '#cc00ff' : '#9900cc';
    setupDelayEffect();
  });
  
  document.getElementById('random-durations').addEventListener('click', () => {
    randomDurations = !randomDurations;
    let btn = document.getElementById('random-durations');
    if (randomDurations) {
      generateRandomDurations();
      btn.textContent = 'Back to 8th Notes';
      btn.style.background = '#ff3366';
    } else {
      durationPattern = [];
      btn.textContent = 'Random Durations';
      btn.style.background = '#00cc66';
    }
  });
  
  document.getElementById('rest-toggle').addEventListener('click', () => {
    restsEnabled = !restsEnabled;
    let btn = document.getElementById('rest-toggle');
    if (restsEnabled) {
      generateRestPattern();
      btn.textContent = 'Unrest';
      btn.style.background = '#ff9900';
      btn.style.color = '#fff';
    } else {
      restPattern = [];
      btn.textContent = 'Random Rests';
      btn.style.background = '#ffcc00';
      btn.style.color = '#000';
    }
  });
  
  let sustainBtn = document.getElementById('sustain-toggle');
  sustainBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    sustainEnabled = true;
    sustainBtn.style.background = '#ff66cc';
    sustainBtn.textContent = 'Sustaining...';
  });
  sustainBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    sustainEnabled = false;
    sustainBtn.style.background = '#ff0080';
    sustainBtn.textContent = 'Hold to Sustain';
    stopAllSustainedNotes();
  });
  sustainBtn.addEventListener('mouseleave', (e) => {
    sustainEnabled = false;
    sustainBtn.style.background = '#ff0080';
    sustainBtn.textContent = 'Hold to Sustain';
    stopAllSustainedNotes();
  });
  sustainBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    sustainEnabled = true;
    sustainBtn.style.background = '#ff66cc';
    sustainBtn.textContent = 'Sustaining...';
  });
  sustainBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    sustainEnabled = false;
    sustainBtn.style.background = '#ff0080';
    sustainBtn.textContent = 'Hold to Sustain';
    stopAllSustainedNotes();
  });
}

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