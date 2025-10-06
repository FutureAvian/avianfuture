// timing.js - Global timing module with metronome and sync features
const TimingModule = (function() {
    // Timing state
    let isSyncActive = false;
    let currentBeat = 0;
    let bpm = 106;
    let targetBpm = 106;
    let msPerBeat = 60000 / 106;
    let nextBeatTime = 0;
    let beatInterval = null;
    
    // Visual elements
    let visualizer = null;
    let audioCtx = null;
    let isMetronomeEnabled = false;

    // Initialize the module
    function init() {
        createVisualizer();
        document.addEventListener('keydown', handleKeyPress);
        console.log('Timing Module Initialized - Press T to toggle sync');
    }

    // Create the visual metronome
    function createVisualizer() {
        visualizer = document.createElement('div');
        visualizer.id = 'metronome-visualizer';
        visualizer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 20px;
            height: 20px;
            background-color: rgba(0, 0, 0, 0.5);
            border-radius: 4px;
            transition: all 0.1s;
            z-index: 1000;
            display: none;
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
            opacity: 0.7;
        `;
        document.body.appendChild(visualizer);
    }

    // Start timing sync
    function startSync() {
        if (isSyncActive) return;
        isSyncActive = true;
        
        // Align to next whole second
        const now = Date.now();
        const msToNextSecond = 1000 - (now % 1000);
        
        setTimeout(() => {
            nextBeatTime = performance.now();
            currentBeat = 0;
            if (isMetronomeEnabled) {
                visualizer.style.display = 'block';
            }
            processBeat();
        }, msToNextSecond);
        
        console.log('Timing sync enabled - Aligning to whole seconds');
    }

    // Stop timing sync
    function stopSync() {
        isSyncActive = false;
        if (beatInterval) {
            clearTimeout(beatInterval);
            beatInterval = null;
        }
        if (visualizer) {
            visualizer.style.display = 'none';
        }
        console.log('Timing sync disabled');
    }

    // Toggle sync on/off
    function toggleSync() {
        if (isSyncActive) {
            stopSync();
        } else {
            startSync();
        }
        return isSyncActive;
    }

    // Process each beat
    function processBeat() {
        if (!isSyncActive) return;
        
        const now = performance.now();
        const isDownBeat = currentBeat === 0;
        
        // Update visual feedback
        updateVisualizer(isDownBeat);
        
        // Play click sound on downbeat if enabled
        if (isMetronomeEnabled && isDownBeat) {
            playClick(800, 0.1);
        }
        
        // Calculate time until next beat
        let nextBeatIn = msPerBeat;
        
        // If we're changing BPM, calculate the new timing
        if (Math.abs(bpm - targetBpm) > 0.1) {
            // Gradually adjust BPM over the next measure
            const bpmChange = (targetBpm - bpm) / 4; // Spread over 4 beats
            bpm = Math.round((bpm + bpmChange) * 10) / 10;
            msPerBeat = 60000 / bpm;
        }
        
        // Schedule next beat
        beatInterval = setTimeout(() => {
            currentBeat = (currentBeat + 1) % 4;
            nextBeatTime += nextBeatIn;
            processBeat();
        }, nextBeatIn);
    }

    // Update BPM from the game's slider/input
    function setBpm(newBpm) {
        if (newBpm < 40) newBpm = 40;
        if (newBpm > 300) newBpm = 300;
        
        targetBpm = newBpm;
        
        // If sync is off, update immediately
        if (!isSyncActive) {
            bpm = targetBpm;
            msPerBeat = 60000 / bpm;
        }
    }

    // Visual feedback for the metronome
    function updateVisualizer(isDownBeat) {
        if (!visualizer) return;
        
        visualizer.style.backgroundColor = isDownBeat ? '#ff5555' : '#55aaff';
        visualizer.style.transform = 'scale(1.5)';
        
        // Reset transform after animation
        setTimeout(() => {
            visualizer.style.transform = 'scale(1)';
        }, 100);
    }

    // Play metronome click sound
    function playClick(freq, duration) {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        osc.start(now);
        osc.stop(now + duration);
    }

    // Handle keyboard shortcuts
    function handleKeyPress(e) {
        // Only handle if not in an input field
        if (e.target.tagName === 'INPUT') return;
        
        const key = e.key.toLowerCase();
        
        // Toggle timing sync with T
        if (key === 't') {
            const isNowActive = toggleSync();
            console.log(`Timing sync ${isNowActive ? 'enabled' : 'disabled'}`);
            e.preventDefault();
        }
        // Toggle metronome with M
        else if (key === 'm' && isSyncActive) {
            isMetronomeEnabled = !isMetronomeEnabled;
            visualizer.style.display = isMetronomeEnabled ? 'block' : 'none';
            console.log(`Metronome ${isMetronomeEnabled ? 'enabled' : 'disabled'}`);
            e.preventDefault();
        }
    }

    // Public API
    return {
        init,
        startSync,
        stopSync,
        toggleSync,
        setBpm,
        isSyncActive: () => isSyncActive,
        getCurrentBeat: () => currentBeat,
        getBpm: () => bpm,
        isMetronomeEnabled: () => isMetronomeEnabled
    };
})();

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', TimingModule.init);
} else {
    TimingModule.init();
}
