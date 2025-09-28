# SoliTone
A musical solitaire game that combines classic Klondike gameplay with 53-EDO (Equal Division of the Octave) generative music. Each card on the board triggers musical notes based on its suit and value, creating an evolving soundscape as you play.

## Features
- **Classic Klondike Solitaire** - Traditional card game mechanics
- **53-EDO Music System** - Microtonal music generation based on card positions
- **Dynamic Audio** - Music changes as you move cards and reveal new ones
- **Visual Card Highlighting** - Cards glow subtly when playing their musical notes
- **Victory Scale** - Full 53-EDO chromatic scale plays when you win and then the octave notes repeat.
- **Dynamic Background** - Gradient changes based on BPM and fundamental frequency

## Controls
- **Fundamental Slider** - Controls the base frequency of the musical scale (80Hz-1500Hz, default 365Hz)
- **Waveform Selector** - Choose between Sine, Sawtooth, Square, and Triangle waves
- **Music Trigger** - Toggle between face up and face down cards to listen to.
- **BPM Control** - Adjust tempo from 53-530 BPM
- **Music Toggle** - Start/stop audio playback (🔊/🔇) click or press spacebar
- **Quit Button** - It quits. Giving play the option to play 53 Card Pickup.

## Audio Features
- **Harmonic Accents** - Non-sine waveforms include 3rd, 5th, and tritone harmonics
- **Pure Sine Mode** - Clean microtonal tones without harmonics
- **Morse Code Victory** - "Winner" or "Game Over" played in 53-EDO morse code

## Technical Details
- **53-EDO Tuning** - 53 equal divisions of the octave for microtonal precision
- **Card-to-Note Mapping** - Each suit and value corresponds to specific 53-EDO degrees
- **Real-time Audio Synthesis** - Web Audio API oscillators with dynamic frequency calculation
- **Performance Optimized** - Cached card calculations and pre-computed timing data

## Play the Game
[Original Solitaire](https://hectorvilas.github.io/solitaire/) | [SoliTone Version](./solitaire53edo/index.html)

## Copyright & License

**SoliTone Musical Enhancements**  
Copyright © 2025 Clint Higgins. All rights reserved.

The 53-EDO music system, audio synthesis, visual effects, and musical game mechanics are original works by Clint Higgins.

**Original Solitaire Base**  
Based on solitaire mechanics from [HectorVilas/solitaire](https://github.com/HectorVilas/solitaire)

**Usage Rights**  
- Personal use and study: ✅ Permitted
- Educational use: ✅ Permitted  
- Commercial use: ❌ Requires permission
- Redistribution: ❌ Requires permission

For licensing inquiries, contact: clint@yesandandand.com