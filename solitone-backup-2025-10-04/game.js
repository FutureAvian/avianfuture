/*
 * SoliTone - Musical Solitaire Game
 * Copyright (c) 2024 Clint Higgins
 * 
 * Musical enhancements, visual effects, and game modifications
 * are original works by Clint Higgins.
 * 
 * Based on solitaire mechanics from:
 * https://github.com/HectorVilas/solitaire by Hector Vilas
 */

// Solitaire 53 EDO core logic and audio
// Basic Klondike rules, with music and silly quit/end screens

// --- Solitaire-specific State ---
let swingEnabled = false;
let swingPattern = [];
let swingPatternIdx = 0;
let gameState = null;
let musicInterval = null;
let musicTimeouts = [];
let morseTimeouts = [];
let isGameOver = false;
let musicStepIdx = 0;
let cachedTriggeringCards = [];
let gameStarted = false;
let lastNoteIdx = null;
let autoCompleteOffered = false;
let endOptionsShown = false;
let delayNode = null;
let feedbackNode = null;
let fundamentalHarmonyEnabled = false;
let autoSubdivisionEnabled = true;

// Wait for DOM to be ready before initializing elements
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing SoliTone...');

  // --- DOM Elements ---
  const bpmSlider = document.getElementById('bpm-slider');
  const bpmValue = document.getElementById('bpm-value');
  const swingBtn = document.getElementById('swing-btn');
  const fundamentalSlider = document.getElementById('fundamental-slider');
  const fundamentalInput = document.getElementById('fundamental-input');
  const listenBtn = document.getElementById('listen-btn');
  const musicToggle = document.getElementById('music-toggle');
  const waveformBtn = document.getElementById('waveform-btn');

  const startMenu = document.getElementById('start-menu');
  const playBtn = document.getElementById('play-btn');
  const quitBtn = document.getElementById('quit-btn');
  const resetBtn = document.getElementById('reset-btn');
  const gameContainer = document.getElementById('game-container');
  const endScreen = document.getElementById('end-screen');

  console.log('DOM elements found:', {
    startMenu: !!startMenu,
    playBtn: !!playBtn,
    gameContainer: !!gameContainer,
    hud: !!document.getElementById('hud')
  });

  // --- Start Menu ---
  if (playBtn && startMenu && gameContainer) {
    playBtn.addEventListener('click', () => {
      console.log('🎮 Start button clicked - initializing game...');

      // Hide title screen immediately
      startMenu.style.display = 'none';

      // Show game immediately with proper visibility
      gameContainer.style.display = 'block';
      gameContainer.style.opacity = '1';
      gameContainer.style.visibility = 'visible';

      const hud = document.getElementById('hud');
      if (hud) {
        hud.style.display = 'flex';
        hud.style.opacity = '1';
        hud.style.visibility = 'visible';
        console.log('✅ HUD shown');
      } else {
        console.error('❌ HUD element not found');
      }

      gameStarted = true;
      musicStepIdx = 0;
      lastNoteIdx = null;

      console.log('🎵 Initializing audio context...');
      // Initialize audio context on user interaction
      if (!audioCtx || audioCtx.state === 'closed') {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ Audio context created');
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
        console.log('✅ Audio context resumed');
      }

      console.log('🎲 Setting up game...');
      updateBackground();
      setupGame();

      // Force immediate render to ensure cards are visible
      setTimeout(() => {
        console.log('🔄 Forcing game render...');
        renderGameBoard();
      }, 100);

      console.log('🎼 Starting music in 1 second...');
      setTimeout(() => {
        startMusicLoop();
        console.log('✅ Music started - game is now playable!');
      }, 1000);
    });
  } else {
    console.error('❌ Start menu elements not found:', { playBtn, startMenu, gameContainer });
  }

// --- Rendering ---
function renderGameBoard() {
  let html = '<div id="board" style="display:flex;justify-content:center;gap:32px;align-items:flex-start;">';
  
  // Left side: Stock and Waste
  html += '<div style="display:flex;gap:16px;">';
  html += `<div class="pile-container"><div class="flash-indicator" id="stock-flash"></div><div class="pile stock" data-pile="stock">${renderCard(gameState.stock[gameState.stock.length-1], false, 'stock')}</div></div>`;
  html += `<div class="pile-container"><div class="flash-indicator" id="waste-flash"></div><div class="pile waste" data-pile="waste">${renderCard(gameState.waste[gameState.waste.length-1], true, 'waste')}</div></div>`;
  html += '</div>';
  
  // Center: Tableau
  html += '<div style="display:flex;gap:16px;">';
  for (let col=0; col<7; col++) {
    html += `<div class="pile tableau" data-pile="tableau${col}">`;
    if (gameState.tableau[col].length === 0) {
      html += `<div class="tableau-placeholder"></div>`;
    } else {
      for (let row=0; row<gameState.tableau[col].length; row++) {
        let card = gameState.tableau[col][row];
        html += renderCard(card, card.faceUp, `tableau${col}`, row);
      }
    }
    html += '</div>';
  }
  html += '</div>';
  
  // Right side: Foundations
  html += '<div style="display:flex;flex-direction:column;gap:16px;">';
  for (let i=0; i<4; i++) {
    html += `<div class="pile foundation" data-pile="foundation${i}">${renderCard(gameState.foundations[i][gameState.foundations[i].length-1], true, `foundation${i}`)}</div>`;
  }
  html += '</div>';
  
  html += '</div>';
  gameContainer.innerHTML = html;
  document.querySelectorAll('.card.faceup').forEach(cardEl => {
    cardEl.addEventListener('dragstart', handleDragStart);
  });
  document.querySelectorAll('.pile').forEach(pileEl => {
    pileEl.addEventListener('dragover', handleDragOver);
    pileEl.addEventListener('drop', handleDrop);
  });
  if (checkWin() && !isGameOver) {
    isGameOver = true;
    stopMusicLoop();
    // Trigger victory sequence immediately
    setTimeout(() => {
      endGame(true);
    }, 1000);
  }
  
  // Check for autocomplete offer
  let noFaceDownCards = true;
  for (let col = 0; col < 7; col++) {
    for (let card of gameState.tableau[col]) {
      if (!card.faceUp) {
        noFaceDownCards = false;
        break;
      }
    }
    if (!noFaceDownCards) break;
  }
  
  if (gameState.stock.length === 0 && gameState.waste.length === 0 && noFaceDownCards && !isGameOver && !autoCompleteOffered) {
    autoCompleteOffered = true;
    let stockPile = document.querySelector('.pile.stock');
    if (stockPile) {
      let autoBtn = document.createElement('button');
      autoBtn.textContent = 'Auto-complete';
      autoBtn.style.background = '#060';
      autoBtn.style.color = '#fff';
      autoBtn.style.border = 'none';
      autoBtn.style.padding = '8px 16px';
      autoBtn.style.fontSize = '12px';
      autoBtn.style.borderRadius = '4px';
      autoBtn.style.cursor = 'pointer';
      autoBtn.style.marginTop = '8px';
      autoBtn.onclick = () => {
        stockPile.removeChild(autoBtn);
        stockPile.removeChild(dismissBtn);
        autoComplete();
      };
      
      let dismissBtn = document.createElement('button');
      dismissBtn.textContent = '×';
      dismissBtn.style.background = '#c00';
      dismissBtn.style.color = '#fff';
      dismissBtn.style.border = 'none';
      dismissBtn.style.padding = '4px 8px';
      dismissBtn.style.fontSize = '12px';
      dismissBtn.style.borderRadius = '4px';
      dismissBtn.style.cursor = 'pointer';
      dismissBtn.style.marginLeft = '4px';
      dismissBtn.onclick = () => {
        stockPile.removeChild(autoBtn);
        stockPile.removeChild(dismissBtn);
      };
      
      stockPile.appendChild(autoBtn);
      stockPile.appendChild(dismissBtn);
    }
  }
}

function renderCard(card, showFace, pile, idx) {
  if (!card) return `<div class="card empty"></div>`;
  let img = showFace ? `${CARD_IMAGES_PATH}${card.suit}${card.value}.png` : `${CARD_IMAGES_PATH}reverse.png`;
  let classes = 'card' + (showFace ? ' faceup' : ' facedown');
  let data = `data-pile="${pile}" data-idx="${idx ?? ''}"`;
  let draggable = showFace && pile.startsWith('tableau') ? 'draggable="true"' : '';
  return `<img src="${img}" class="${classes}" ${data} ${draggable} style="width:60px;height:90px;margin-bottom:-70px;position:relative;z-index:${idx ?? 0};">`;
}
// --- Card Click Handler ---
let lastClickTime = 0;
let lastClickedCard = null;

function handleCardClick(e) {
  if (isGameOver) return;
  let el = e.target;
  
  // Check if clicking on stock pile (card or pile area)
  let pile = el.getAttribute('data-pile');
  if (!pile && el.classList.contains('pile')) {
    pile = el.getAttribute('data-pile');
  }
  if (!pile && el.parentElement && el.parentElement.classList.contains('pile')) {
    pile = el.parentElement.getAttribute('data-pile');
  }
  
  // Handle stock pile clicks
  if (pile === 'stock') {
    if (gameState.stock.length > 0) {
      let card = gameState.stock.pop();
      card.faceUp = true;
      gameState.waste.push(card);
      renderGameBoard();
      updateTriggeringCards();
    } else if (gameState.waste.length > 0) {
      // Reset stock pile with cards from waste in reverse order
      console.log('Resetting stock pile from waste');
      while (gameState.waste.length > 0) {
        let card = gameState.waste.pop(); // Take from end (top-most)
        card.faceUp = false;
        gameState.stock.push(card); // Add to end of stock
      }
      renderGameBoard();
      updateTriggeringCards();
    }
    return;
  }
  
  if (!el.classList.contains('card')) return;
  let idx = el.getAttribute('data-idx');
  
  // Handle double-click for foundation auto-move
  let currentTime = Date.now();
  let isDoubleClick = (currentTime - lastClickTime < 300) && (lastClickedCard === el);
  lastClickTime = currentTime;
  lastClickedCard = el;
  
  if (isDoubleClick && el.classList.contains('faceup')) {
    tryAutoMoveToFoundation(pile, idx);
  }
}

function tryAutoMoveToFoundation(fromPile, fromIdx) {
  let card = null;
  
  // Get the card to move
  if (fromPile.startsWith('tableau')) {
    let col = parseInt(fromPile.slice(7));
    let cardIdx = fromIdx ? parseInt(fromIdx) : gameState.tableau[col].length - 1;
    if (cardIdx !== gameState.tableau[col].length - 1) return; // Only top card
    card = gameState.tableau[col][cardIdx];
  } else if (fromPile === 'waste') {
    if (gameState.waste.length === 0) return;
    card = gameState.waste[gameState.waste.length - 1];
  } else {
    return;
  }
  
  // Find matching foundation
  for (let i = 0; i < 4; i++) {
    let foundation = gameState.foundations[i];
    if (foundation.length === 0 && card.value === 1) {
      // Move to empty foundation (Ace)
      if (tryMoveCard(fromPile, fromIdx, `foundation${i}`)) {
        renderGameBoard();
        updateTriggeringCards();
        return;
      }
    } else if (foundation.length > 0) {
      let topCard = foundation[foundation.length - 1];
      if (topCard.suit === card.suit && card.value === topCard.value + 1) {
        // Move to matching suit foundation
        if (tryMoveCard(fromPile, fromIdx, `foundation${i}`)) {
          renderGameBoard();
          updateTriggeringCards();
          return;
        }
      }
    }
  }
}

// --- Drag and Drop Handlers ---
function handleDragStart(e) {
  let el = e.target;
  let pile = el.getAttribute('data-pile');
  let idx = parseInt(el.getAttribute('data-idx'));
  e.dataTransfer.setData('text/plain', JSON.stringify({pile, idx}));
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  let targetPile = e.currentTarget.getAttribute('data-pile');
  let data = e.dataTransfer.getData('text/plain');
  if (!data) return;
  let {pile, idx} = JSON.parse(data);
  if (tryMoveCard(pile, idx, targetPile)) {
    renderGameBoard();
    updateTriggeringCards();
  }
}

// --- Klondike Move Logic ---
function tryMoveCard(fromPile, fromIdx, toPile) {
  let movingCards = [];
  if (fromPile.startsWith('tableau')) {
    let col = parseInt(fromPile.slice(7));
    movingCards = gameState.tableau[col].slice(fromIdx);
    if (!movingCards[0].faceUp) return false;
  } else if (fromPile === 'waste') {
    if (gameState.waste.length === 0) return false;
    movingCards = [gameState.waste[gameState.waste.length-1]];
  } else {
    return false;
  }
  if (toPile.startsWith('tableau')) {
    let toCol = parseInt(toPile.slice(7));
    let dest = gameState.tableau[toCol];
    if (dest.length === 0) {
      if (movingCards[0].value !== 13) return false;
    } else {
      let topCard = dest[dest.length-1];
      if (!topCard.faceUp) return false;
      if (!isValidTableauMove(topCard, movingCards[0])) return false;
    }
    if (fromPile.startsWith('tableau')) {
      let fromCol = parseInt(fromPile.slice(7));
      gameState.tableau[fromCol] = gameState.tableau[fromCol].slice(0, fromIdx);
      let last = gameState.tableau[fromCol][gameState.tableau[fromCol].length-1];
      if (last && !last.faceUp) last.faceUp = true;
    } else if (fromPile === 'waste') {
      gameState.waste.pop();
    }
    gameState.tableau[toCol] = gameState.tableau[toCol].concat(movingCards);
    return true;
  }
  if (toPile.startsWith('foundation')) {
    let fIdx = parseInt(toPile.slice(10));
    let pile = gameState.foundations[fIdx];
    let card = movingCards[0];
    if (pile.length === 0) {
      if (card.value !== 1) return false;
    } else {
      let topCard = pile[pile.length-1];
      if (topCard.suit !== card.suit) return false;
      if (card.value !== topCard.value + 1) return false;
    }
    if (fromPile.startsWith('tableau')) {
      let fromCol = parseInt(fromPile.slice(7));
      gameState.tableau[fromCol] = gameState.tableau[fromCol].slice(0, fromIdx);
      let last = gameState.tableau[fromCol][gameState.tableau[fromCol].length-1];
      if (last && !last.faceUp) last.faceUp = true;
    } else if (fromPile === 'waste') {
      gameState.waste.pop();
    }
    pile.push(card);
    return true;
  }
  return false;
}

function isValidTableauMove(top, moving) {
  let red = (suit) => suit === 'hearts' || suit === 'diamonds';
  return red(top.suit) !== red(moving.suit) && moving.value === top.value - 1;
}
// --- Music Logic ---
function startMusicLoop() {
  stopMusicLoop();
  if (!gameStarted) return;
  musicEnabled = true;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  cachedTriggeringCards = getTriggeringCards();
  lastNoteIdx = null;
  scheduleSwingNotes();
}

function scheduleSwingNotes() {
  if (!musicEnabled || cachedTriggeringCards.length === 0) return;
  
  if (swingEnabled) {
    generateSwingPattern();
  }
  
  function scheduleNext() {
    if (!musicEnabled || isGameOver) return;
    
    let interval = getIntervalMs();
    let shouldGlitch = false;
    
    if (swingEnabled && swingPattern[swingPatternIdx]) {
      interval *= swingPattern[swingPatternIdx];
      // Detect glitch patterns (very fast intervals)
      shouldGlitch = swingPattern[swingPatternIdx] <= 0.3;
    }
    swingPatternIdx = (swingPatternIdx + 1) % swingPattern.length;
    
    let timeout = setTimeout(() => {
      if (!musicEnabled) return;
      
      if (shouldGlitch) {
        playGlitchStep();
      } else {
        playMusicStep();
      }
      scheduleNext();
    }, interval);
    musicTimeouts.push(timeout);
  }
  
  playMusicStep();
  scheduleNext();
}

function generateSwingPattern() {
  let cardCount = cachedTriggeringCards.length;
  let swingCount = Math.floor(Math.random() * 5) + 2; // 2-6 swings per pass
  swingPattern = new Array(cardCount).fill(1.0);
  
  for (let i = 0; i < swingCount; i++) {
    let pos = Math.floor(Math.random() * cardCount);
    let swingType = Math.floor(Math.random() * 6); // Added 2 new glitch types
    
    switch (swingType) {
      case 0: // Pair grouping - slight delay
        swingPattern[pos] = 1.15;
        break;
      case 1: // Subdivision - quick rush
        swingPattern[pos] = 0.85;
        break;
      case 2: // Beat variation - moderate delay
        swingPattern[pos] = 1.25;
        break;
      case 3: // Triplet feel - subtle 2:1
        swingPattern[pos] = 1.3;
        if (pos + 1 < cardCount) swingPattern[pos + 1] = 0.7;
        break;
      case 4: // DJ Cut - rapid alternation
        swingPattern[pos] = 0.25; // Very fast
        if (pos + 1 < cardCount) swingPattern[pos + 1] = 0.25;
        if (pos + 2 < cardCount) swingPattern[pos + 2] = 0.25;
        if (pos + 3 < cardCount) swingPattern[pos + 3] = 0.25;
        break;
      case 5: // Stutter repeat - same note multiple times
        swingPattern[pos] = 0.3;
        if (pos + 1 < cardCount) swingPattern[pos + 1] = 0.3;
        if (pos + 2 < cardCount) swingPattern[pos + 2] = 0.8; // Pause after stutter
        break;
    }
  }
  swingPatternIdx = 0;
}

function stopMusicLoop() {
  if (musicInterval) clearInterval(musicInterval);
  musicInterval = null;
  // Clear all scheduled timeouts
  musicTimeouts.forEach(timeout => clearTimeout(timeout));
  musicTimeouts = [];
  musicEnabled = false;
}

function getIntervalMs() {
  let tempoCardCount = getTempoCardCount();
  let beatDiv = 4;
  if (tempoCardCount > 39) beatDiv = 32;
  else if (tempoCardCount > 26) beatDiv = 16;
  else if (tempoCardCount > 13) beatDiv = 8;
  
  // Gradual transition over 8 beats when crossing thresholds
  let transitionProgress = 0;
  if (tempoCardCount > 39 && tempoCardCount <= 47) {
    transitionProgress = (tempoCardCount - 39) / 8;
    beatDiv = 16 + (16 * transitionProgress); // 16 to 32
  } else if (tempoCardCount > 26 && tempoCardCount <= 34) {
    transitionProgress = (tempoCardCount - 26) / 8;
    beatDiv = 8 + (8 * transitionProgress); // 8 to 16
  } else if (tempoCardCount > 13 && tempoCardCount <= 21) {
    transitionProgress = (tempoCardCount - 13) / 8;
    beatDiv = 4 + (4 * transitionProgress); // 4 to 8
  }
  
  return 60000 / bpm / (beatDiv/4);
}

function getTriggeringCards() {
  let cards = [];
  if (!gameState) return cards;
  if (musicMode === 'faceup') {
    for (let col=0; col<7; col++) {
      for (let card of gameState.tableau[col]) {
        if (card.faceUp) cards.push(card);
      }
    }
    for (let pile of gameState.foundations) {
      for (let card of pile) {
        cards.push(card);
      }
    }
    // Only include topmost waste card
    if (gameState.waste.length > 0) {
      let topCard = gameState.waste[gameState.waste.length-1];
      if (topCard.faceUp) cards.push(topCard);
    }
  } else {
    for (let col=0; col<7; col++) {
      for (let card of gameState.tableau[col]) {
        if (!card.faceUp) cards.push(card);
      }
    }
    for (let card of gameState.stock) {
      if (!card.faceUp) cards.push(card);
    }
  }
  return cards;
}

function updateTriggeringCards() {
  cachedTriggeringCards = getTriggeringCards();
  updateNoteType();
}

function getTempoCardCount() {
  let tempoCardCount = 0;
  if (musicMode === 'faceup') {
    for (let col=0; col<7; col++) {
      for (let card of gameState.tableau[col]) {
        if (card.faceUp) tempoCardCount++;
      }
    }
    for (let pile of gameState.foundations) {
      if (pile.length && pile[pile.length-1].faceUp) tempoCardCount++;
    }
  } else {
    for (let col=0; col<7; col++) {
      for (let card of gameState.tableau[col]) {
        if (!card.faceUp) tempoCardCount++;
      }
    }
    tempoCardCount += gameState.stock.length;
  }
  return tempoCardCount;
}
function playMusicStep() {
  if (cachedTriggeringCards.length === 0) return;
  let card = cachedTriggeringCards[musicStepIdx % cachedTriggeringCards.length];
  let noteIdx = cardToEDONote(card.suit, card.value);
  
  // Highlight the playing card
  highlightPlayingCard(card);
  
  // Check if this note is adjacent to the previous note
  // Only allow adjacency for cards in same visibility state (both face up or both face down)
  let isAdjacent = false;
  if (lastNoteIdx !== null && Math.abs(noteIdx - lastNoteIdx) === 1) {
    let prevCard = cachedTriggeringCards[(musicStepIdx - 1) % cachedTriggeringCards.length];
    // Both cards must be in same listen mode and not from stock/waste
    if (prevCard && card.faceUp === prevCard.faceUp && 
        !isStockOrWasteCard(card) && !isStockOrWasteCard(prevCard)) {
      isAdjacent = true;
    }
  }
  
  let normalizedIdx = noteIdx % 53;
  let isAccented = MAJOR_INTERVALS.includes(normalizedIdx);
  
  // Show accent display
  showAccentDisplay(noteIdx, lastNoteIdx, isAdjacent, isAccented);
  
  if (isAdjacent) {
    let prevCard = cachedTriggeringCards[(musicStepIdx - 1) % cachedTriggeringCards.length];
    playEDONote(lastNoteIdx, 1.5, prevCard.suit);
    playEDONote(noteIdx, 1.5, card.suit);
  } else {
    playEDONote(noteIdx, 0.15, card.suit);
  }
  
  lastNoteIdx = noteIdx;
  musicStepIdx++;
}

function playGlitchStep() {
  if (cachedTriggeringCards.length === 0) return;
  
  let currentCard = cachedTriggeringCards[musicStepIdx % cachedTriggeringCards.length];
  let currentNoteIdx = cardToEDONote(currentCard.suit, currentCard.value);
  
  // Choose glitch type
  let glitchType = Math.random();
  
  if (glitchType < 0.5) {
    if (lastNoteIdx !== null) {
      let prevCard = cachedTriggeringCards[(musicStepIdx - 1) % cachedTriggeringCards.length];
      playEDONote(lastNoteIdx, 0.05, prevCard ? prevCard.suit : null);
      setTimeout(() => playEDONote(currentNoteIdx, 0.05, currentCard.suit), 25);
    } else {
      playEDONote(currentNoteIdx, 0.05, currentCard.suit);
    }
  } else {
    playEDONote(currentNoteIdx, 0.05, currentCard.suit);
  }
  
  // Highlight with glitch effect
  highlightPlayingCard(currentCard);
  
  lastNoteIdx = currentNoteIdx;
  musicStepIdx++;
}

function highlightPlayingCard(card) {
  // Special handling for stock cards - flash the visible stock card
  if (gameState.stock.includes(card)) {
    let stockCard = document.querySelector('.pile.stock .card');
    if (stockCard) {
      // Force reset then add class
      stockCard.classList.remove('playing');
      setTimeout(() => {
        stockCard.classList.add('playing');
        setTimeout(() => stockCard.classList.remove('playing'), 150);
      }, 1);
    }
    return;
  }
  
  // Individual card highlighting for other cards
  let cardElements = document.querySelectorAll('.card');
  cardElements.forEach(el => {
    let pile = el.getAttribute('data-pile');
    let idx = el.getAttribute('data-idx');
    
    if (isMatchingCard(el, card, pile, idx)) {
      // Force reset then add class
      el.classList.remove('playing');
      setTimeout(() => {
        el.classList.add('playing');
        setTimeout(() => el.classList.remove('playing'), 150);
      }, 1);
    }
  });
}

function isMatchingCard(element, card, pile, idx) {
  if (pile && pile.startsWith('tableau')) {
    let col = parseInt(pile.slice(7));
    let row = parseInt(idx);
    return gameState.tableau[col][row] === card;
  } else if (pile && pile.startsWith('foundation')) {
    let fIdx = parseInt(pile.slice(10));
    let foundation = gameState.foundations[fIdx];
    return foundation.length > 0 && foundation[foundation.length-1] === card;
  } else if (pile === 'waste') {
    return gameState.waste.includes(card);
  } else if (pile === 'stock') {
    return gameState.stock.includes(card);
  }
  return false;
}


// --- BPM Slider ---
bpmSlider.addEventListener('input', e => {
  let val = parseFloat(bpmSlider.value);
  bpm = val;
  bpmValue.value = val === 5.3 ? '5.3' : Math.round(val);
  updateBackground();
  if (musicEnabled && gameStarted) {
    startMusicLoop();
  }
});

bpmValue.addEventListener('input', e => {
  let val = parseFloat(bpmValue.value);
  if (!isNaN(val) && val >= 5.3 && val <= 530) {
    bpm = val;
    bpmSlider.value = val;
    updateBackground();
    if (musicEnabled && gameStarted) {
      startMusicLoop();
    }
  }
});

bpmValue.addEventListener('blur', e => {
  // Ensure valid value on blur
  let val = parseFloat(bpmValue.value);
  if (isNaN(val) || val < 5.3 || val > 530) {
    bpmValue.value = Math.round(bpm);
  }
});

// --- Swing Button ---
let swingTransitioning = false;
swingBtn.addEventListener('click', () => {
  if (swingTransitioning) return;
  
  if (swingEnabled) {
    // Turning off - smooth transition over 2 beats
    swingTransitioning = true;
    swingBtn.textContent = 'Fading...';
    let beatDuration = 60000 / bpm; // milliseconds per beat
    setTimeout(() => {
      swingEnabled = false;
      swingTransitioning = false;
      swingBtn.textContent = 'Swing Off';
      if (musicEnabled && gameStarted) {
        startMusicLoop();
      }
    }, beatDuration * 2);
  } else {
    // Turning on - immediate
    swingEnabled = true;
    swingBtn.textContent = 'Swing On';
    if (musicEnabled && gameStarted) {
      startMusicLoop();
    }
  }
});

// --- Fundamental Frequency ---
fundamentalSlider.addEventListener('input', e => {
  let rawFreq = parseInt(fundamentalSlider.value);
  fundamental = Math.round(snapToEDOFreq(rawFreq));
  fundamentalSlider.value = fundamental;
  updateFundamentalDisplay();
  updateBackground();
});

fundamentalInput.addEventListener('input', e => {
  if (freqMode === 'hz') {
    let val = parseInt(fundamentalInput.value);
    if (!isNaN(val) && val >= 80 && val <= 1500) {
      fundamental = val;
      fundamentalSlider.value = val;
      updateBackground();
    }
  }
});

fundamentalInput.addEventListener('blur', e => {
  if (freqMode === 'hz') {
    let val = parseInt(fundamentalInput.value);
    if (isNaN(val) || val < 80 || val > 1500) {
      fundamentalInput.value = fundamental;
    }
  }
});

// --- Listen To Button ---
listenBtn.addEventListener('click', () => {
  musicMode = musicMode === 'faceup' ? 'facedown' : 'faceup';
  listenBtn.textContent = musicMode === 'faceup' ? 'Fronts' : 'Backs';
  listenBtn.className = musicMode === 'facedown' ? 'backs' : '';
  updateTriggeringCards();
  if (musicEnabled && gameStarted) {
    startMusicLoop();
  }
});

// --- Quit Button ---
quitBtn.addEventListener('click', () => {
  if (isGameOver) return;
  showQuitDialog();
});

function showQuitDialog() {
  // Stop the game music loop completely
  stopMusicLoop();
  musicEnabled = false; // Ensure music is disabled

  gameContainer.style.opacity = 0;
  setTimeout(() => {
    endScreen.style.display = 'flex';
    endScreen.innerHTML = `
      <div style="font-size: 2em; margin-bottom: 40px;">Choose your fate:</div>
      <button id="quit-forever" style="background: #c00; color: #fff; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; font-size: 1.2em; margin: 10px;">Quit... Forever</button>
      <button id="go-back" style="background: #0066cc; color: #fff; border: none; padding: 16px 32px; border-radius: 8px; cursor: pointer; font-size: 1.2em; margin: 10px;">Go Back!</button>
    `;

    document.getElementById('quit-forever').onclick = () => quitForever();
    document.getElementById('go-back').onclick = () => {
      endScreen.style.display = 'none';
      gameContainer.style.opacity = 1;
      // Re-enable music for the game
      musicEnabled = true;
      startMusicLoop();
    };

  }, 500);
}



// --- Reset Button ---
resetBtn.addEventListener('click', () => {
  location.reload();
});
// --- End Game ---
function endGame(victory) {
  isGameOver = true;
  stopMusicLoop();
  gameContainer.style.opacity = 0;
  setTimeout(() => {
    endScreen.style.display = 'flex';
    endScreen.innerHTML = '';
    const messageDiv = document.createElement('div');
    messageDiv.style.fontSize = '3em';
    messageDiv.style.marginBottom = '40px';
    endScreen.appendChild(messageDiv);
    
    if (victory) {
      // Start victory scale
      playVictoryScale();
      messageDiv.textContent = 'WINNER';
      addHolographicEffect(messageDiv);
      
      // Create floating letters effect
      setTimeout(() => {
        createFloatingLetters();
      }, 2000);
    } else {
      const neonColors = ['#000', '#ff0080', '#0080ff', '#ff8000'];
      const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
      endScreen.style.backgroundColor = randomColor;
      setTimeout(() => startWindSounds(), 2000);
      playMorseCode('GAME OVER', messageDiv);
    }
    
    setTimeout(() => showEndOptions(), victory ? 12000 : 4000);
  }, 1000);
}

function fadeInText(text) {
  const div = document.createElement('div');
  div.style.opacity = '0';
  div.style.transition = 'opacity 1s';
  div.textContent = text;
  endScreen.innerHTML = '';
  endScreen.appendChild(div);
  setTimeout(() => {
    div.style.opacity = 1;
  }, 100);
}

function showEndOptions() {
  if (endOptionsShown) return;
  endOptionsShown = true;
  
  const br = document.createElement('br');
  const tryAgainBtn = document.createElement('button');
  tryAgainBtn.id = 'try-again';
  tryAgainBtn.textContent = 'Try Again?';
  tryAgainBtn.onclick = () => restartGame();
  
  const giveUpBtn = document.createElement('button');
  giveUpBtn.id = 'give-up';
  giveUpBtn.textContent = 'Give up... forever...';
  giveUpBtn.onclick = () => giveUpForever();
  
  const pickupBtn = document.createElement('button');
  pickupBtn.id = 'pickup-btn';
  pickupBtn.textContent = 'Play 53 Card Pickup';
  pickupBtn.onclick = () => window.location.href = 'pickup.html';
  
  endScreen.appendChild(br);
  endScreen.appendChild(tryAgainBtn);
  endScreen.appendChild(document.createTextNode(' '));
  endScreen.appendChild(pickupBtn);
  endScreen.appendChild(document.createTextNode(' '));
  endScreen.appendChild(giveUpBtn);
}

function restartGame() {
  // Clear all morse code timeouts
  morseTimeouts.forEach(timeout => clearTimeout(timeout));
  morseTimeouts = [];
  
  endScreen.style.display = 'none';
  gameContainer.style.opacity = 1;
  isGameOver = false;
  setupGame();
}

function quitForever() {
  endScreen.innerHTML = '';
  const neonColors = ['#000', '#ff0080', '#0080ff', '#ff8000'];
  const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
  endScreen.style.backgroundColor = randomColor;
  
  const messageDiv = document.createElement('div');
  messageDiv.style.fontSize = '3em';
  messageDiv.style.marginBottom = '40px';
  endScreen.appendChild(messageDiv);
  
  startWindSounds();
  playMorseCode('GAME OVER', messageDiv);
  
  const backBtn = document.createElement('button');
  backBtn.textContent = '(go back to load screen)';
  backBtn.style.position = 'absolute';
  backBtn.style.bottom = '20px';
  backBtn.style.left = '50%';
  backBtn.style.transform = 'translateX(-50%)';
  backBtn.style.background = 'transparent';
  backBtn.style.border = '1px solid #fff';
  backBtn.style.color = '#fff';
  backBtn.style.padding = '8px 16px';
  backBtn.style.fontSize = '12px';
  backBtn.style.cursor = 'pointer';
  backBtn.style.borderRadius = '4px';
  backBtn.onclick = () => {
    stopWindSounds();
    morseTimeouts.forEach(timeout => clearTimeout(timeout));
    morseTimeouts = [];
    endScreen.style.display = 'none';
    gameContainer.style.display = 'none';
    startMenu.style.display = 'flex';
    gameStarted = false;
    isGameOver = false;
  };
  endScreen.appendChild(backBtn);
}



function giveUpForever() {
  quitForever();
}
// --- Wind Sound Effects ---
let windTimeouts = [];

function startWindSounds() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  function playWindGust() {
    // Create white noise buffer
    let bufferSize = audioCtx.sampleRate * 8; // 8 seconds
    let buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    let data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1; // Quiet white noise
    }
    
    let source = audioCtx.createBufferSource();
    source.buffer = buffer;
    
    // Higher pitch for faster wind (6-7 second duration)
    if (duration >= 6 && duration <= 7) {
      source.playbackRate.value = 1.3;
    }
    
    // Create stereo panning and volume control
    let panner = audioCtx.createStereoPanner();
    let gain = audioCtx.createGain();
    
    source.connect(gain).connect(panner).connect(audioCtx.destination);
    
    let startTime = audioCtx.currentTime;
    let duration = 6 + Math.random() * 4; // 6-10 seconds
    
    // Fade in from left, pan to center, then fade out to right
    panner.pan.setValueAtTime(-1, startTime); // Start left
    panner.pan.linearRampToValueAtTime(0, startTime + duration/2); // Center at peak
    panner.pan.linearRampToValueAtTime(1, startTime + duration); // End right
    
    // Volume envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.05, startTime + duration/3);
    gain.gain.linearRampToValueAtTime(0.08, startTime + duration/2);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    
    source.start(startTime);
    source.stop(startTime + duration);
    
    // Schedule next wind gust with random delay
    let nextDelay = (Math.random() * 4 + 1) * 1000; // 1-5 seconds
    let timeout = setTimeout(playWindGust, nextDelay);
    windTimeouts.push(timeout);
  }
  
  // Start first wind gust after short delay
  let timeout = setTimeout(playWindGust, 1000);
  windTimeouts.push(timeout);
}

function stopWindSounds() {
  windTimeouts.forEach(timeout => clearTimeout(timeout));
  windTimeouts = [];
}



// --- Morse Code ---
function playMorseCode(text, displayElement) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let currentTime = 0;
  let displayText = '';
  
  for (let i = 0; i < text.length; i++) {
    let letter = text[i].toUpperCase();
    let morse = MORSE_LETTERS[letter];
    if (!morse) continue;
    
    let displayTimeout = setTimeout(() => {
      displayText += letter;
      if (displayElement) {
        displayElement.textContent = displayText;
        addHolographicEffect(displayElement);
      }
    }, currentTime * 1000);
    morseTimeouts.push(displayTimeout);
    
    for (let j = 0; j < morse.length; j++) {
      let duration = morse[j] === '.' ? 0.033 : 0.1;
      let morseTimeout = setTimeout(() => playEDOMorse(0, duration), currentTime * 1000);
      morseTimeouts.push(morseTimeout);
      currentTime += duration + 0.033;
    }
    currentTime += 0.1;
  }
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

function playVictoryScale() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let t = audioCtx.currentTime;
  let sixteenthNote = 60 / 120 / 4; // 120 BPM 16th notes
  let eighthNote = 60 / 120 / 2; // 120 BPM 8th notes
  
  // Major intervals to accent: 0, 17(maj3rd), 31(5th), 44(maj7th), 53(octave)
  let majorIntervals = [0, 17, 31, 44, 53];
  
  // Play full 53-EDO scale
  for (let i = 0; i <= 53; i++) {
    let isAccented = majorIntervals.includes(i);
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = edoFreq(i);
    let gain = audioCtx.createGain();
    gain.gain.value = isAccented ? 0.3 : 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + (isAccented ? sixteenthNote * 1.05 : sixteenthNote));
    t += sixteenthNote;
  }
  
  // Repeat octave notes (0 and 53) 15 times each as 8th notes
  for (let rep = 0; rep < 15; rep++) {
    // Note 0
    let osc1 = audioCtx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.value = edoFreq(0);
    let gain1 = audioCtx.createGain();
    gain1.gain.value = 0.3;
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(t);
    osc1.stop(t + eighthNote);
    t += eighthNote;
    
    // Note 53
    let osc53 = audioCtx.createOscillator();
    osc53.type = waveform;
    osc53.frequency.value = edoFreq(53);
    let gain53 = audioCtx.createGain();
    gain53.gain.value = 0.3;
    osc53.connect(gain53).connect(audioCtx.destination);
    osc53.start(t);
    osc53.stop(t + eighthNote);
    t += eighthNote;
  }
  
  // Play full 53-EDO scale again
  for (let i = 0; i <= 53; i++) {
    let isAccented = majorIntervals.includes(i);
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = edoFreq(i);
    let gain = audioCtx.createGain();
    gain.gain.value = isAccented ? 0.3 : 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + (isAccented ? sixteenthNote * 1.05 : sixteenthNote));
    t += sixteenthNote;
  }
  
  // Repeat octave notes (0 and 53) 5 times each as 8th notes
  for (let rep = 0; rep < 5; rep++) {
    // Note 0
    let osc1 = audioCtx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.value = edoFreq(0);
    let gain1 = audioCtx.createGain();
    gain1.gain.value = 0.3;
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(t);
    osc1.stop(t + eighthNote);
    t += eighthNote;
    
    // Note 53
    let osc53 = audioCtx.createOscillator();
    osc53.type = waveform;
    osc53.frequency.value = edoFreq(53);
    let gain53 = audioCtx.createGain();
    gain53.gain.value = 0.3;
    osc53.connect(gain53).connect(audioCtx.destination);
    osc53.start(t);
    osc53.stop(t + eighthNote);
    t += eighthNote;
  }
}

// --- Win Detection ---
function checkWin() {
  if (!gameState) return false;
  return gameState.foundations.every(pile => pile.length === 13);
}
// --- Initialize Controls ---
fundamental = FUNDAMENTAL_DEFAULT;
fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
fundamentalInput.value = FUNDAMENTAL_DEFAULT;
bpm = BPM_DEFAULT;
bpmSlider.value = BPM_DEFAULT;
bpmValue.value = BPM_DEFAULT;

// --- Spacebar Music Toggle ---
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameStarted) {
    e.preventDefault();
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
    musicToggle.className = musicEnabled ? 'on' : 'off';
    if (musicEnabled) {
      startMusicLoop();
    } else {
      stopMusicLoop();
    }
  }
});

// --- Start Menu ---
playBtn.addEventListener('click', () => {
  startMenu.style.display = 'none';
  gameContainer.style.display = 'block';
  document.getElementById('hud').style.display = 'flex';
  gameStarted = true;
  musicStepIdx = 0;
  lastNoteIdx = null;
  
  // Initialize audio context on user interaction
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  updateBackground();
  setupGame();
  setTimeout(() => startMusicLoop(), 1000);
});

// --- Music Toggle ---
musicToggle.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
  musicToggle.className = musicEnabled ? 'on' : 'off';
  if (musicEnabled && gameStarted) {
    startMusicLoop();
  } else {
    stopMusicLoop();
  }
});

// --- Suit Waveform Selectors ---
const waveforms = ['sine', 'triangle', 'sawtooth', 'square'];
const waveSymbols = ['~~~', '^v^v', '/|/|', '▢▢▢'];
let suitIndices = {hearts: 0, diamonds: 0, clubs: 1, spades: 1};

['hearts', 'diamonds', 'clubs', 'spades'].forEach(suit => {
  document.getElementById(`${suit}-wave`).addEventListener('click', () => {
    suitIndices[suit] = (suitIndices[suit] + 1) % waveforms.length;
    suitWaveforms[suit] = waveforms[suitIndices[suit]];
    document.getElementById(`${suit}-wave`).textContent = waveSymbols[suitIndices[suit]];
  });
});

// --- Tuning Dropdown ---
const tuningDescriptions = [
  'Alternating Steps: Hearts/clubs alternate even/odd steps, diamonds/spades fill upper range. Creates smooth microtonal intervals.',
  'Perfect Fifths: Hearts are roots, diamonds are fifths above, clubs fill middle, spades are sevenths/octave. Emphasizes harmonic relationships.',
  'Major Triads: Hearts are chord roots, diamonds are thirds, spades are fifths. Creates triadic harmonic structures.',
  'Chromatic Blocks: Each suit occupies consecutive chromatic steps. Provides clear timbral separation by register.'
];

document.getElementById('tuning-select').addEventListener('change', (e) => {
  currentTuning = parseInt(e.target.value);
  e.target.title = tuningDescriptions[currentTuning];
  updateTriggeringCards();
  if (musicEnabled && gameStarted) {
    startMusicLoop();
  }
});

// --- Fundamental Harmony Button ---
const fundamentalHarmonyBtn = document.getElementById('fundamental-harmony-btn');
if (fundamentalHarmonyBtn) {
  fundamentalHarmonyBtn.addEventListener('click', () => {
    fundamentalHarmonyEnabled = !fundamentalHarmonyEnabled;
    fundamentalHarmonyBtn.style.background = fundamentalHarmonyEnabled ? '#080' : '#888';
    fundamentalHarmonyBtn.style.borderColor = fundamentalHarmonyEnabled ? '#0f0' : '#666';
  });
}

// --- Hz/Notes Mode Toggle ---
let freqMode = 'hz'; // 'hz' or 'notes'
const freqModeBtn = document.getElementById('freq-mode-btn');
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

if (freqModeBtn) {
  freqModeBtn.addEventListener('click', () => {
    freqMode = freqMode === 'hz' ? 'notes' : 'hz';
    freqModeBtn.textContent = freqMode === 'hz' ? 'Hz' : '♪';
    updateFundamentalDisplay();
  });
}

function updateFundamentalDisplay() {
  if (freqMode === 'notes') {
    let noteNum = Math.round(12 * Math.log2(fundamental / 440)) + 69; // A4 = 440Hz = note 69
    let octave = Math.floor(noteNum / 12) - 1;
    let note = noteNames[noteNum % 12];
    fundamentalInput.value = `${note}${octave}`;
    fundamentalInput.style.width = '40px';
  } else {
    fundamentalInput.value = fundamental;
    fundamentalInput.style.width = '60px';
  }
}

// --- Note Type Toggle ---
const noteTypeEl = document.getElementById('note-type');
if (noteTypeEl) {
  noteTypeEl.addEventListener('click', () => {
    autoSubdivisionEnabled = !autoSubdivisionEnabled;
    if (autoSubdivisionEnabled) {
      noteTypeEl.style.color = '#fff';
      noteTypeEl.style.textShadow = '1px 1px 2px #000';
      updateNoteType();
    } else {
      noteTypeEl.style.color = '#ff0000';
      noteTypeEl.style.textShadow = '1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff';
      noteTypeEl.textContent = '♩ 1/4';
    }
  });
}

// --- Delay Toggle ---
const delayToggle = document.getElementById('delay-toggle');
if (delayToggle) {
  delayToggle.addEventListener('click', () => {
    delayEnabled = !delayEnabled;
    delayToggle.style.background = delayEnabled ? '#cc00ff' : '#9900cc';
    delayToggle.textContent = delayEnabled ? 'Delay On' : 'Delay';
    setupDelayEffect();
  });
}

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
    // Fade out delay over 1.5 seconds
    if (feedbackNode) {
      feedbackNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    }
    setTimeout(() => {
      try {
        if (delayNode) delayNode.disconnect();
        if (feedbackNode) feedbackNode.disconnect();
      } catch (e) {}
      delayNode = null;
      feedbackNode = null;
    }, 1600);
  }
}

function autoComplete() {
  // Move all tableau cards to foundations automatically
  let moved = true;
  while (moved) {
    moved = false;
    for (let col = 0; col < 7; col++) {
      if (gameState.tableau[col].length > 0) {
        let card = gameState.tableau[col][gameState.tableau[col].length - 1];
        if (card.faceUp) {
          for (let f = 0; f < 4; f++) {
            let foundation = gameState.foundations[f];
            if ((foundation.length === 0 && card.value === 1) ||
                (foundation.length > 0 && foundation[foundation.length-1].suit === card.suit && card.value === foundation[foundation.length-1].value + 1)) {
              gameState.tableau[col].pop();
              foundation.push(card);
              if (gameState.tableau[col].length > 0) {
                gameState.tableau[col][gameState.tableau[col].length-1].faceUp = true;
              }
              moved = true;
              break;
            }
          }
        }
        if (moved) break;
      }
    }
  }
  renderGameBoard();
  updateTriggeringCards();

  // Check for win after autocomplete
  if (checkWin()) {
    setTimeout(() => endGame(true), 1000); // Trigger victory sequence
  }
}

function updateNoteType() {
  let noteTypeEl = document.getElementById('note-type');
  if (!noteTypeEl || !autoSubdivisionEnabled) return;
  
  let cardCount = getTempoCardCount();
  let noteType;
  
  if (cardCount > 39) noteType = '♫ 1/32';
  else if (cardCount > 26) noteType = '♪ 1/16';
  else if (cardCount > 13) noteType = '♪ 1/8';
  else noteType = '♩ 1/4';
  
  noteTypeEl.textContent = noteType;
}

// Accent display queue system
let accentDisplayQueue = [];
const MAX_ACCENT_LINES = 4;

function showAccentDisplay(noteIdx, lastNoteIdx, isAdjacent, isAccented) {
  let accentEl = document.getElementById('accent-display');
  if (!accentEl) return;
  
  let text = '';
  
  if (isAdjacent) {
    text = `Adjacent: ${lastNoteIdx}-${noteIdx}`;
  } else if (isAccented) {
    let normalizedIdx = noteIdx % 53;
    if (normalizedIdx === 0) text = 'Unison';
    else if (normalizedIdx === 17) text = 'Major 3rd';
    else if (normalizedIdx === 31) text = 'Perfect 5th';
    else if (normalizedIdx === 44) text = 'Major 7th';
    else if (normalizedIdx === 53) text = 'Octave';
  }
  
  if (text) {
    // Add new text to queue
    let lineEl = document.createElement('div');
    lineEl.textContent = text;
    lineEl.style.opacity = '1';
    lineEl.style.transition = 'opacity 0.3s';
    lineEl.style.marginBottom = '4px';
    
    accentDisplayQueue.push({element: lineEl, timestamp: Date.now()});
    accentEl.appendChild(lineEl);
    
    // If more than MAX_ACCENT_LINES, fade out oldest
    if (accentDisplayQueue.length > MAX_ACCENT_LINES) {
      let oldest = accentDisplayQueue.shift();
      oldest.element.style.opacity = '0';
      setTimeout(() => {
        if (oldest.element.parentNode) {
          oldest.element.parentNode.removeChild(oldest.element);
        }
      }, 300);
    }
    
    // Auto-fade after 1 second
    setTimeout(() => {
      lineEl.style.opacity = '0';
      setTimeout(() => {
        if (lineEl.parentNode) {
          lineEl.parentNode.removeChild(lineEl);
        }
        // Remove from queue
        let idx = accentDisplayQueue.findIndex(item => item.element === lineEl);
        if (idx !== -1) accentDisplayQueue.splice(idx, 1);
      }, 300);
    }, 1000);
  }
}

function isStockOrWasteCard(card) {
  return gameState.stock.includes(card) || gameState.waste.includes(card);
}

function createFloatingLetters() {
  const letters = ['W', 'I', 'N', 'N', 'E', 'R'];
  
  letters.forEach((letter, i) => {
    setTimeout(() => {
      let letterEl = document.createElement('div');
      letterEl.textContent = letter;
      letterEl.style.position = 'absolute';
      letterEl.style.fontSize = '4em';
      letterEl.style.color = '#fff';
      letterEl.style.fontWeight = 'bold';
      letterEl.style.textShadow = '3px 3px 0px #000, 6px 6px 0px #222, 9px 9px 0px #444';
      letterEl.style.left = '50%';
      letterEl.style.top = '50%';
      letterEl.style.transform = 'translate(-50%, -50%)';
      letterEl.style.zIndex = '999';
      letterEl.style.transition = 'all 3s ease-out';
      letterEl.style.pointerEvents = 'none';
      
      endScreen.appendChild(letterEl);
      
      setTimeout(() => {
        let angle = (i * 60) + Math.random() * 60 - 30;
        let distance = 300 + Math.random() * 200;
        let x = Math.cos(angle * Math.PI / 180) * distance;
        let y = Math.sin(angle * Math.PI / 180) * distance;
        
        letterEl.style.transform = `translate(${x}px, ${y}px) scale(0.1)`;
        letterEl.style.opacity = '0';
        
        setTimeout(() => {
          if (letterEl.parentNode) {
            letterEl.parentNode.removeChild(letterEl);
          }
        }, 3000);
      }, 100);
    }, i * 200);
  });
}

// Don't auto-start game
});