import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import * as Tone from 'tone';
import PitchWheel from '../components/PitchWheel';
import LiveKeyDetectorModal from '../components/LiveKeyDetectorModal';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../App';

// Track row component with Tone.js playback
const TrackRow = forwardRef(({ name, icon, color = "#bab29c", isHighlighted = false, onDownload, audioSrc, masterVolume = 100, globalPitchNode, useStreaming = false }, ref) => {
    const [muted, setMuted] = useState(false);
    const [solo, setSolo] = useState(false);
    const [volume, setVolume] = useState(70);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false); // Fix: Added missing state
    const [waveformData, setWaveformData] = useState([]);
    const [isLoadingWaveform, setIsLoadingWaveform] = useState(false);

    // Refs
    const playerRef = useRef(null); // Tone.Player (Buffer)
    const mediaElementRef = useRef(null); // HTMLAudioElement (Streaming)
    const sourceNodeRef = useRef(null); // Tone.MediaElementSource
    const soloNodeRef = useRef(null); // Tone.Channel
    const waveformRef = useRef(null);

    // Initial Setup
    useEffect(() => {
        if (!globalPitchNode) return;

        // Channel for Volume/Pan/Solo/Mute
        const channel = new Tone.Channel({ volume: 0, pan: 0 }).connect(globalPitchNode);
        soloNodeRef.current = channel;

        if (useStreaming) {
            // STREAMING MODE (For Source Audio - Prevents OOM)
            const audio = new Audio();
            audio.crossOrigin = "anonymous";
            audio.loop = false;

            // Sync events
            audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
            audio.ondurationchange = () => setDuration(audio.duration || 0);
            audio.onended = () => { /* Handle end if needed */ };

            // Fix: Tone.MediaElementSource doesn't exist. Use context.createMediaElementSource
            // and Tone.connect to bridge native node to Tone node.
            const source = Tone.context.createMediaElementSource(audio);
            Tone.connect(source, channel);

            mediaElementRef.current = audio;
            sourceNodeRef.current = source;
        } else {
            // BUFFER MODE (For Stems - Better Sync/Looping)
            const player = new Tone.Player().set({ fadeOut: 0.05 });
            player.connect(channel);
            playerRef.current = player;
        }

        // Cleanup
        return () => {
            if (playerRef.current) playerRef.current.dispose();
            // Fix: Native MediaElementSourceNode does not have .dispose(). Use .disconnect()
            if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
            if (soloNodeRef.current) soloNodeRef.current.dispose();
            if (mediaElementRef.current) {
                mediaElementRef.current.pause();
                mediaElementRef.current.src = "";
            }
        };
    }, [globalPitchNode, useStreaming]);

    // Expose control methods to parent component
    useImperativeHandle(ref, () => ({
        play: async () => {
            if (Tone.context.state !== 'running') await Tone.start();

            if (useStreaming) {
                if (mediaElementRef.current) {
                    // Primitive sync: jump to transport time if significant drift? 
                    // For now, simpler: user usually plays from 0 or seeks.
                    // If we want to sync with stems, we might need to seek.
                    if (Tone.Transport.state === 'started') {
                        const transportTime = Tone.Transport.seconds;
                        if (Math.abs(mediaElementRef.current.currentTime - transportTime) > 0.5) {
                            mediaElementRef.current.currentTime = transportTime;
                        }
                    }
                    try { await mediaElementRef.current.play(); } catch (e) { console.error("Play error:", e); }
                }
            } else {
                if (playerRef.current && playerRef.current.loaded) {
                    // Sync buffer players to Transport
                    playerRef.current.sync().start(0);
                }
            }
        },
        pause: () => {
            if (useStreaming && mediaElementRef.current) {
                mediaElementRef.current.pause();
            }
            // Buffer players handled by Transport.pause() usually
        },
        seekTo: (time) => {
            if (useStreaming && mediaElementRef.current) {
                mediaElementRef.current.currentTime = time;
                setCurrentTime(time);
            }
            // Buffer players seeking handled by Transport usually
        },
        getState: () => ({
            currentTime: useStreaming ? (mediaElementRef.current?.currentTime || 0) : Tone.Transport.seconds,
            duration: (useStreaming ? mediaElementRef.current?.duration : playerRef.current?.buffer?.duration) || 0,
            isPlaying: useStreaming ? !mediaElementRef.current?.paused : Tone.Transport.state === 'started'
        })
    }));

    // Load Audio Logic
    useEffect(() => {
        if (!audioSrc || !soloNodeRef.current) return;

        const loadAudio = async () => {
            setIsLoadingWaveform(true);
            try {
                if (useStreaming) {
                    // Stream Load
                    if (mediaElementRef.current) {
                        mediaElementRef.current.src = audioSrc;
                        mediaElementRef.current.load(); // Trigger load
                        // Wait for metadata
                        await new Promise((resolve) => {
                            mediaElementRef.current.onloadedmetadata = resolve;
                            // Fallback timeout
                            setTimeout(resolve, 3000);
                        });
                        setDuration(mediaElementRef.current.duration);
                    }
                } else {
                    // Buffer Load
                    if (playerRef.current) {
                        await playerRef.current.load(audioSrc);
                        setDuration(playerRef.current.buffer.duration);
                        playerRef.current.sync().start(0);
                    }
                }

                // WAVEFORM: Dummy for now to prevent crash
                setTimeout(() => {
                    setWaveformData(Array(100).fill(0.1));
                    setIsLoadingWaveform(false);
                }, 100);

            } catch (err) {
                console.error("Failed to load audio:", err);
                setIsLoadingWaveform(false);
            }
        };

        loadAudio();
    }, [audioSrc, globalPitchNode, useStreaming]);

    // Handle Volume/Mute/Solo changes
    useEffect(() => {
        if (soloNodeRef.current) {
            // Volume is in decibels. 0 is max (100%), -Infinity is silent.
            // Map 0-100 linear -> Decibels
            // Formula: 20 * log10(vol / 100) generic. Tone.gainToDb(vol/100)
            const gain = volume / 100;
            let db = Tone.gainToDb(Math.max(gain, 0.001)); // Prevent -Infinity issues if 0
            if (volume === 0) db = -100;

            soloNodeRef.current.volume.rampTo(db, 0.1);
            soloNodeRef.current.mute = muted;
            soloNodeRef.current.solo = solo;
            // Note: masterVolume is handled by main Transport/Destination or parent
        }
    }, [volume, muted, solo]);

    // Update UI for time/play state
    useEffect(() => {
        if (!playerRef.current) return;
        // Verify current playback state from Transport
        const interval = setInterval(() => {
            if (Tone.Transport.state === 'started') {
                setIsPlaying(true);
                setCurrentTime(Tone.Transport.seconds);
            } else {
                setIsPlaying(false);
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);


    // Handle Play/Pause (Global Transport or Local Stream)
    const togglePlay = async () => {
        if (Tone.context.state !== 'running') await Tone.start();

        if (useStreaming) {
            if (mediaElementRef.current) {
                if (mediaElementRef.current.paused) {
                    await mediaElementRef.current.play();
                    setIsPlaying(true);
                } else {
                    mediaElementRef.current.pause();
                    setIsPlaying(false);
                }
            }
        } else {
            // Buffer players are synced to transport
            if (Tone.Transport.state === 'started') {
                Tone.Transport.pause();
                setIsPlaying(false);
            } else {
                Tone.Transport.start();
                setIsPlaying(true);
            }
        }
    };

    // Handle seek
    const handleSeek = (e) => {
        if (!waveformRef.current || duration === 0) return;
        const rect = waveformRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * duration;

        Tone.Transport.seconds = newTime;
        setCurrentTime(newTime);
    };

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={`bg-[#1f1d16] border rounded-lg p-4 shadow-plate flex items-center gap-4 group transition-colors ${isHighlighted ? 'border-primary/50' : 'border-[#393528] hover:border-primary/30'}`}>

            {/* Play Button */}
            <button
                onClick={togglePlay}
                disabled={!audioSrc}
                className={`size-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-lg ${isPlaying
                    ? 'bg-primary text-black hover:brightness-110'
                    : 'bg-[#2c281b] text-primary hover:bg-[#393528] border border-[#393528]'
                    } ${!audioSrc ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isPlaying ? 'Pause' : 'Play'}
            >
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {isPlaying ? 'pause' : 'play_arrow'}
                </span>
            </button>

            <div className="w-8 h-full flex flex-col items-center justify-center gap-2 border-r border-[#393528] pr-4">
                <span
                    className="material-symbols-outlined text-2xl"
                    style={{ color: icon === 'mic' ? '#f2b90d' : color }}
                >
                    {icon}
                </span>
                <span className="text-[10px] font-bold text-[#bab29c] -rotate-90 whitespace-nowrap w-4 h-8 flex items-center justify-center">
                    {name.toUpperCase()}
                </span>
            </div>

            <div className="flex-1 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{name}.wav</span>
                        {name === 'Vocals' && (
                            <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded border border-primary/30">
                                AI ISOLATED
                            </span>
                        )}
                        <span className="text-[10px] text-[#666] font-mono">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMuted(!muted)}
                            className={`size-6 border text-[10px] font-bold rounded shadow-well transition-colors ${muted
                                ? 'bg-red-900/50 text-white border-red-800'
                                : 'bg-[#2c281b] text-[#bab29c] hover:text-white hover:bg-[#393528] border-[#393528]'
                                }`}
                        >
                            M
                        </button>
                        <button
                            onClick={() => setSolo(!solo)}
                            className={`size-6 border text-[10px] font-bold rounded shadow-well transition-colors ${solo
                                ? 'bg-yellow-900/50 text-white border-yellow-800'
                                : 'bg-[#2c281b] text-[#bab29c] hover:text-white hover:bg-[#393528] border-[#393528]'
                                }`}
                        >
                            S
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-[#12100c] p-2 rounded border border-[#2a261d] shadow-well">
                    {/* Volume slider */}
                    <div className="w-24 relative h-8 flex items-center px-1">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        />
                        <div className="absolute inset-x-2 h-1 bg-[#2c281b] rounded-full shadow-inner"></div>
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-6 bg-gradient-to-b from-[#555] to-[#222] rounded border border-[#666] shadow-lg cursor-grab z-10 flex items-center justify-center pointer-events-none"
                            style={{ left: `${volume}%`, marginLeft: `-${(volume / 100) * 16}px` }}
                        >
                            <div className="w-full h-[1px] bg-black"></div>
                        </div>
                    </div>

                    {/* Waveform with seek bar */}
                    <div
                        ref={waveformRef}
                        className="flex-1 h-10 relative overflow-hidden cursor-pointer"
                        onClick={handleSeek}
                    >
                        {isLoadingWaveform ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-xs text-[#666]">Loading waveform...</span>
                            </div>
                        ) : (
                            <>
                                {/* Background waveform bars */}
                                <div className="absolute inset-0 flex items-center gap-[1px]">
                                    {waveformData.map((amplitude, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-[#393528] rounded-sm"
                                            style={{ height: `${amplitude * 100}%` }}
                                        />
                                    ))}
                                </div>

                                {/* Progress overlay */}
                                <div
                                    className="absolute inset-y-0 left-0 overflow-hidden flex items-center gap-[1px]"
                                    style={{ width: `${progressPercent}%` }}
                                >
                                    {waveformData.map((amplitude, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 rounded-sm"
                                            style={{
                                                height: `${amplitude * 100}%`,
                                                backgroundColor: isHighlighted ? '#f2b90d' : '#bab29c',
                                                boxShadow: isHighlighted ? '0 0 4px rgba(242,185,13,0.5)' : 'none'
                                            }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-1">
                    <button
                        onClick={onDownload}
                        disabled={!audioSrc}
                        className="ml-auto px-3 py-1 bg-[#2c281b] hover:bg-[#393528] border border-[#393528] hover:border-primary/50 text-xs font-bold text-primary rounded shadow-plate flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-sm">download</span> Download
                    </button>
                </div>
            </div>
        </div>
    );
});

// Format time utility
const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};


// Screw component
const Screw = ({ className = '' }) => (
    <div className={`absolute size-3 rounded-full bg-[#2a261d] shadow-inner flex items-center justify-center border border-[#111] ${className}`}>
        <div className="w-1.5 h-0.5 bg-[#111] rotate-45"></div>
    </div>
);

export default function SplitterPage() {
    const api = useApi();
    const location = useLocation();

    const [masterVol, setMasterVol] = useState(70);
    const [stems, setStems] = useState(4);
    const [inputFile, setInputFile] = useState('');
    const [previewFilePath, setPreviewFilePath] = useState(null);
    const [previewTimestamp, setPreviewTimestamp] = useState(0); // Cache buster
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStep, setProgressStep] = useState('');
    const [outputFiles, setOutputFiles] = useState([]);
    const [error, setError] = useState('');
    const [selectedFileName, setSelectedFileName] = useState('');
    const [selectedFile, setSelectedFile] = useState(null); // Store actual File object for upload
    const [model, setModel] = useState('BS-Roformer-ViperX-1297'); // Default to best BS-RoFormer model
    const [importedFromDownloader, setImportedFromDownloader] = useState(false);
    const [showDownloadDialog, setShowDownloadDialog] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState('WAV');
    const [downloadOutputFolder, setDownloadOutputFolder] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [isAllPlaying, setIsAllPlaying] = useState(false);
    const fileInputRef = useRef(null);

    // Pitch State
    const [detectedKey, setDetectedKey] = useState(null);
    const [targetSemitones, setTargetSemitones] = useState(0);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showMicModal, setShowMicModal] = useState(false); // Modal State
    const [stemsInvalidated, setStemsInvalidated] = useState(false); // Validation State

    // Tone.js Global Pitch Node
    const [globalPitchNode, setGlobalPitchNode] = useState(null);

    // Initialize Tone.PitchShift
    useEffect(() => {
        // Create a PitchShift node connected to Destination (Master)
        const pitchShift = new Tone.PitchShift({
            pitch: 0,
            windowSize: 0.1, // Default
        }).toDestination();

        setGlobalPitchNode(pitchShift);

        return () => {
            pitchShift.dispose();
        };
    }, []);

    // Update Pitch in Real-Time
    useEffect(() => {
        if (globalPitchNode) {
            globalPitchNode.pitch = targetSemitones;
        }
    }, [targetSemitones, globalPitchNode]);


    // Refs for each track to control playback
    const trackRefs = useRef({});

    // Play all tracks simultaneously
    const playAllTracks = () => {
        Object.values(trackRefs.current).forEach(ref => {
            if (ref?.play) ref.play();
        });
        setIsAllPlaying(true);
    };

    // Pause all tracks
    const pauseAllTracks = () => {
        Object.values(trackRefs.current).forEach(ref => {
            if (ref?.pause) ref.pause();
        });
        setIsAllPlaying(false);
    };

    // Toggle play/pause all
    const togglePlayAll = () => {
        if (isAllPlaying) {
            pauseAllTracks();
        } else {
            playAllTracks();
        }
    };

    // Sync all tracks to the first track's current time
    const syncAllTracks = () => {
        const trackKeys = Object.keys(trackRefs.current);
        if (trackKeys.length === 0) return;

        // Get the current time from the first available track
        const firstTrack = trackRefs.current[trackKeys[0]];
        if (!firstTrack?.getState) return;

        const { currentTime } = firstTrack.getState();

        // Set all tracks to the same time
        Object.values(trackRefs.current).forEach(ref => {
            if (ref?.seekTo) ref.seekTo(currentTime);
        });
    };

    // Handle file import from Downloader page
    useEffect(() => {
        if (location.state?.filePath && location.state?.fromDownloader) {
            const filePath = location.state.filePath;
            const fileName = location.state.fileName || filePath.split(/[/\\]/).pop();

            setInputFile(filePath);
            setSelectedFileName(fileName);
            setOutputFiles([]);
            setError('');
            setImportedFromDownloader(true);

            // Clear the navigation state to avoid re-importing on page refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Source Audio Management
    const [playableAudioSrc, setPlayableAudioSrc] = useState(null);
    const [isConverting, setIsConverting] = useState(false);

    useEffect(() => {
        const prepareAudio = async () => {
            if (selectedFile) {
                // Browser mode: Use Blob URL (usually safe)
                setPlayableAudioSrc(URL.createObjectURL(selectedFile));
                return;
            }

            if (inputFile) {
                // Electron mode: Convert to WAV first to avoid decoding hangs
                setIsConverting(true);
                try {
                    // Call Backend to convert
                    const response = await fetch(`${api?.backendUrl}/api/convert/wav`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ input_path: inputFile })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Normalize path for Windows (replace backslashes with forward slashes)
                        // And use triple slash file:/// for properly formed URLs
                        const rawPath = data.output_path;
                        const normalizedPath = rawPath.replace(/\\/g, '/');
                        setPlayableAudioSrc(`file:///${normalizedPath}`);
                    } else {
                        console.error("Conversion failed, falling back to raw path");
                        const normalizedInput = inputFile.replace(/\\/g, '/');
                        setPlayableAudioSrc(`file:///${normalizedInput}`);
                    }
                } catch (e) {
                    console.error("Conversion error:", e);
                    const normalizedInput = inputFile.replace(/\\/g, '/');
                    setPlayableAudioSrc(`file:///${normalizedInput}`);
                }
                setIsConverting(false);
            } else {
                setPlayableAudioSrc(null);
            }
        };

        prepareAudio();
    }, [selectedFile, inputFile, api?.backendUrl]);

    // Auto-analyze pitch whenever inputFile changes
    useEffect(() => {
        if (inputFile && !isAnalyzing) {
            setDetectedKey(null); // Reset previous key
            analyzeFileKey(inputFile);
        }
    }, [inputFile]);

    // Auto-upload for browser mode to trigger analysis
    useEffect(() => {
        const autoUpload = async () => {
            if (selectedFile && !inputFile) {
                try {
                    const uploadedPath = await uploadFile(selectedFile);
                    setInputFile(uploadedPath);
                } catch (err) {
                    console.error("Auto-upload failed:", err);
                }
            }
        };
        autoUpload();
    }, [selectedFile]);



    // Refresh Page
    const handleRefresh = () => {
        window.location.reload();
    };

    // Available BS-RoFormer models
    const availableModels = [
        { id: 'BS-Roformer-ViperX-1297', name: 'BS-RoFormer ViperX 1297', quality: 'Excellent', description: 'State-of-the-art vocal separation' },
        { id: 'BS-Roformer-ViperX-1296', name: 'BS-RoFormer ViperX 1296', quality: 'Excellent', description: 'Alternative checkpoint with great quality' },
        { id: 'mel_band_roformer', name: 'Mel-Band RoFormer', quality: 'Very High', description: 'Mel-band variant for high quality' },
        { id: 'htdemucs', name: 'HT Demucs (4-Stem)', quality: 'High', description: '4 stem separation (vocals, drums, bass, other)' }
    ];

    // Handle file import from Downloader
    useEffect(() => {
        if (location.state?.fromDownloader && location.state?.filePath) {
            setInputFile(location.state.filePath);
            setSelectedFileName(location.state.fileName || location.state.filePath);
        }
    }, [location.state]);

    // Helper: Upload file to server
    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${api.backendUrl}/api/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        return data.file_path;
    };


    // Handle file selection (Browser Mode)
    const handleSelectFile = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setSelectedFile(file);
            setSelectedFileName(file.name);

            // Reset State
            setInputFile(''); // Clear path until uploaded
            setOutputFiles([]);
            setError('');
            setProgress(0);
            setProcessing(false);
            setStemsInvalidated(false);
            setDetectedKey(null);
            setTargetSemitones(0);
        }
    };



    // Helper: Calculate Target Pitch Name
    const getTargetPitch = (current, semitones) => {
        if (!current || semitones === 0) return null;
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const normalize = (n) => (n.match(/([A-G]#?)/) || [])[1] || 'C';
        const currentNote = normalize(current);
        const idx = notes.indexOf(currentNote);
        if (idx === -1) return null;

        let targetIdx = (idx + semitones) % 12;
        if (targetIdx < 0) targetIdx += 12;
        return notes[targetIdx];
    };

    // Analyze Key
    const analyzeFileKey = async (path) => {
        setIsAnalyzing(true);
        try {
            const result = await api?.analyzePitch(path);
            if (result && result.key) {
                setDetectedKey(result.full_key); // "C Major"
            }
        } catch (err) {
            console.error("Pitch analysis failed:", err);
        }
        setIsAnalyzing(false);
    };

    // Process Pitch Shift
    const handlePitchShift = async (path, semitones) => {
        setIsPitchShifting(true);
        setProgressStep('Shifting Pitch...');
        try {
            const result = await api?.processPitch(path, semitones);
            if (result && result.success) {
                return result.output_path;
            }
            throw new Error("Pitch shift failed");
        } catch (err) {
            throw err; // Let caller handle
        } finally {
            setIsPitchShifting(false);
        }
    };

    // --- Mic Modal Handler ---
    const handleMicClick = () => {
        setShowMicModal(true);
    };

    const handleMicGlobalApply = (semitones) => {
        setTargetSemitones(semitones);
        setShowMicModal(false);
    };

    // Mark stems invalid if pitch changes AFTER split
    useEffect(() => {
        if (outputFiles.length > 0 && targetSemitones !== 0) {
            // Logic: If we have output files, and user changes semitones, 
            // we *should* check if these files were generated with current semitones.
            // But for now, any change after split triggers this warning.
            // We'll simplisticly set it if outputFiles exist. (Ideally we'd store 'splitSemitones')
            setStemsInvalidated(true);
        }
    }, [targetSemitones]);

    // Reset invalidated state when splitting starts
    useEffect(() => {
        if (processing) {
            setStemsInvalidated(false);
        }
    }, [processing]);

    const handleSplit = async () => {
        if (!inputFile && !selectedFile) {
            setError('Please select an audio file first');
            return;
        }

        setProcessing(true);
        setProgress(0);
        setError('');

        let filePathToSplit = inputFile;

        // In browser mode, upload the file first
        if (selectedFile && !inputFile) {
            setProgressStep('Uploading file...');
            try {
                filePathToSplit = await uploadFile(selectedFile);
                setInputFile(filePathToSplit);
            } catch (err) {
                setError(`Upload failed: ${err.message}`);
                setProcessing(false);
                return;
            }
        }

        // --- Pitch Processing Step ---
        if (targetSemitones !== 0) {
            setProgressStep(`Transposing Audio (${targetSemitones > 0 ? '+' : ''}${targetSemitones})...`);
            try {
                // Shift pitch before splitting
                const shiftedPath = await handlePitchShift(filePathToSplit, targetSemitones);
                filePathToSplit = shiftedPath; // Use the shifted file for splitting
                console.log("Using shifted file for split:", shiftedPath);
            } catch (err) {
                setError(`Pitch shift failed: ${err.message}`);
                setProcessing(false);
                return;
            }
        }
        // -----------------------------

        setProgressStep('Starting split...');

        try {
            const result = await api?.startSplit({
                input_file: filePathToSplit,
                stems,
                format: 'wav',
                model: model
            });

            if (result?.error) {
                throw new Error(result.error);
            }

            const splitId = result.id;

            // Poll for progress
            const pollProgress = async () => {
                try {
                    const progressData = await api?.getSplitProgress(splitId);

                    setProgress(progressData.progress || 0);
                    setProgressStep(progressData.current_step || progressData.status);

                    if (progressData.status === 'completed') {
                        setProcessing(false);
                        setOutputFiles(progressData.output_files || []);
                        setProgress(100);
                        setProgressStep('Complete!');
                    } else if (progressData.status === 'failed') {
                        throw new Error(progressData.error || 'Splitting failed');
                    } else if (progressData.status !== 'cancelled') {
                        setTimeout(pollProgress, 1000);
                    }
                } catch (err) {
                    setError(err.message);
                    setProcessing(false);
                }
            };

            pollProgress();
        } catch (err) {
            setError(err.message);
            setProcessing(false);
        }
    };

    // Stem Players Section - update to show invalidation warning
    const stemTracks = stems === 4
        ? [
            { name: 'Vocals', icon: 'mic' },
            { name: 'Drums', icon: 'album' },
            { name: 'Bass', icon: 'music_note' },
            { name: 'Other', icon: 'graphic_eq' }
        ]
        : [
            { name: 'Vocals', icon: 'mic' },
            { name: 'Accompaniment', icon: 'graphic_eq' }
        ];

    return (
        <div className="h-full overflow-auto flex flex-col">
            {/* Hidden file input for browser mode */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".mp3,.wav,.flac,.aac,.m4a,.ogg,audio/*"
                onChange={handleFileChange}
            />
            <main className="flex flex-1 overflow-auto relative">
                <div
                    className="absolute inset-0 bg-[#181611] z-0"
                    style={{ backgroundImage: "radial-gradient(#2c281b 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                ></div>

                <div className="flex flex-col w-full max-w-6xl mx-auto z-10 p-6 h-full overflow-y-auto">
                    {/* Import Section */}
                    <section className="bg-[#1f1d16] border border-[#393528] rounded-xl p-6 shadow-plate mb-6 relative overflow-hidden">
                        <Screw className="top-3 left-3" />
                        <Screw className="top-3 right-3" />
                        <Screw className="bottom-3 left-3" />
                        <Screw className="bottom-3 right-3" />

                        <button
                            onClick={handleRefresh}
                            className="absolute top-3 right-3 p-2 text-[#666] hover:text-white transition-colors z-20"
                            title="Refresh Page"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>

                        <div className="flex flex-col md:flex-row gap-8 items-center justify-between px-4">
                            <div className="flex-1 w-full space-y-4">
                                <label className="text-[#bab29c] text-xs font-bold uppercase tracking-widest ml-1">
                                    Import Audio Source
                                </label>
                                <div className="flex gap-3">
                                    <div className="flex-1 relative group min-w-0">
                                        <button
                                            onClick={handleSelectFile}
                                            className="flex items-center justify-between w-full h-12 bg-[#12100c] border border-[#393528] rounded cursor-pointer px-4 hover:border-primary/50 transition-all shadow-well group-hover:shadow-gold-glow overflow-hidden"
                                        >
                                            <span className="text-[#bab29c] font-mono text-sm group-hover:text-white truncate flex-1 text-left mr-2 overflow-hidden text-ellipsis whitespace-nowrap">
                                                {selectedFileName || 'Select Audio File...'}
                                            </span>
                                            <span className="material-symbols-outlined text-primary shrink-0">folder_open</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Source Player */}
                                {(playableAudioSrc || isConverting) && (
                                    <div className="relative">
                                        <TrackRow
                                            ref={el => trackRefs.current['original'] = el}
                                            name={isConverting ? "Converting..." : "Original Mix"}
                                            icon="music_note"
                                            color="#f2b90d"
                                            audioSrc={playableAudioSrc}
                                            masterVolume={masterVol}
                                            globalPitchNode={globalPitchNode} // Pass the node
                                            onDownload={() => { /* Handle download if needed */ }}
                                            useStreaming={true} // ENABLE STREAMING TO FIX OOM CRASH
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    {/* Stem Count */}
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[#bab29c] text-[10px] font-bold uppercase tracking-wider ml-1">
                                            Stem Count
                                        </span>
                                        <div className="relative bg-[#12100c] p-1 rounded-full border border-[#393528] shadow-well flex w-fit">
                                            <div
                                                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-[#393528] rounded-full transition-all duration-300 transform ${stems === 4 ? 'translate-x-full left-1' : 'left-1'
                                                    }`}
                                            ></div>
                                            <button
                                                onClick={() => setStems(2)}
                                                className={`relative z-10 px-6 py-1.5 text-xs font-bold transition-colors ${stems === 2 ? 'text-primary' : 'text-[#bab29c]'
                                                    }`}
                                            >
                                                2 STEMS
                                            </button>
                                            <button
                                                onClick={() => setStems(4)}
                                                className={`relative z-10 px-6 py-1.5 text-xs font-bold transition-colors ${stems === 4 ? 'text-primary' : 'text-[#bab29c]'
                                                    }`}
                                            >
                                                4 STEMS
                                            </button>
                                        </div>
                                    </div>

                                    {/* AI Model */}
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[#bab29c] text-[10px] font-bold uppercase tracking-wider ml-1">
                                            AI Model (Quality)
                                        </span>
                                        <select
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            className="w-full bg-[#12100c] text-[#bab29c] border border-[#393528] rounded-lg px-3 py-2 text-sm focus:border-primary focus:ring-0 focus:outline-none shadow-well skeuo-select cursor-pointer hover:border-primary/50 transition-colors"
                                        >
                                            {availableModels.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} - {m.quality}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Split Button */}
                                <div className="pt-2">
                                    <button
                                        onClick={handleSplit}
                                        disabled={processing || (!inputFile && !selectedFile)}
                                        className="w-full h-14 bg-gradient-to-b from-[#f2b90d] to-[#b38600] text-black font-bold text-lg tracking-widest uppercase rounded shadow-[0_0_15px_rgba(242,185,13,0.4)] hover:shadow-[0_0_25px_rgba(242,185,13,0.6)] hover:brightness-110 active:scale-[0.98] transition-all border-t border-[#ffe066] border-b border-[#806000] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {processing ? (
                                            <>
                                                <span className="material-symbols-outlined animate-spin">autorenew</span>
                                                {progressStep}
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined">call_split</span>
                                                Split Audio
                                            </>
                                        )}
                                    </button>
                                    {processing && (
                                        <div className="w-full h-2 bg-[#12100c] rounded-full overflow-hidden mt-2">
                                            <div
                                                className="h-full bg-primary transition-all duration-300"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                            </div>

                            <div className="flex flex-col items-center gap-4 min-w-[300px]">
                                {/* Pitch Wheel Panel */}
                                <div className="flex flex-col items-center justify-center p-4 bg-[#12100c] rounded-lg border border-[#2a261d] shadow-inner relative w-full h-full min-h-[300px]">
                                    <div className="absolute top-2 left-3 text-[10px] font-bold text-[#666] uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">music_note</span>
                                        Pitch Control
                                    </div>

                                    {isAnalyzing ? (
                                        <div className="flex flex-col items-center justify-center h-48 w-48 gap-3">
                                            <span className="material-symbols-outlined animate-spin text-primary">autorenew</span>
                                            <span className="text-xs text-[#666]">Analyzing Key...</span>
                                        </div>
                                    ) : (
                                        <PitchWheel
                                            currentPitch={detectedKey || 'C'}
                                            targetPitch={getTargetPitch(detectedKey || 'C', targetSemitones)}
                                            onChange={setTargetSemitones}
                                            onMicClick={handleMicClick}
                                            isRecording={false} // State moved to modal
                                            disabled={processing || !inputFile} // Slider disabled if no file
                                            micDisabled={processing} // Mic enabled unless processing
                                        />
                                    )}

                                    <div className="mt-2 text-center h-4">
                                        {detectedKey && (
                                            <span className="text-xs text-primary font-mono">
                                                Detected: {detectedKey}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Tracks Section */}
                    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 pb-4">
                            {/* Playback Control Bar */}
                            {outputFiles.length > 0 && (
                                <>
                                    {/* Invalidation Warning */}
                                    {stemsInvalidated && (
                                        <div className="bg-red-900/40 border border-red-500/50 p-3 rounded-lg mb-4 flex items-center gap-3 animate-fade-in">
                                            <span className="material-symbols-outlined text-red-400">warning</span>
                                            <div className="flex-1">
                                                <p className="text-white text-sm font-bold">Pitch Changed</p>
                                                <p className="text-red-200 text-xs">The current stems do not match the selected pitch. Please click "Split Audio" again to update them.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-[#1f1d16] border border-[#393528] rounded-lg p-4 shadow-plate flex items-center gap-4 sticky top-0 z-10">
                                        {/* Big Play All Button */}
                                        <button
                                            onClick={togglePlayAll}
                                            className={`size-14 rounded-full flex items-center justify-center transition-all shadow-lg ${isAllPlaying
                                                ? 'bg-primary text-black hover:brightness-110'
                                                : 'bg-gradient-to-br from-primary to-yellow-600 text-black hover:brightness-110'
                                                }`}
                                            title={isAllPlaying ? 'Pause All' : 'Play All Tracks'}
                                        >
                                            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                {isAllPlaying ? 'pause' : 'play_arrow'}
                                            </span>
                                        </button>

                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-sm">
                                                {isAllPlaying ? 'Playing All Tracks' : 'Play All Tracks'}
                                            </span>
                                            <span className="text-[#666] text-xs">
                                                {outputFiles.length} stems loaded
                                            </span>
                                        </div>

                                        <div className="ml-auto flex gap-2">
                                            {/* Sync Button */}
                                            <button
                                                onClick={syncAllTracks}
                                                className="px-4 py-2 bg-[#2c281b] hover:bg-[#393528] border border-[#393528] hover:border-primary/50 rounded-lg font-bold text-sm text-[#bab29c] hover:text-white transition-all flex items-center gap-2"
                                                title="Sync all tracks to the same time position"
                                            >
                                                <span className="material-symbols-outlined text-lg">sync</span>
                                                Sync All
                                            </button>

                                            {/* Stop All Button */}
                                            <button
                                                onClick={() => {
                                                    pauseAllTracks();
                                                    // Seek all to beginning
                                                    Object.values(trackRefs.current).forEach(ref => {
                                                        if (ref?.seekTo) ref.seekTo(0);
                                                    });
                                                }}
                                                className="px-4 py-2 bg-[#2c281b] hover:bg-red-900/50 border border-[#393528] hover:border-red-800 rounded-lg font-bold text-sm text-[#bab29c] hover:text-white transition-all flex items-center gap-2"
                                                title="Stop all tracks and reset to beginning"
                                            >
                                                <span className="material-symbols-outlined text-lg">stop</span>
                                                Stop
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                            {stemTracks.map((track) => {
                                // Find matching output file for this track
                                // Support multiple naming conventions from different separators
                                const outputFile = outputFiles.find(f => {
                                    const lowerFile = f.toLowerCase();
                                    const lowerTrack = track.name.toLowerCase();

                                    // Direct match
                                    if (lowerFile.includes(lowerTrack)) return true;

                                    // Handle 'Accompaniment' -> 'Instrumental'/'No Vocals' mapping
                                    if (lowerTrack === 'accompaniment') {
                                        return lowerFile.includes('instrumental') ||
                                            lowerFile.includes('no_vocals') ||
                                            lowerFile.includes('no-vocals') ||
                                            lowerFile.includes('music') ||
                                            lowerFile.includes('karaoke');
                                    }

                                    return false;
                                });
                                // Build audio URL if file exists
                                const audioSrc = outputFile
                                    ? `${api?.backendUrl}/api/files/serve?path=${encodeURIComponent(outputFile)}`
                                    : null;

                                return (
                                    <TrackRow
                                        key={track.name}
                                        ref={el => { trackRefs.current[track.name] = el; }}
                                        name={track.name}
                                        icon={track.icon}
                                        color={track.color}
                                        isHighlighted={track.name === 'Vocals'}
                                        audioSrc={audioSrc}
                                        masterVolume={masterVol}
                                        globalPitchNode={globalPitchNode} // Pass the node
                                        onDownload={() => {
                                            if (outputFile) {
                                                // Trigger download by opening in new tab
                                                window.open(audioSrc, '_blank');
                                            }
                                        }}
                                    />
                                );
                            })}
                        </div>

                        {/* Master Volume Section */}
                        <div className="w-full lg:w-64 shrink-0">
                            <div className="bg-[#1f1d16] border border-[#393528] rounded-xl p-6 shadow-plate h-full flex flex-col items-center justify-between relative min-h-[300px]">
                                <Screw className="top-3 left-3" />
                                <Screw className="top-3 right-3" />
                                <Screw className="bottom-3 left-3" />
                                <Screw className="bottom-3 right-3" />

                                <h3 className="text-[#bab29c] font-bold text-sm uppercase tracking-wider mb-4 border border-[#bab29c]/30 px-3 py-1 rounded">
                                    Master Volume
                                </h3>

                                {/* DJ-Style Vertical Fader */}
                                <div className="relative w-20 h-64 mb-6">
                                    {/* Fader track - brushed metal look */}
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 w-16 h-full rounded-2xl"
                                        style={{
                                            background: 'linear-gradient(90deg, #3a3a3a 0%, #5a5a5a 20%, #6a6a6a 50%, #5a5a5a 80%, #3a3a3a 100%)',
                                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -2px 4px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.5)',
                                            border: '1px solid #2a2a2a'
                                        }}
                                    >
                                        {/* Inner track groove */}
                                        <div
                                            className="absolute left-1/2 -translate-x-1/2 top-4 bottom-4 w-3 rounded-full"
                                            style={{
                                                background: 'linear-gradient(90deg, #1a1a1a 0%, #0a0a0a 50%, #1a1a1a 100%)',
                                                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9), inset 0 -1px 2px rgba(255,255,255,0.05)'
                                            }}
                                        />

                                        {/* Side grooves for grip texture */}
                                        <div className="absolute left-1 top-8 bottom-8 w-1 rounded-full opacity-30"
                                            style={{ background: 'linear-gradient(180deg, transparent, #000 10%, #000 90%, transparent)' }}
                                        />
                                        <div className="absolute right-1 top-8 bottom-8 w-1 rounded-full opacity-30"
                                            style={{ background: 'linear-gradient(180deg, transparent, #000 10%, #000 90%, transparent)' }}
                                        />
                                    </div>

                                    {/* Interactive slider area */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={masterVol}
                                        onChange={(e) => setMasterVol(Number(e.target.value))}
                                        className="absolute left-1/2 -translate-x-1/2 w-56 h-8 cursor-pointer opacity-0 z-20"
                                        style={{
                                            transform: 'translateX(-50%) rotate(-90deg)',
                                            transformOrigin: 'center center',
                                            top: 'calc(50% - 16px)'
                                        }}
                                    />

                                    {/* Fader knob */}
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 w-14 h-12 rounded-lg z-10 pointer-events-none transition-all duration-75"
                                        style={{
                                            top: `calc(${100 - masterVol}% * 0.75 + 8%)`,
                                            background: 'linear-gradient(180deg, #8a8a8a 0%, #6a6a6a 20%, #5a5a5a 50%, #4a4a4a 80%, #3a3a3a 100%)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.3)',
                                            border: '1px solid #2a2a2a'
                                        }}
                                    >
                                        {/* Knob grip lines */}
                                        <div className="absolute inset-x-2 top-3 bottom-3 flex flex-col justify-center gap-1">
                                            <div className="w-full h-0.5 bg-black/20 rounded" />
                                            <div className="w-full h-0.5 bg-black/20 rounded" />
                                            <div className="w-full h-0.5 bg-black/20 rounded" />
                                        </div>

                                        {/* Orange indicator line */}
                                        <div
                                            className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-8 h-1 rounded-full"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, #f2b90d 20%, #f2b90d 80%, transparent)',
                                                boxShadow: '0 0 8px rgba(242, 185, 13, 0.6)'
                                            }}
                                        />
                                    </div>

                                    {/* Volume percentage display */}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-[#bab29c] font-mono">
                                        {masterVol}%
                                    </div>
                                </div>

                                {/* VU Meters */}
                                <div className="w-full flex justify-center gap-2 mb-4">
                                    {[0, 1].map((i) => (
                                        <div
                                            key={i}
                                            className="w-2 h-20 bg-[#12100c] rounded-full border border-[#393528] p-0.5 flex flex-col justify-end gap-0.5 shadow-well"
                                        >
                                            <div className="h-1 w-full bg-red-500 rounded-sm opacity-20"></div>
                                            <div className="h-1 w-full bg-yellow-500 rounded-sm opacity-20"></div>
                                            <div className="h-1 w-full bg-green-500 rounded-sm"></div>
                                            <div className="h-1 w-full bg-green-500 rounded-sm"></div>
                                            <div className="h-1 w-full bg-green-500 rounded-sm"></div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => {
                                        setSaveMessage('');
                                        setShowDownloadDialog(true);
                                    }}
                                    disabled={outputFiles.length === 0}
                                    className="w-full py-2 bg-primary hover:brightness-110 text-black rounded shadow-plate font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Download All Stems
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main >

            {/* Download Format Dialog */}
            {
                showDownloadDialog && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
                        <div className="bg-[#1f1d16] border border-[#393528] rounded-xl p-6 shadow-2xl max-w-lg w-full mx-4">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">download</span>
                                Download All Stems
                            </h3>

                            {/* Output Folder Selection */}
                            <div className="mb-4">
                                <label className="text-[#bab29c] text-xs font-bold uppercase tracking-wider mb-2 block">
                                    Save To Folder
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-[#12100c] border border-[#2a261d] rounded p-3 overflow-hidden">
                                        <span className="text-xs text-[#bab29c] font-mono break-all">
                                            {downloadOutputFolder || outputFiles[0]?.replace(/[/\\][^/\\]+$/, '') || 'Select a folder...'}
                                        </span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const folder = await api?.browseForFolder('Select Output Folder');
                                            if (folder) {
                                                setDownloadOutputFolder(folder);
                                            }
                                        }}
                                        className="px-4 py-2 bg-[#2c281b] hover:bg-[#393528] text-[#bab29c] border border-[#393528] rounded font-bold text-sm transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-lg">folder_open</span>
                                        Browse
                                    </button>
                                </div>
                            </div>

                            {/* Format Selection */}
                            <div className="mb-6">
                                <label className="text-[#bab29c] text-xs font-bold uppercase tracking-wider mb-2 block">
                                    Output Format
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDownloadFormat('WAV')}
                                        disabled={isSaving}
                                        className={`flex-1 py-3 rounded border font-bold text-sm transition-all ${downloadFormat === 'WAV'
                                            ? 'bg-primary text-black border-primary'
                                            : 'bg-[#2c281b] text-[#bab29c] border-[#393528] hover:border-primary/50'
                                            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        WAV (Lossless)
                                    </button>
                                    <button
                                        onClick={() => setDownloadFormat('MP3')}
                                        disabled={isSaving}
                                        className={`flex-1 py-3 rounded border font-bold text-sm transition-all ${downloadFormat === 'MP3'
                                            ? 'bg-primary text-black border-primary'
                                            : 'bg-[#2c281b] text-[#bab29c] border-[#393528] hover:border-primary/50'
                                            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        MP3 (320kbps)
                                    </button>
                                    <button
                                        onClick={() => setDownloadFormat('FLAC')}
                                        disabled={isSaving}
                                        className={`flex-1 py-3 rounded border font-bold text-sm transition-all ${downloadFormat === 'FLAC'
                                            ? 'bg-primary text-black border-primary'
                                            : 'bg-[#2c281b] text-[#bab29c] border-[#393528] hover:border-primary/50'
                                            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        FLAC
                                    </button>
                                </div>
                            </div>

                            {/* Save Message */}
                            {saveMessage && (
                                <div className={`mb-4 p-3 rounded text-sm ${saveMessage.includes('Success') ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                                    {saveMessage}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowDownloadDialog(false);
                                        setSaveMessage('');
                                    }}
                                    disabled={isSaving}
                                    className="flex-1 py-2 bg-[#2c281b] hover:bg-[#393528] text-[#bab29c] border border-[#393528] rounded font-bold text-sm transition-all disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        const targetFolder = downloadOutputFolder || outputFiles[0]?.replace(/[/\\][^/\\]+$/, '');
                                        if (!targetFolder) {
                                            setSaveMessage('Please select an output folder first.');
                                            return;
                                        }

                                        setIsSaving(true);
                                        setSaveMessage('');

                                        try {
                                            // Call backend to export stems
                                            const response = await fetch(`${api?.backendUrl}/api/split/export`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    source_files: outputFiles,
                                                    output_folder: targetFolder,
                                                    format: downloadFormat.toLowerCase()
                                                })
                                            });

                                            const data = await response.json();

                                            if (response.ok && data.success) {
                                                setSaveMessage(`Success! ${data.files_saved} stems saved to ${targetFolder}`);
                                                // Open the folder after successful save
                                                setTimeout(() => {
                                                    api?.openFolder(targetFolder);
                                                    setShowDownloadDialog(false);
                                                    setSaveMessage('');
                                                }, 1500);
                                            } else {
                                                setSaveMessage(data.error || 'Failed to save stems');
                                            }
                                        } catch (err) {
                                            setSaveMessage(`Error: ${err.message}`);
                                        }

                                        setIsSaving(false);
                                    }}
                                    disabled={isSaving}
                                    className="flex-1 py-2 bg-primary hover:brightness-110 text-black rounded font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <>
                                            <span className="material-symbols-outlined text-lg animate-spin">autorenew</span>
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-lg">save</span>
                                            Save Stems
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Live Key Detection Modal */}
            {showMicModal && (
                <LiveKeyDetectorModal
                    onClose={() => setShowMicModal(false)}
                    onApply={handleMicGlobalApply}
                    api={api}
                    uploadFile={uploadFile}
                    songKey={detectedKey}
                    canApply={!!inputFile || !!selectedFile} // Only allow apply if file exists
                />
            )}
        </div >
    );
}
