/*
 * SoliTone - 53 Go Fish Game
 * Copyright (c) 2024 Clint Higgins
 * 
 * Original game design and implementation by Clint Higgins.
 */

// --- Game State ---
let gameStarted = false;
let players = []; // Array of player objects
let deck = [];
let currentPlayerIndex = 0;
let gameOver = false;
let musicStepIdx = 0;
let lastNoteIdx = null;
let humanPlayerCount = 1;
let computerPlayerCount = 2;
let askingValue = null;
let askingPlayerIndex = null;

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
const endScreen = document.getElementById('end-screen');

// --- Game Setup ---
function createDeck() {
  deck = [];
  for (let suit of CARD_SUITS) {
    for (let value of CARD_VALUES) {
      deck.push({suit, value});
    }
  }
  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function setupPlayers() {
  players = [];
  
  // Add human players
  for (let i = 0; i < humanPlayerCount; i++) {
    let name = document.getElementById(`player-${i}-name`)?.value || `Player ${i + 1}`;
    players.push({
      name: name,
      isHuman: true,
      hand: [],
      books: [],
      id: i
    });
  }
  
  // Add computer players
  for (let i = 0; i < computerPlayerCount; i++) {
    players.push({
      name: `Computer ${i + 1}`,
      isHuman: false,
      hand: [],
      books: [],
      id: humanPlayerCount + i
    });
  }
}

function dealCards() {
  let cardsPerPlayer = Math.min(7, Math.floor(52 / players.length));
  
  // Deal cards to each player
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let player of players) {
      if (deck.length > 0) {
        player.hand.push(deck.pop());
      }
    }
  }
  
  // Check for initial books
  players.forEach(player => {
    checkForBooks(player);
  });
}

function checkForBooks(player) {
  let valueCounts = {};
  player.hand.forEach(card => {
    valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
  });
  
  for (let value in valueCounts) {
    if (valueCounts[value] === 4) {
      // Remove all 4 cards of this value from hand
      let bookCards = player.hand.filter(card => card.value == value);
      player.hand = player.hand.filter(card => card.value != value);
      player.books.push(bookCards);
      
      // Play book completion sound
      if (musicEnabled) {
        playBookSound(parseInt(value));
      }
    }
  }
}

// Go Fish specific card-to-note mapping
// Each card value gets 4 adjacent steps for the 4 suits
function goFishCardToEDONote(suit, value) {
  let baseNote = (value - 1) * 4; // Values 1-13 map to base notes 0,4,8,12...48
  let suitOffset = CARD_SUITS.indexOf(suit); // 0,1,2,3 for hearts,diamonds,clubs,spades
  return baseNote + suitOffset;
}

function playBookSound(value) {
  // Play all 4 suits of the value as adjacent steps
  for (let i = 0; i < CARD_SUITS.length; i++) {
    let noteIdx = goFishCardToEDONote(CARD_SUITS[i], value);
    setTimeout(() => playEDONote(noteIdx, 0.5), i * 50);
  }
}

// --- Game Logic ---
function nextTurn() {
  let currentPlayer = players[currentPlayerIndex];
  
  if (currentPlayer.hand.length === 0) {
    checkGameEnd();
    return;
  }
  
  updateDisplay();
  
  if (currentPlayer.isHuman) {
    humanTurn(currentPlayer);
  } else {
    computerTurn(currentPlayer);
  }
}

function humanTurn(player) {
  document.getElementById('turn-indicator').textContent = `${player.name}'s Turn - Choose a card value to ask for`;
  
  // Show unique values in hand as buttons
  let uniqueValues = [...new Set(player.hand.map(card => card.value))];
  let askButtons = document.getElementById('ask-buttons');
  askButtons.innerHTML = '';
  
  uniqueValues.forEach(value => {
    let btn = document.createElement('button');
    btn.textContent = getValueName(value);
    btn.style.cssText = 'background: #060; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; margin: 2px; touch-action: manipulation;';
    btn.onclick = () => selectValueToAsk(value);
    askButtons.appendChild(btn);
  });
  
  document.getElementById('ask-interface').style.display = 'block';
}

function selectValueToAsk(value) {
  askingValue = value;
  
  // Show other players as targets
  let askButtons = document.getElementById('ask-buttons');
  askButtons.innerHTML = '';
  
  let targetText = document.createElement('div');
  targetText.textContent = `Ask who for ${getValueName(value)}s?`;
  targetText.style.cssText = 'color: #fff; margin-bottom: 10px;';
  askButtons.appendChild(targetText);
  
  players.forEach((player, index) => {
    if (index !== currentPlayerIndex && player.hand.length > 0) {
      let btn = document.createElement('button');
      btn.textContent = player.name;
      btn.style.cssText = 'background: #0080ff; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; margin: 2px; touch-action: manipulation;';
      btn.onclick = () => askPlayerForCards(index, askingValue);
      askButtons.appendChild(btn);
    }
  });
}

function askPlayerForCards(targetIndex, value) {
  document.getElementById('ask-interface').style.display = 'none';
  
  let currentPlayer = players[currentPlayerIndex];
  let targetPlayer = players[targetIndex];
  let cardsReceived = [];
  
  // Check target player's hand for matching cards
  for (let i = targetPlayer.hand.length - 1; i >= 0; i--) {
    if (targetPlayer.hand[i].value === value) {
      cardsReceived.push(targetPlayer.hand.splice(i, 1)[0]);
    }
  }
  
  if (cardsReceived.length > 0) {
    currentPlayer.hand = currentPlayer.hand.concat(cardsReceived);
    document.getElementById('message-area').textContent = `${targetPlayer.name} gives ${currentPlayer.name} ${cardsReceived.length} ${getValueName(value)}(s)!`;
    
    // Play received cards sound
    if (musicEnabled) {
      cardsReceived.forEach((card, i) => {
        let noteIdx = goFishCardToEDONote(card.suit, card.value);
        setTimeout(() => playEDONote(noteIdx), i * 100);
      });
    }
    
    // Check for books
    checkForBooks(currentPlayer);
    
    // Current player continues turn
    setTimeout(() => nextTurn(), 1500);
  } else {
    document.getElementById('message-area').textContent = `${targetPlayer.name} says "Go Fish!" ${currentPlayer.name} draws a card.`;
    
    // Draw from deck
    if (deck.length > 0) {
      let drawnCard = deck.pop();
      currentPlayer.hand.push(drawnCard);
      
      if (musicEnabled) {
        let noteIdx = goFishCardToEDONote(drawnCard.suit, drawnCard.value);
        playEDONote(noteIdx);
      }
      
      // Check if drawn card matches what was asked for
      if (drawnCard.value === value) {
        document.getElementById('message-area').textContent += ` Lucky! Got a ${getValueName(value)}. Continue turn.`;
        checkForBooks(currentPlayer);
        setTimeout(() => nextTurn(), 2000);
      } else {
        checkForBooks(currentPlayer);
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        setTimeout(() => nextTurn(), 2000);
      }
    } else {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      setTimeout(() => nextTurn(), 1500);
    }
  }
  
  checkGameEnd();
}

function computerTurn(player) {
  document.getElementById('turn-indicator').textContent = `${player.name}'s Turn`;
  
  // Computer picks a random value from its hand
  let randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
  let askValue = randomCard.value;
  
  // Pick a random target player
  let possibleTargets = players.filter((p, i) => i !== currentPlayerIndex && p.hand.length > 0);
  if (possibleTargets.length === 0) {
    checkGameEnd();
    return;
  }
  
  let targetPlayer = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
  let cardsReceived = [];
  
  // Check target player's hand for matching cards
  for (let i = targetPlayer.hand.length - 1; i >= 0; i--) {
    if (targetPlayer.hand[i].value === askValue) {
      cardsReceived.push(targetPlayer.hand.splice(i, 1)[0]);
    }
  }
  
  if (cardsReceived.length > 0) {
    player.hand = player.hand.concat(cardsReceived);
    document.getElementById('message-area').textContent = `${player.name} asks ${targetPlayer.name} for ${getValueName(askValue)}s and gets ${cardsReceived.length} card(s)!`;
    
    // Play received cards sound
    if (musicEnabled) {
      cardsReceived.forEach((card, i) => {
        let noteIdx = goFishCardToEDONote(card.suit, card.value);
        setTimeout(() => playEDONote(noteIdx), i * 100);
      });
    }
    
    // Check for books
    checkForBooks(player);
    
    // Computer continues turn
    setTimeout(() => nextTurn(), 1500);
  } else {
    document.getElementById('message-area').textContent = `${player.name} asks ${targetPlayer.name} for ${getValueName(askValue)}s. Go Fish!`;
    
    // Computer draws from deck
    if (deck.length > 0) {
      let drawnCard = deck.pop();
      player.hand.push(drawnCard);
      
      if (musicEnabled) {
        let noteIdx = goFishCardToEDONote(drawnCard.suit, drawnCard.value);
        playEDONote(noteIdx);
      }
      
      // Check if drawn card matches what was asked for
      if (drawnCard.value === askValue) {
        document.getElementById('message-area').textContent += ` ${player.name} got what they asked for!`;
        checkForBooks(player);
        setTimeout(() => nextTurn(), 2000);
      } else {
        checkForBooks(player);
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        setTimeout(() => nextTurn(), 2000);
      }
    } else {
      currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
      setTimeout(() => nextTurn(), 1500);
    }
  }
  
  checkGameEnd();
}

function getValueName(value) {
  if (value === 1) return 'Ace';
  if (value === 11) return 'Jack';
  if (value === 12) return 'Queen';
  if (value === 13) return 'King';
  return value.toString();
}

function checkGameEnd() {
  let playersWithCards = players.filter(p => p.hand.length > 0);
  if (playersWithCards.length <= 1 || deck.length === 0) {
    gameOver = true;
    endGame();
  }
}

function endGame() {
  // Sort players by book count
  let sortedPlayers = [...players].sort((a, b) => b.books.length - a.books.length);
  let winner = sortedPlayers[0];
  let maxBooks = winner.books.length;
  let winners = sortedPlayers.filter(p => p.books.length === maxBooks);
  
  endScreen.style.display = 'flex';
  
  let resultsHtml = '';
  if (winners.length === 1) {
    resultsHtml = `<div style="font-size: clamp(2em, 6vw, 3em); margin-bottom: 20px;">${winner.name} Wins!</div>`;
    if (winner.isHuman && musicEnabled) {
      playVictoryScale();
    }
  } else {
    let winnerNames = winners.map(w => w.name).join(' & ');
    resultsHtml = `<div style="font-size: clamp(2em, 6vw, 3em); margin-bottom: 20px;">${winnerNames} Tie!</div>`;
  }
  
  resultsHtml += '<div style="margin-bottom: 20px;">';
  sortedPlayers.forEach(player => {
    resultsHtml += `<div style="font-size: clamp(1em, 4vw, 1.5em); margin: 5px;">${player.name}: ${player.books.length} books</div>`;
  });
  resultsHtml += '</div>';
  
  resultsHtml += `
    <button onclick="restartGame()" style="background: #060; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: clamp(1em, 4vw, 1.2em); margin: 5px; touch-action: manipulation;">Play Again</button>
    <button onclick="goToSolitaire()" style="background: #c00; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: clamp(1em, 4vw, 1.2em); margin: 5px; touch-action: manipulation;">Back to Solitaire</button>
  `;
  
  endScreen.innerHTML = resultsHtml;
}

function restartGame() {
  endScreen.style.display = 'none';
  startGame();
}

function goToSolitaire() {
  window.location.href = 'index.html';
}

// --- Display Functions ---
function updateDisplay() {
  renderAllPlayers();
}

function renderAllPlayers() {
  let container = document.getElementById('players-container');
  container.innerHTML = '';
  
  players.forEach((player, index) => {
    let playerDiv = document.createElement('div');
    playerDiv.className = 'player-area';
    playerDiv.style.cssText = `
      background: ${index === currentPlayerIndex ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'};
      border: ${index === currentPlayerIndex ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)'};
      border-radius: 8px;
      padding: 10px;
      margin: 5px 0;
    `;
    
    // Player name and info
    let nameDiv = document.createElement('div');
    nameDiv.style.cssText = 'color: #fff; font-weight: bold; margin-bottom: 8px; text-align: center;';
    nameDiv.textContent = `${player.name} (${player.hand.length} cards, ${player.books.length} books)`;
    playerDiv.appendChild(nameDiv);
    
    // Hand display
    let handDiv = document.createElement('div');
    handDiv.className = 'hand-container';
    handDiv.style.cssText = 'display: flex; justify-content: center; flex-wrap: wrap; gap: 2px; margin-bottom: 8px;';
    
    player.hand.forEach(card => {
      let cardEl = document.createElement('img');
      if (player.isHuman) {
        cardEl.src = `${CARD_IMAGES_PATH}${card.suit}${card.value}.png`;
      } else {
        cardEl.src = `${CARD_IMAGES_PATH}reverse.png`;
      }
      cardEl.className = 'card mobile-card';
      handDiv.appendChild(cardEl);
    });
    playerDiv.appendChild(handDiv);
    
    // Books display
    if (player.books.length > 0) {
      let booksDiv = document.createElement('div');
      booksDiv.style.cssText = 'display: flex; justify-content: center; flex-wrap: wrap; gap: 3px;';
      
      player.books.forEach(book => {
        let bookDiv = document.createElement('div');
        bookDiv.style.cssText = 'display: flex; gap: 1px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: 3px;';
        
        book.forEach(card => {
          let cardEl = document.createElement('img');
          cardEl.src = `${CARD_IMAGES_PATH}${card.suit}${card.value}.png`;
          cardEl.className = 'mobile-book-card';
          bookDiv.appendChild(cardEl);
        });
        booksDiv.appendChild(bookDiv);
      });
      playerDiv.appendChild(booksDiv);
    }
    
    container.appendChild(playerDiv);
  });
}

function playVictoryScale() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let t = audioCtx.currentTime;
  let sixteenthNote = 60 / 120 / 4;
  
  for (let i = 0; i <= 53; i++) {
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = edoFreq(i);
    let gain = audioCtx.createGain();
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + sixteenthNote);
    t += sixteenthNote;
  }
}

// --- Game Initialization ---
function startGame() {
  console.log('Starting game...');
  try {
    createDeck();
    console.log('Deck created:', deck.length, 'cards');
    setupPlayers();
    console.log('Players setup:', players.length, 'players');
    dealCards();
    console.log('Cards dealt');
    gameOver = false;
    currentPlayerIndex = 0;
    
    updateDisplay();
    console.log('Display updated');
    nextTurn();
    console.log('First turn started');
  } catch (error) {
    console.error('Error in startGame:', error);
    throw error;
  }
}

function updatePlayerSetup() {
  humanPlayerCount = parseInt(document.getElementById('human-count').value);
  computerPlayerCount = parseInt(document.getElementById('computer-count').value);
  
  // Ensure total players don't exceed 6
  if (humanPlayerCount + computerPlayerCount > 6) {
    computerPlayerCount = 6 - humanPlayerCount;
    document.getElementById('computer-count').value = computerPlayerCount;
  }
  
  // Generate name inputs for human players
  let namesDiv = document.getElementById('player-names');
  namesDiv.innerHTML = '';
  
  for (let i = 0; i < humanPlayerCount; i++) {
    let nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `player-${i}-name`;
    nameInput.placeholder = `Player ${i + 1} Name`;
    nameInput.value = `Player ${i + 1}`;
    nameInput.style.cssText = 'width: 100%; padding: 8px; margin: 3px 0; border-radius: 4px; border: none;';
    namesDiv.appendChild(nameInput);
  }
}

// --- Control Event Listeners ---
if (bpmSlider) {
  bpmSlider.addEventListener('input', e => {
    bpm = parseFloat(bpmSlider.value);
    if (bpmValue) bpmValue.value = bpm === 5.3 ? '5.3' : Math.round(bpm);
    updateBackground();
  });
}

if (bpmValue) {
  bpmValue.addEventListener('input', e => {
    let val = parseFloat(bpmValue.value);
    if (val >= BPM_MIN && val <= BPM_MAX) {
      bpm = val;
      if (bpmSlider) bpmSlider.value = val;
      bpmValue.value = val === 5.3 ? '5.3' : Math.round(val);
      updateBackground();
    }
  });
}

if (fundamentalSlider) {
  fundamentalSlider.addEventListener('input', e => {
    let rawFreq = parseInt(fundamentalSlider.value);
    fundamental = Math.round(rawFreq); // Simplified since snapToEDOFreq may not exist
    if (fundamentalInput) fundamentalInput.value = fundamental;
    fundamentalSlider.value = fundamental;
    updateBackground();
  });
}

if (fundamentalInput) {
  fundamentalInput.addEventListener('input', e => {
    let val = parseInt(fundamentalInput.value);
    if (val >= 80 && val <= 1500) {
      fundamental = Math.round(val);
      if (fundamentalSlider) fundamentalSlider.value = fundamental;
      fundamentalInput.value = fundamental;
      updateBackground();
    }
  });
}

if (musicToggle) {
  musicToggle.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
  });
}

const waveforms = ['sine', 'sawtooth', 'square', 'triangle'];
let waveformIndex = 0;
if (waveformBtn) {
  waveformBtn.addEventListener('click', () => {
    waveformIndex = (waveformIndex + 1) % waveforms.length;
    waveform = waveforms[waveformIndex];
    waveformBtn.textContent = waveform.charAt(0).toUpperCase() + waveform.slice(1);
  });
}

if (playBtn) {
  playBtn.addEventListener('click', () => {
    console.log('Play button clicked');
    try {
      if (startMenu) startMenu.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'block';
      gameStarted = true;
      updateBackground();
      startGame();
      console.log('Game started successfully');
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Error starting game: ' + error.message);
    }
  });
}

let humanCountEl = document.getElementById('human-count');
if (humanCountEl) {
  humanCountEl.addEventListener('change', updatePlayerSetup);
}

let computerCountEl = document.getElementById('computer-count');
if (computerCountEl) {
  computerCountEl.addEventListener('change', updatePlayerSetup);
}

let cancelAskEl = document.getElementById('cancel-ask');
if (cancelAskEl) {
  cancelAskEl.addEventListener('click', () => {
    let askInterface = document.getElementById('ask-interface');
    if (askInterface) askInterface.style.display = 'none';
    askingValue = null;
    askingPlayerIndex = null;
  });
}

// Initialize player setup
updatePlayerSetup();

if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    if (gameStarted && !gameOver) {
      startGame();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && gameStarted) {
    e.preventDefault();
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? '🔊' : '🔇';
  }
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

// --- Initialize ---
// Ensure common.js variables are available
if (typeof FUNDAMENTAL_DEFAULT === 'undefined') {
  window.FUNDAMENTAL_DEFAULT = 365;
  window.BPM_DEFAULT = 106;
  window.BPM_MIN = 5.3;
  window.BPM_MAX = 530;
  window.CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
  window.CARD_VALUES = [1,2,3,4,5,6,7,8,9,10,11,12,13];
  window.CARD_IMAGES_PATH = 'cards/';
  window.musicEnabled = true;
  window.musicMode = 'faceup';
  window.waveform = 'sine';
  window.audioCtx = null;
  
  // Basic EDO frequency calculation
  window.edoFreq = function(step) {
    return fundamental * Math.pow(2, step / 53);
  };
  
  // Basic note playing function
  window.playEDONote = function(idx, duration = 0.5) {
    if (!audioCtx || !musicEnabled) return;
    let freq = edoFreq(idx);
    let osc = audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;
    let gain = audioCtx.createGain();
    gain.gain.value = 0.2;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  };
  
  // Basic background update function
  window.updateBackground = function() {
    document.body.style.background = `linear-gradient(45deg, hsl(${(fundamental/10)%360}, 70%, 20%), hsl(${(bpm*3)%360}, 60%, 15%))`;
  };
}

fundamental = FUNDAMENTAL_DEFAULT;
fundamentalSlider.value = FUNDAMENTAL_DEFAULT;
fundamentalInput.value = FUNDAMENTAL_DEFAULT;
bpm = BPM_DEFAULT;
bpmSlider.value = BPM_DEFAULT;
bpmValue.value = BPM_DEFAULT;