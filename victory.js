// victory.js - Handles all victory-related functionality with retro styling

let isVictoryScreenShown = false;
let audioContext = null;
let confettiContainer = null;

function showVictoryScreen() {
    if (isVictoryScreenShown) return;
    isVictoryScreenShown = true;
    
    // Stop any background music
    if (window.stopMusicLoop) {
        window.stopMusicLoop();
    }
    // Initialize audio context only when needed
    const initAudioContext = () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    };
    
    // Create victory screen container first
    const victoryScreen = document.createElement('div');
    victoryScreen.id = 'victory-screen';
    
    // Add content with VICTORY screen
    victoryScreen.innerHTML = `
        <div class="holographic-text">
            YOU WON!
        </div>
        <div class="holographic-subtext">
            CONGRATULATIONS
        </div>
        <button id="quit-to-start">
            QUIT TO START
        </button>
    `;
    
    // Add click handler for the quit button
    victoryScreen.querySelector('#quit-to-start').onclick = () => {
        // Stop any currently playing victory sound
        if (window.stopMusicLoop) {
            window.stopMusicLoop();
        }
        
        // Clean up audio context if it exists
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
        }
        
        // Clean up confetti if it exists
        if (confettiContainer) {
            confettiContainer.remove();
            confettiContainer = null;
        }
        
        // Remove any 'click to play' button if it exists
        const playSoundBtn = document.querySelector('.play-victory-sound-btn');
        if (playSoundBtn) {
            playSoundBtn.remove();
        }
        
        // Hide victory screen and show start menu
        const startMenu = document.getElementById('start-menu');
        if (startMenu) {
            startMenu.style.display = 'flex';
        }
        
        // Remove victory screen
        victoryScreen.remove();
        isVictoryScreenShown = false;
        
        // Reset game state if restartGame function exists
        if (window.restartGame) {
            window.restartGame();
        }
    };
    
    // Add hover effect
    const quitButton = victoryScreen.querySelector('#quit-to-start');
    quitButton.addEventListener('mouseenter', () => {
        quitButton.style.background = 'rgba(0, 255, 0, 0.2)';
        quitButton.style.transform = 'scale(1.05)';
    });
    quitButton.addEventListener('mouseleave', () => {
        quitButton.style.background = 'rgba(0, 0, 0, 0.7)';
        quitButton.style.transform = 'scale(1)';
    });
    
    // Add holographic effect
    addHolographicEffect(victoryScreen.querySelector('.holographic-text'));
    addHolographicEffect(victoryScreen.querySelector('.holographic-subtext'));
    
        // Confetti is currently disabled
    // Uncomment the following code to re-enable confetti:
    /*
    // Remove any existing confetti container first
    const existingConfetti = document.getElementById('confetti-container');
    if (existingConfetti) {
        existingConfetti.remove();
    }
    
    // Create new confetti container
    confettiContainer = document.createElement('div');
    confettiContainer.id = 'confetti-container';
    document.body.appendChild(confettiContainer);
    
    // Create confetti after a short delay
    setTimeout(() => {
        createRetroConfetti();
    }, 500);
    */
    
    // Add victory screen content
    document.body.appendChild(victoryScreen);
    
    // Function to play victory sound
    const playVictorySound = async () => {
        try {
            const ctx = initAudioContext();
            
            // Stop any currently playing game music
            if (window.stopMusicLoop) {
                window.stopMusicLoop();
            }
            
            if (ctx.state === 'suspended') {
                // If audio is suspended, show a button to enable it
                const resumeButton = document.createElement('button');
                resumeButton.className = 'play-victory-sound-btn';
                resumeButton.textContent = 'CLICK TO PLAY VICTORY SOUND';
                resumeButton.style.padding = '15px 30px';
                resumeButton.style.fontSize = '1.2em';
                resumeButton.style.marginTop = '20px';
                resumeButton.style.cursor = 'pointer';
                resumeButton.style.background = 'rgba(0, 200, 0, 0.8)';
                resumeButton.style.color = '#000';
                resumeButton.style.border = 'none';
                resumeButton.style.borderRadius = '5px';
                resumeButton.style.position = 'fixed';
                resumeButton.style.top = '60%';
                resumeButton.style.left = '50%';
                resumeButton.style.transform = 'translateX(-50%)';
                resumeButton.style.zIndex = '3000';
                // Add click handler to resume audio context
                resumeButton.onclick = async () => {
                    try {
                        await ctx.resume();
                        resumeButton.remove();
                        await playRetroVictorySound();
                        // After victory sound finishes, ensure music stays off
                        if (window.stopMusicLoop) {
                            window.stopMusicLoop();
                        }
                    } catch (e) {
                        console.error('Error playing victory sound:', e);
                        console.error('Error resuming audio:', e);
                        resumeButton.textContent = 'ERROR - CLICK TO TRY AGAIN';
                    }
                };
                
                document.body.appendChild(resumeButton);
            } else {
                playRetroVictorySound();
            }
        } catch (e) {
            console.error('Error initializing audio:', e);
        }
    };
    
    // Start playing sound
    playVictorySound();
    
    // The audio button will be shown by startAudioIfNeeded when needed
}

function playRetroVictorySound() {
    if (!audioContext || audioContext.state === 'suspended') {
        console.log('Audio context not ready, retrying...');
        setTimeout(playRetroVictorySound, 100);
        return;
    }

    try {
        // 53-EDO scale (C to C, 53 steps per octave) - One octave higher
        const baseFreq = 261.63; // C4 (one octave higher than C3)
        const steps = 53;
        const noteDuration = 0.1; // seconds per note
        let time = audioContext.currentTime + 0.1; // Small delay
        
        // Play scale up
        for (let i = 0; i <= steps; i++) {
            const freq = baseFreq * Math.pow(2, i / 53);
            playNote(freq, time + (i * noteDuration), noteDuration * 0.9);
        }
        
        // Play alternating high and low notes
        const highFreq = baseFreq * 2; // One octave up
        for (let i = 0; i < 8; i++) {
            const freq = i % 2 === 0 ? baseFreq : highFreq;
            playNote(freq, time + (steps * noteDuration) + (i * noteDuration * 2), noteDuration * 1.8);
        }
        
        // Play scale down
        for (let i = steps; i >= 0; i--) {
            const freq = baseFreq * Math.pow(2, i / 53);
            playNote(freq, time + ((steps + 8) * noteDuration) + ((steps - i) * noteDuration), noteDuration * 0.9);
        }
        
        // Play final alternating notes
        for (let i = 0; i < 8; i++) {
            const freq = i % 2 === 0 ? baseFreq : highFreq;
            playNote(freq, time + ((steps * 2 + 8) * noteDuration) + (i * noteDuration * 2), noteDuration * 1.8);
        }
        
        
    } catch (e) {
        console.error('Error playing victory sound:', e);
    }
}

function playNote(frequency, startTime, duration) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.1);
}

function createRetroConfetti() {
    // Remove any existing confetti container
    const existingContainer = document.getElementById('confetti-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const confettiContainer = document.createElement('div');
    confettiContainer.id = 'confetti-container';
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100%';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '1999'; // Lower than victory screen
    confettiContainer.style.overflow = 'hidden';
    document.body.appendChild(confettiContainer);
    
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const gridSize = 30; // pixels between confetti pieces
    const totalPieces = Math.ceil((window.innerWidth / gridSize) * (window.innerHeight / gridSize));
    let piecesPlaced = 0;
    
    // Function to create a grid of confetti that fills the screen
    const fillScreenWithConfetti = () => {
        const rows = Math.ceil(window.innerHeight / gridSize);
        const cols = Math.ceil(window.innerWidth / gridSize);
        const positions = [];
        
        // Create array of all possible positions
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                positions.push({ row, col });
            }
        }
        
        // Shuffle positions for random appearance
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
        
        // Create confetti at random positions
        positions.forEach((pos, index) => {
            const { row, col } = pos;
            const delay = index * 20; // Staggered appearance
            
            setTimeout(() => {
                const confetti = document.createElement('div');
                const size = gridSize * 0.8;
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                confetti.style.position = 'absolute';
                confetti.style.width = `${size}px`;
                confetti.style.height = `${size}px`;
                confetti.style.background = color;
                confetti.style.left = `${col * gridSize}px`;
                confetti.style.top = `${row * gridSize}px`;
                confetti.style.opacity = '0';
                confetti.style.transition = 'opacity 0.8s ease-in-out';
                confetti.style.boxShadow = `0 0 3px ${color}`;
                confetti.style.filter = 'brightness(0.7)';
                
                confettiContainer.appendChild(confetti);
                
                // Fade in
                setTimeout(() => {
                    confetti.style.opacity = '0.6';
                }, 10);
                
                piecesPlaced++;
                
                // If all pieces are placed, schedule the restart
                if (piecesPlaced === positions.length) {
                    // Removed automatic restart - player will use QUIT TO START button
                }
            }, delay);
        });
    };
    
    // Start filling the screen
    fillScreenWithConfetti();
    
    // Removed automatic restart - player will use QUIT TO START button
}

// Add holographic effect function if not exists
if (typeof window.addHolographicEffect !== 'function') {
    window.addHolographicEffect = function(element) {
        if (!element) return;
        
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        let colorIndex = 0;
        
        function updateColor() {
            element.style.color = colors[colorIndex];
            colorIndex = (colorIndex + 1) % colors.length;
        }
        
        // Initial color
        updateColor();
        
        // Change color every 500ms
        const interval = setInterval(updateColor, 500);
        
        // Clean up function
        return () => clearInterval(interval);
    };
}

// Export functions for use in other files
window.showVictoryScreen = showVictoryScreen;
