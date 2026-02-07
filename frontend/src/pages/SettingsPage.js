import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../App';

// Section component for grouping settings
const SettingsSection = ({ title, icon, children }) => (
    <div className="bg-[#1f1d16] border border-[#393528] rounded-xl p-6 shadow-plate">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#393528]">
            <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
            <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
        </div>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

// Path input with browse button
const PathInput = ({ label, value, onChange, onBrowse }) => (
    <div className="space-y-1">
        <label className="text-xs font-bold text-[#bab29c] uppercase tracking-wider">{label}</label>
        <div className="flex gap-2">
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 bg-[#12100c] text-[#bab29c] border border-[#393528] rounded px-3 py-2 text-sm font-mono focus:border-primary focus:ring-0 focus:outline-none shadow-well"
            />
            <button
                onClick={onBrowse}
                className="px-4 py-2 bg-[#2c281b] hover:bg-[#393528] text-[#bab29c] hover:text-white border border-[#393528] rounded font-medium text-sm shadow-plate transition-all flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-lg">folder_open</span>
                Browse
            </button>
        </div>
    </div>
);

// Select input
const SelectInput = ({ label, value, onChange, options }) => (
    <div className="space-y-1">
        <label className="text-xs font-bold text-[#bab29c] uppercase tracking-wider">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-[#12100c] text-[#bab29c] border border-[#393528] rounded px-3 py-2 text-sm focus:border-primary focus:ring-0 focus:outline-none shadow-well skeuo-select"
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

// Toggle switch
const ToggleSwitch = ({ label, description, checked, onChange }) => (
    <div className="flex items-center justify-between py-2">
        <div>
            <p className="text-sm font-medium text-white">{label}</p>
            {description && <p className="text-xs text-[#666]">{description}</p>}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-[#393528]'
                }`}
        >
            <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${checked ? 'left-7' : 'left-1'
                    }`}
            />
        </button>
    </div>
);

// Dependency status card
const DependencyCard = ({ name, version, status, onUpdate, updating }) => (
    <div className="flex items-center justify-between py-3 px-4 bg-[#12100c] rounded border border-[#2a261d]">
        <div className="flex items-center gap-3">
            <div className={`size-3 rounded-full ${status ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
                <p className="text-sm font-medium text-white">{name}</p>
                <p className="text-xs text-[#666]">{version || 'Not installed'}</p>
            </div>
        </div>
        {onUpdate && (
            <button
                onClick={onUpdate}
                disabled={updating}
                className="px-3 py-1 bg-[#2c281b] hover:bg-[#393528] text-primary border border-[#393528] rounded text-xs font-bold shadow-plate transition-all disabled:opacity-50"
            >
                {updating ? 'Updating...' : 'Update'}
            </button>
        )}
    </div>
);

export default function SettingsPage() {
    const api = useApi();

    const [settings, setSettings] = useState({

        splitter: {
            default_stems: 4,
            default_output_format: 'wav',
            output_path: ''
        },
        system: {
            temp_path: '',
            use_gpu: true
        }
    });

    const [systemStatus, setSystemStatus] = useState({
        ffmpeg: { available: false, version: '' },
        demucs: { available: false, version: '', cuda_available: false }
    });

    const [updating, setUpdating] = useState(false);
    const [saved, setSaved] = useState(false);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [settingsData, statusData] = await Promise.all([
                    api?.getSettings(),
                    api?.checkSystem()
                ]);

                if (settingsData) setSettings(settingsData);
                if (statusData) setSystemStatus(statusData);
            } catch (err) {
                console.error('Error loading settings:', err);
            }
        };

        loadSettings();
    }, [api]);

    // Update nested settings
    const updateSettings = useCallback((category, key, value) => {
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value
            }
        }));
        setSaved(false);
    }, []);

    // Save settings
    const handleSave = async () => {
        try {
            await api?.updateSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    };

    // Browse for folder
    const handleBrowse = async (category, key) => {
        if (window.electronAPI) {
            const folder = await window.electronAPI.selectFolder();
            if (folder) {
                updateSettings(category, key, folder);
            }
        }
    };



    return (
        <div className="h-full overflow-y-auto p-6 pb-16">
            <div className="max-w-4xl mx-auto space-y-6 pb-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold gold-gradient-text">Settings</h1>
                        <p className="text-sm text-[#666]">Configure your Swarsanchar preferences</p>
                    </div>
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2 rounded font-bold text-sm uppercase tracking-wider transition-all flex items-center gap-2 ${saved
                            ? 'bg-green-600 text-white'
                            : 'bg-primary hover:brightness-110 text-black'
                            }`}
                    >
                        <span className="material-symbols-outlined text-lg">
                            {saved ? 'check' : 'save'}
                        </span>
                        {saved ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>

                {/* Output Paths Section */}
                <SettingsSection title="Output Paths" icon="folder">

                    <PathInput
                        label="Stems Output Folder"
                        value={settings.splitter.output_path}
                        onChange={(v) => updateSettings('splitter', 'output_path', v)}
                        onBrowse={() => handleBrowse('splitter', 'output_path')}
                    />
                    <PathInput
                        label="Temporary Files"
                        value={settings.system.temp_path}
                        onChange={(v) => updateSettings('system', 'temp_path', v)}
                        onBrowse={() => handleBrowse('system', 'temp_path')}
                    />
                </SettingsSection>



                {/* Splitter Preferences Section */}
                <SettingsSection title="Splitter Preferences" icon="call_split">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectInput
                            label="Default Stem Count"
                            value={settings.splitter.default_stems}
                            onChange={(v) => updateSettings('splitter', 'default_stems', parseInt(v))}
                            options={[
                                { value: 2, label: '2 Stems (Vocals + Accompaniment)' },
                                { value: 4, label: '4 Stems (Vocals, Drums, Bass, Other)' }
                            ]}
                        />
                        <SelectInput
                            label="Output Format"
                            value={settings.splitter.default_output_format}
                            onChange={(v) => updateSettings('splitter', 'default_output_format', v)}
                            options={[
                                { value: 'wav', label: 'WAV (Lossless)' },
                                { value: 'mp3', label: 'MP3 (320kbps)' },
                                { value: 'flac', label: 'FLAC' }
                            ]}
                        />
                    </div>
                    <ToggleSwitch
                        label="Use GPU Acceleration"
                        description="Enable CUDA for faster processing (requires NVIDIA GPU)"
                        checked={settings.system.use_gpu}
                        onChange={(v) => updateSettings('system', 'use_gpu', v)}
                    />
                </SettingsSection>

                {/* Dependencies Section */}
                <SettingsSection title="Dependencies & Updates" icon="extension">
                    <div className="space-y-3">

                        <DependencyCard
                            name="FFmpeg"
                            version={systemStatus.ffmpeg?.version?.split(' ').slice(0, 3).join(' ')}
                            status={systemStatus.ffmpeg?.available}
                        />
                        <DependencyCard
                            name="Demucs (AI Engine)"
                            version={systemStatus.demucs?.available
                                ? `v${systemStatus.demucs.version} | ${systemStatus.demucs.cuda_available ? 'GPU: CUDA' : 'CPU Mode'}`
                                : null
                            }
                            status={systemStatus.demucs?.available}
                        />
                    </div>

                    <div className="mt-4 p-4 bg-[#12100c] rounded border border-[#2a261d]">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-primary">info</span>
                            <div className="text-sm text-[#bab29c]">
                                <p className="font-medium text-white mb-1">About Dependencies</p>
                                <p>FFmpeg is bundled with the application. Demucs models are downloaded on first use (~1.5GB).</p>
                            </div>
                        </div>
                    </div>
                </SettingsSection>

                {/* About Section */}
                <SettingsSection title="About" icon="info">
                    <div className="text-center py-4">
                        <h3 className="text-xl font-bold gold-gradient-text mb-2">Swarsanchar Media Suite</h3>
                        <p className="text-sm text-[#666] mb-4">Version 2.0.0</p>
                        <p className="text-sm text-[#bab29c]">
                            AI Audio Stem Splitter
                        </p>
                        <p className="text-xs text-[#555] mt-4">
                            Powered by Demucs and PyTorch
                        </p>
                    </div>
                </SettingsSection>
            </div>
        </div>
    );
}
