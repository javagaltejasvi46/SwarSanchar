import React, { useState, useEffect, useRef } from 'react';

// Pitch class mapping
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const PitchWheel = ({ currentPitch = 'C', targetPitch, onChange, onMicClick, isRecording, disabled = false, micDisabled = false }) => {
    // Current rotation derived from currentPitch
    // Target rotation derived from targetPitch (user selection)

    // Normalize pitch (handle minor/major or extra text)
    const normalizeNote = (p) => {
        if (!p) return 'C';
        // Extract note part (e.g., "C# Major" -> "C#")
        const match = p.match(/([A-G]#?)/);
        return match ? match[1] : 'C';
    };

    const currentNote = normalizeNote(currentPitch);
    const targetNote = targetPitch ? normalizeNote(targetPitch) : currentNote;

    // Calculate Semitone Difference (Target - Current)
    const getSemitoneDiff = (current, target) => {
        const idx1 = NOTES.indexOf(current);
        const idx2 = NOTES.indexOf(target);
        if (idx1 === -1 || idx2 === -1) return 0;

        // Shortest path logic (e.g. C to B is -1, not +11)
        let diff = idx2 - idx1;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        return diff;
    };

    const semitones = getSemitoneDiff(currentNote, targetNote);

    // Handle manual semitone change
    const [manualSemitones, setManualSemitones] = useState(0);

    useEffect(() => {
        setManualSemitones(semitones);
    }, [semitones]);

    const handleNoteClick = (note) => {
        if (disabled) return;
        // Calculate new semitones based on click
        // But also we need to know if we want to set TARGET pitch or simply ADD semitones
        // The prompt asks to "move the needle by clicking on a letter"
        // So clicking 'D' when Logic is 'C' should set Target to 'D' (+2 semitones)

        const diff = getSemitoneDiff(currentNote, note);
        onChange(diff); // Parent handles state update
    };

    // Calculate rotation for the "Needle"
    // Visual: C is at top (0 deg). 
    // Degree per note = 360 / 12 = 30 deg
    const getRotationForNote = (note) => {
        const idx = NOTES.indexOf(note);
        return idx * 30;
    };

    // Needle points to Target Note relative to the Wheel
    // Real looking wheel: Labels are fixed, Needle moves
    const needleRotation = getRotationForNote(targetNote);

    return (
        <div className="flex flex-col items-center gap-4 select-none">
            {/* The Wheel */}
            <div className={`relative w-48 h-48 rounded-full bg-[#181611] shadow-[0_0_20px_rgba(0,0,0,0.5),inset_0_0_30px_rgba(0,0,0,0.8)] border-4 border-[#2c281b] flex items-center justify-center ${disabled ? 'opacity-50 grayscale' : ''}`}>

                {/* Decorative gradients */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>

                {/* Notes Ring */}
                {NOTES.map((note, i) => {
                    const angle = i * 30; // 0 is top (C)
                    // Transform helps position notes in a circle
                    // We need to rotate the CONTAINER of the text, then counter-rotate the TEXT so it stays upright
                    const radius = 75; // px
                    const x = Math.sin(angle * (Math.PI / 180)) * radius;
                    const y = -Math.cos(angle * (Math.PI / 180)) * radius;

                    const isCurrent = note === currentNote;
                    const isTarget = note === targetNote;

                    return (
                        <div
                            key={note}
                            onClick={() => handleNoteClick(note)}
                            className={`absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer z-20 
                                ${isTarget ? 'text-black bg-primary shadow-[0_0_10px_rgba(242,185,13,0.8)] scale-125' :
                                    isCurrent ? 'text-white bg-[#333] border border-[#666]' :
                                        'text-[#666] hover:text-white hover:bg-[#222]'}`}
                            style={{
                                left: `calc(50% + ${x}px)`,
                                top: `calc(50% + ${y}px)`,
                            }}
                        >
                            {note}
                        </div>
                    );
                })}

                {/* Center Hub/Needle Base */}
                <div className="absolute w-16 h-16 rounded-full bg-[#2c281b] shadow-[0_5px_10px_rgba(0,0,0,0.5)] z-10 flex items-center justify-center border border-[#393528]">
                    <div className="text-[10px] text-[#888] font-mono text-center leading-tight">
                        <div>KEY</div>
                        <div className={`text-lg font-bold ${semitones !== 0 ? 'text-primary' : 'text-white'}`}>
                            {targetNote}
                        </div>
                    </div>
                </div>

                {/* The Needle/Pointer */}
                <div
                    className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-out z-0"
                    style={{ transform: `rotate(${needleRotation}deg)` }}
                >
                    <div className="absolute top-4 left-1/2 -ml-[2px] w-[4px] h-16 bg-primary rounded-full shadow-[0_0_10px_rgba(242,185,13,0.5)] origin-bottom"></div>
                </div>

                {/* Inner ticks */}
                <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none"></div>

            </div>

            {/* Digital Control */}
            <div className="flex items-center gap-3 bg-[#12100c] p-2 rounded-lg border border-[#2a261d] shadow-well">
                <button
                    onClick={() => !disabled && onChange(manualSemitones - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-[#2c281b] hover:bg-[#393528] rounded text-[#bab29c] hover:text-white border border-[#393528] active:scale-95 transition-all"
                    disabled={disabled}
                >
                    -
                </button>
                <div className="w-16 text-center">
                    <div className="text-[10px] text-[#666] uppercase font-bold tracking-wider">Shift</div>
                    <div className={`font-mono font-bold ${manualSemitones !== 0 ? 'text-primary' : 'text-white'}`}>
                        {manualSemitones > 0 ? '+' : ''}{manualSemitones}
                    </div>
                </div>
                <button
                    onClick={() => !disabled && onChange(manualSemitones + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-[#2c281b] hover:bg-[#393528] rounded text-[#bab29c] hover:text-white border border-[#393528] active:scale-95 transition-all"
                    disabled={disabled}
                >
                    +
                </button>
            </div>

            <button
                onClick={onMicClick}
                disabled={micDisabled || isRecording}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all shadow-lg ${isRecording
                    ? 'bg-red-900/50 text-red-500 border-red-500/50 animate-pulse'
                    : 'bg-[#2c281b] hover:bg-[#393528] text-[#bab29c] hover:text-white border-[#393528]'
                    }`}
            >
                <span className={`material-symbols-outlined text-lg ${isRecording ? 'animate-pulse' : ''}`}>
                    {isRecording ? 'mic' : 'mic_none'}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">
                    {isRecording ? 'Listening...' : 'Detect Key'}
                </span>
            </button>
        </div>
    );
};

export default PitchWheel;
