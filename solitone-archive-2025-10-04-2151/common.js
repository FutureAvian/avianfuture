/*
 * SoliTone - Musical Solitaire Game
 * Copyright (c) 2024 Clint Higgins
 * 
 * 53-EDO music system, audio synthesis, and musical enhancements
 * are original works by Clint Higgins.
 * 
 * Based on solitaire mechanics from:
 * https://github.com/HectorVilas/solitaire by Hector Vilas
 */

// Shared constants and functions for SoliTone games

// --- Constants ---
const BPM_DEFAULT = 106;
const BPM_MIN = 5.3;
const BPM_MAX = 530;
const FUNDAMENTAL_DEFAULT = 262;
const EDO_NOTES = 53;
const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const CARD_VALUES = [2,3,4,5,6,7,8,9,10,11,12,13,1]; // 1=Ace
const CARD_IMAGES_PATH = 'media/images/cards/traditional/';
const EDO_RATIO = Math.pow(2, 1/53);
const MAJOR_INTERVALS = [0, 17, 31, 44, 53]; // Major intervals: unison, maj3rd, 5th, maj7th, octave

// --- Shared State ---
let bpm = BPM_DEFAULT;
let fundamental = 262;
let suitWaveforms = {
  hearts: 'sine',
  diamonds: 'sine', 
  clubs: 'triangle',
  spades: 'triangle'
};
let musicMode = 'faceup'; // 'faceup' or 'facedown'
let audioCtx = null;
let musicEnabled = true;
let currentTuning = 0; // 0=Alternating, 1=Fifths, 2=Triads, 3=Chromatic

// --- Tuning System Names ---
const TUNING_NAMES = [
  'Alternating Steps',
  'Perfect Fifths', 
  'Major Triads',
  'Chromatic Blocks'
];

// --- Utility: Card to 53 EDO note mapping ---
function cardToEDONote(suit, value) {
  let cardValue = value === 1 ? 13 : value - 1; // Ace=13, 2=1, 3=2, etc.
  
  switch (currentTuning) {
    case 0: // Alternating Steps (original)
      if (suit === 'hearts') {
        return (cardValue - 1) * 2;
      } else if (suit === 'clubs') {
        return (cardValue - 1) * 2 + 1;
      } else if (suit === 'diamonds') {
        return 26 + (cardValue - 1) * 2;
      } else if (suit === 'spades') {
        return 26 + (cardValue - 1) * 2 + 1;
      }
      break;
      
    case 1: // Perfect Fifths
      if (suit === 'hearts') {
        return (cardValue - 1); // 0-12
      } else if (suit === 'diamonds') {
        return 31 + (cardValue - 1); // 31-43 (fifth above)
      } else if (suit === 'clubs') {
        return 13 + (cardValue - 1); // 13-25 (between)
      } else if (suit === 'spades') {
        return 44 + Math.min(cardValue - 1, 8); // 44-52 (seventh/octave)
      }
      break;
      
    case 2: // Major Triads
      if (suit === 'hearts') {
        return (cardValue - 1) * 4; // Roots: 0,4,8,12,16,20,24,28,32,36,40,44,48
      } else if (suit === 'diamonds') {
        return 17 + (cardValue - 1) * 2; // Thirds: 17,19,21,23,25,27,29,31,33,35,37,39,41
      } else if (suit === 'spades') {
        return 31 + (cardValue - 1); // Fifths: 31,32,33,34,35,36,37,38,39,40,41,42,43
      } else if (suit === 'clubs') {
        return 1 + (cardValue - 1) * 4; // Fill gaps: 1,5,9,13,17,21,25,29,33,37,41,45,49
      }
      break;
      
    case 3: // Chromatic Blocks
      if (suit === 'hearts') {
        return (cardValue - 1); // 0-12
      } else if (suit === 'diamonds') {
        return 13 + (cardValue - 1); // 13-25
      } else if (suit === 'clubs') {
        return 26 + (cardValue - 1); // 26-38
      } else if (suit === 'spades') {
        return 39 + Math.min(cardValue - 1, 13); // 39-52
      }
      break;
  }
  return 52; // fallback
}

// --- Audio Functions ---
function edoFreq(idx) {
  return fundamental * Math.pow(EDO_RATIO, idx);
}

function snapToEDOFreq(freq) {
  const referenceFreq = 440; // A4
  const ratio = freq / referenceFreq;
  const step = Math.round(53 * Math.log2(ratio));
  return referenceFreq * Math.pow(EDO_RATIO, step);
}

function playEDONote(idx, duration = 0.15, suit = null) {
  if (!audioCtx) return;
  let freq = edoFreq(idx);
  let normalizedIdx = idx % 53;
  let isAccented = MAJOR_INTERVALS.includes(normalizedIdx);
  
  let waveform = suit ? suitWaveforms[suit] : 'sine';
  
  let osc = audioCtx.createOscillator();
  osc.type = waveform;
  osc.frequency.value = freq;
  let gain = audioCtx.createGain();
  let baseGain = waveform === 'sine' ? 0.2 : 0.15;
  let finalGain = isAccented ? baseGain * 1.2 : baseGain;
  
  if (waveform === 'sine') {
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(finalGain, audioCtx.currentTime + 0.002);
  } else {
    gain.gain.value = finalGain;
  }
  
  let noteDuration = isAccented ? duration * 1.05 : duration;
  
  if (duration > 1) {
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration - 0.5);
  } else if (waveform === 'sine') {
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + (noteDuration * 1.5) - 0.005);
  }
  
  // Connect through delay if enabled (check if delayNode exists in game.js)
  let destination = audioCtx.destination;
  if (typeof delayNode !== 'undefined' && delayNode) {
    osc.connect(gain).connect(delayNode);
    gain.connect(destination); // Also connect directly
  } else {
    osc.connect(gain).connect(destination);
  }
  
  osc.start();
  let stopTime = waveform === 'sine' ? noteDuration * 1.5 : noteDuration;
  osc.stop(audioCtx.currentTime + stopTime);
  
  // Play fundamental with harmonics if enabled
  if (typeof fundamentalHarmonyEnabled !== 'undefined' && fundamentalHarmonyEnabled && isAccented) {
    let fundOsc = audioCtx.createOscillator();
    fundOsc.type = 'sine';
    fundOsc.frequency.value = fundamental;
    let fundGain = audioCtx.createGain();
    fundGain.gain.value = 0.15;
    fundOsc.connect(fundGain).connect(destination);
    fundOsc.start();
    fundOsc.stop(audioCtx.currentTime + noteDuration);
  }
  
  if (isAccented) {
    let reverbOsc = audioCtx.createOscillator();
    reverbOsc.type = waveform;
    reverbOsc.frequency.value = freq;
    let reverbGain = audioCtx.createGain();
    reverbGain.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
    reverbGain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.12);
    reverbGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    reverbOsc.connect(reverbGain).connect(destination);
    reverbOsc.start(audioCtx.currentTime + 0.1);
    reverbOsc.stop(audioCtx.currentTime + 0.5);
  }
  
  if (waveform !== 'sine') {
    let osc5 = audioCtx.createOscillator();
    osc5.type = waveform;
    osc5.frequency.value = edoFreq(idx + 31);
    let gain5 = audioCtx.createGain();
    gain5.gain.value = 0.08;
    osc5.connect(gain5).connect(destination);
    osc5.start();
    osc5.stop(audioCtx.currentTime + 0.1575);
    
    let osc3 = audioCtx.createOscillator();
    osc3.type = waveform;
    osc3.frequency.value = edoFreq(idx + 17);
    let gain3 = audioCtx.createGain();
    gain3.gain.value = 0.1;
    osc3.connect(gain3).connect(destination);
    osc3.start();
    osc3.stop(audioCtx.currentTime + 0.1575);
  }
}

function updateBackground() {
  let fundHue = 180 - ((Math.log(fundamental) - Math.log(80)) / (Math.log(1500) - Math.log(80))) * 120;
  let bpmHue = 240 + ((bpm - 53) / (280.9 - 53)) * 60;
  let startColor = `hsl(${fundHue}, 40%, 25%)`;
  let endColor = `hsl(${bpmHue}, 45%, 20%)`;
  document.body.style.background = `linear-gradient(135deg, ${startColor}, ${endColor})`;
  document.body.style.backgroundSize = '200% 200%';
}

// --- Morse Code ---
const MORSE_LETTERS = {
  'W': '.--.', 'I': '..', 'N': '-.', 'E': '.', 'R': '.-.',
  'G': '--.', 'A': '.-', 'M': '--', 'O': '---', 'V': '...-'
};

function playEDOMorse(start, dur) {
  let osc = audioCtx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = fundamental * Math.pow(EDO_RATIO, 52);
  let gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
  gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + start + 0.005);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + start);
  osc.stop(audioCtx.currentTime + start + dur);
}