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
let waveform = 'sine';
let musicMode = 'faceup'; // 'faceup' or 'facedown'
let audioCtx = null;
let musicEnabled = true;

// --- Utility: Card to 53 EDO note mapping ---
function cardToEDONote(suit, value) {
  // Alternating mapping for more adjacent steps
  // Low half (0-25): Hearts/Clubs alternate by value
  // High half (26-51): Diamonds/Spades alternate by value
  // Joker gets step 52
  
  let cardValue = value === 1 ? 13 : value - 1; // Ace=13, 2=1, 3=2, etc.
  
  if (suit === 'hearts') {
    return (cardValue - 1) * 2; // 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
  } else if (suit === 'clubs') {
    return (cardValue - 1) * 2 + 1; // 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25
  } else if (suit === 'diamonds') {
    return 26 + (cardValue - 1) * 2; // 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50
  } else if (suit === 'spades') {
    return 26 + (cardValue - 1) * 2 + 1; // 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51
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

function playEDONote(idx, duration = 0.15) {
  if (!audioCtx) return;
  let freq = edoFreq(idx);
  let normalizedIdx = idx % 53;
  let isAccented = MAJOR_INTERVALS.includes(normalizedIdx);
  
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
  
  // Add fade-out for sustained notes (duration > 1 second)
  if (duration > 1) {
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration - 0.5);
  } else if (waveform === 'sine') {
    // Short fade-out for sine waves to prevent clicking
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + (noteDuration * 1.5) - 0.005);
  }
  
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  let stopTime = waveform === 'sine' ? noteDuration * 1.5 : noteDuration;
  osc.stop(audioCtx.currentTime + stopTime);
  
  // Add reverb tail for accented notes
  if (isAccented) {
    let reverbOsc = audioCtx.createOscillator();
    reverbOsc.type = waveform;
    reverbOsc.frequency.value = freq;
    let reverbGain = audioCtx.createGain();
    reverbGain.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
    reverbGain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.12);
    reverbGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    reverbOsc.connect(reverbGain).connect(audioCtx.destination);
    reverbOsc.start(audioCtx.currentTime + 0.1);
    reverbOsc.stop(audioCtx.currentTime + 0.5);
  }
  
  if (waveform !== 'sine') {
    // Fifth
    let osc5 = audioCtx.createOscillator();
    osc5.type = waveform;
    osc5.frequency.value = edoFreq(idx + 31);
    let gain5 = audioCtx.createGain();
    if (waveform === 'sine') {
      gain5.gain.setValueAtTime(0, audioCtx.currentTime);
      gain5.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.005);
    } else {
      gain5.gain.value = 0.08;
    }
    osc5.connect(gain5).connect(audioCtx.destination);
    osc5.start();
    osc5.stop(audioCtx.currentTime + 0.1575);
    
    // Major third
    let osc3 = audioCtx.createOscillator();
    osc3.type = waveform;
    osc3.frequency.value = edoFreq(idx + 17);
    let gain3 = audioCtx.createGain();
    if (waveform === 'sine') {
      gain3.gain.setValueAtTime(0, audioCtx.currentTime);
      gain3.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.005);
    } else {
      gain3.gain.value = 0.1;
    }
    osc3.connect(gain3).connect(audioCtx.destination);
    osc3.start();
    osc3.stop(audioCtx.currentTime + 0.1575);
    
    // Tritone
    let oscTri = audioCtx.createOscillator();
    oscTri.type = waveform;
    oscTri.frequency.value = edoFreq(idx + 26);
    let gainTri = audioCtx.createGain();
    if (waveform === 'sine') {
      gainTri.gain.setValueAtTime(0, audioCtx.currentTime);
      gainTri.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.005);
    } else {
      gainTri.gain.value = 0.05;
    }
    oscTri.connect(gainTri).connect(audioCtx.destination);
    oscTri.start();
    oscTri.stop(audioCtx.currentTime + 0.1575);
  }
}

function updateBackground() {
  let fundHue = 180 - ((Math.log(fundamental) - Math.log(80)) / (Math.log(1500) - Math.log(80))) * 120;
  let bpmHue = 240 + ((bpm - 53) / (280.9 - 53)) * 60;
  let startColor = `hsl(${fundHue}, 40%, 25%)`;
  let endColor = `hsl(${bpmHue}, 45%, 20%)`;
  document.body.style.background = `linear-gradient(135deg, ${startColor}, ${endColor})`;
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