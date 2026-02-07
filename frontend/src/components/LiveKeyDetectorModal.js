import React, { useState, useRef, useEffect } from 'react';
import PitchWheel from './PitchWheel';

const LiveKeyDetectorModal = ({ onClose, onApply, api, uploadFile, songKey, canApply = true }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [sourceType, setSourceType] = useState('mic'); // 'mic' or 'system'
    const [recordingTime, setRecordingTime] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [detectedKey, setDetectedKey] = useState(null);
    const [targetSemitones, setTargetSemitones] = useState(0);
    const [error, setError] = useState('');

    const mediaRecorderRef = useRef(null);
    const timerRef = useRef(null);
    const streamRef = useRef(null);

    // Audio Visualization (Simple)
    const [audioContext, setAudioContext] = useState(null);
    const [analyser, setAnalyser] = useState(null);
    const [dataArray, setDataArray] = useState(null);
    const canvasRef = useRef(null);
    const animationRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecordingCleanup();
        };
    }, []);

    const stopRecordingCleanup = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (audioContext) audioContext.close();
    };

    const startRecording = async () => {
        try {
            setError('');
            setDetectedKey(null); // Reset previous result

            let stream;
            if (sourceType === 'mic') {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } else {
                // System Audio (Screen Share)
                stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                // We only need audio, so if video track exists, we can ignore/stop it? 
                // Actually, stopping video track might stop audio on some browsers. Safest is to just ignore it.
            }

            streamRef.current = stream;

            // Setup Visualization
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const anal = ac.createAnalyser();
            const src = ac.createMediaStreamSource(stream);
            src.connect(anal);
            anal.fftSize = 256;
            const bufferLength = anal.frequencyBinCount;
            const dataArr = new Uint8Array(bufferLength);

            setAudioContext(ac);
            setAnalyser(anal);
            setDataArray(dataArr);
            drawVisualizer(anal, dataArr);

            // Setup Recorder
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                // Simple cleanup: name with timestamp
                const file = new File([audioBlob], `recording_${Date.now()}.wav`, { type: "audio/wav" });

                analyzeRecording(file);
                stopRecordingCleanup();
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Timer (Max 30s)
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 30) {
                        stopRecording();
                        return 30;
                    }
                    return prev + 1;
                });
            }, 1000);

        } catch (err) {
            console.error("Mic Access Error:", err);
            setError("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const drawVisualizer = (anal, data) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        const draw = () => {
            animationRef.current = requestAnimationFrame(draw);
            anal.getByteFrequencyData(data);

            ctx.fillStyle = '#181611';
            ctx.fillRect(0, 0, width, height);

            const barWidth = (width / data.length) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < data.length; i++) {
                barHeight = data[i] / 2;
                ctx.fillStyle = `rgb(${barHeight + 100}, 185, 13)`; // Primary Color-ish
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
    };

    const analyzeRecording = async (file) => {
        setIsAnalyzing(true);
        try {
            const uploadedPath = await uploadFile(file);
            // Analyze and request cleanup
            const result = await api?.analyzePitch(uploadedPath, { delete_after: true });

            if (result && result.key) {
                const userKey = result.full_key;
                setDetectedKey(userKey);

                // Auto-match logic
                if (songKey) {
                    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                    const normalize = (n) => (n.match(/([A-G]#?)/) || [])[1] || 'C';

                    const songNote = normalize(songKey);
                    const userNote = normalize(userKey);

                    const idx1 = notes.indexOf(songNote);
                    const idx2 = notes.indexOf(userNote);

                    if (idx1 !== -1 && idx2 !== -1) {
                        let diff = idx2 - idx1;
                        if (diff > 6) diff -= 12;
                        if (diff < -6) diff += 12;

                        setTargetSemitones(diff);
                    }
                }
            } else {
                setError("Could not detect key from recording.");
            }
        } catch (err) {
            console.error("Mic Analysis Failed:", err);
            setError("Analysis failed. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Helper to calculate target note for display
    const getTargetPitch = (baseKey, shift) => {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const normalize = (n) => (n.match(/([A-G]#?)/) || [])[1] || 'C';
        const baseNote = normalize(baseKey);
        const startIdx = notes.indexOf(baseNote);
        if (startIdx === -1) return baseKey;

        // Handle negative modulo correctly
        let newIdx = (startIdx + shift) % 12;
        if (newIdx < 0) newIdx += 12;

        return notes[newIdx];
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#181611] border border-[#393528] rounded-2xl p-8 w-[90%] max-w-lg shadow-2xl relative flex flex-col items-center gap-6">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                    Live Key Detection
                </h2>

                {/* State: Recording */}
                {!detectedKey && (
                    <div className="flex flex-col items-center gap-6 w-full">

                        {/* Source Toggle */}
                        <div className="flex bg-[#12100c] p-1 rounded-full border border-[#2c281b]">
                            <button
                                onClick={() => setSourceType('mic')}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${sourceType === 'mic'
                                    ? 'bg-[#2c281b] text-primary shadow-sm ring-1 ring-[#393528]'
                                    : 'text-[#666] hover:text-[#bab29c]'
                                    }`}
                            >
                                Microphone
                            </button>
                            <button
                                onClick={() => setSourceType('system')}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${sourceType === 'system'
                                    ? 'bg-[#2c281b] text-primary shadow-sm ring-1 ring-[#393528]'
                                    : 'text-[#666] hover:text-[#bab29c]'
                                    }`}
                            >
                                System Audio
                            </button>
                        </div>

                        <div className="relative w-full h-32 bg-[#12100c] rounded-lg overflow-hidden border border-[#2c281b]">
                            <canvas ref={canvasRef} width={400} height={128} className="w-full h-full opacity-50" />

                            {!isRecording && !isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center text-[#666] text-sm">
                                    Press Start to Record
                                </div>
                            )}

                            {isAnalyzing && (
                                <div className="absolute inset-0 flex items-center justify-center gap-2 text-primary font-bold animate-pulse">
                                    <span className="material-symbols-outlined animate-spin">autorenew</span>
                                    Analyzing Audio...
                                </div>
                            )}
                        </div>

                        {/* Timer */}
                        <div className="text-4xl font-mono font-bold text-white">
                            00:{recordingTime.toString().padStart(2, '0')}
                            <span className="text-sm text-[#666] ml-2">/ 00:30</span>
                        </div>

                        {/* Controls */}
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                disabled={isAnalyzing}
                                className="px-8 py-4 bg-red-600 hover:bg-red-500 rounded-full text-white font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                            >
                                <span className="material-symbols-outlined">mic</span>
                                Start Recording
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="px-8 py-4 bg-[#2c281b] hover:bg-[#393528] border border-red-500/50 text-red-500 rounded-full font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 animate-pulse"
                            >
                                <span className="material-symbols-outlined">stop_circle</span>
                                Stop Recording
                            </button>
                        )}

                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                )}

                {/* State: Result */}
                {detectedKey && (
                    <div className="flex flex-col items-center gap-6 animate-slide-up">
                        <div className="text-center">
                            <p className="text-[#bab29c] text-sm font-bold uppercase mb-1">Detected User Key</p>
                            <p className="text-4xl font-bold text-primary">{detectedKey}</p>
                        </div>

                        <div className="bg-[#12100c] p-6 rounded-xl border border-[#2c281b] flex flex-col items-center gap-4">
                            <p className="text-[#666] text-xs text-center">
                                To match the song to your voice, we need to shift:
                            </p>

                            {/* Reusing PitchWheel as 'Read Only' display mainly, but user can tweak */}
                            <PitchWheel
                                currentPitch={songKey || 'C'}
                                targetPitch={getTargetPitch(songKey || 'C', targetSemitones)} // Show Predicted Target
                                onChange={setTargetSemitones} // Allow fine-tuning
                                disabled={false}
                                // Hide Mic button in this context
                                onMicClick={() => { }}
                                isRecording={false}
                            />
                        </div>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setDetectedKey(null)} // Retry
                                className="flex-1 py-3 bg-[#2c281b] hover:bg-[#393528] text-[#bab29c] rounded-lg font-bold transition-all"
                            >
                                Retry
                            </button>
                            <button
                                onClick={() => {
                                    if (!canApply) return;
                                    console.log("Applying Pitch:", targetSemitones);
                                    onApply(targetSemitones);
                                }}
                                disabled={!canApply}
                                title={!canApply ? "Import an audio file to apply pitch" : ""}
                                className={`flex-1 py-3 rounded-lg font-bold shadow-lg transition-all ${canApply
                                    ? 'bg-primary hover:bg-[#ffe066] text-black'
                                    : 'bg-[#393528] text-[#666] cursor-not-allowed'
                                    }`}
                            >
                                Apply Pitch
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveKeyDetectorModal;
