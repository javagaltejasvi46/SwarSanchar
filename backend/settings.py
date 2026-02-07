"""
Swar Sanchar - Settings Manager
Handles application configuration and persistence
"""

import os
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, asdict, field
import logging

logger = logging.getLogger(__name__)


def get_app_data_dir() -> Path:
    """Get the application data directory"""
    
    if os.name == 'nt':  # Windows
        base = Path(os.environ.get('APPDATA', Path.home()))
    else:
        base = Path.home() / '.config'
    
    app_dir = base / 'SwarsancharMedia'
    app_dir.mkdir(parents=True, exist_ok=True)
    return app_dir


@dataclass
class SplitterSettings:
    """Splitter-related settings"""
    default_stems: int = 4  # 2 or 4
    default_output_format: str = "wav"  # wav, mp3, flac
    output_path: str = field(default_factory=lambda: str(get_app_data_dir() / 'Swarsanchar' / 'stems'))


@dataclass
class SystemSettings:
    """System-related settings"""
    temp_path: str = field(default_factory=lambda: str(get_app_data_dir() / 'temp'))
    ffmpeg_path: str = ""  # Empty means use bundled/system FFmpeg
    use_gpu: bool = True


@dataclass
class AppSettings:
    """Main application settings"""
    splitter: SplitterSettings = field(default_factory=SplitterSettings)
    system: SystemSettings = field(default_factory=SystemSettings)
    
    def to_dict(self) -> dict:
        return {
            'splitter': asdict(self.splitter),
            'system': asdict(self.system)
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> 'AppSettings':
        """Safely create settings from dict, ignoring unknown fields"""
        def get_valid_data(dataclass_cls, source_dict):
            if not isinstance(source_dict, dict):
                return {}
            # Only include keys that exist in the dataclass
            import dataclasses
            valid_keys = {f.name for f in dataclasses.fields(dataclass_cls)}
            return {k: v for k, v in source_dict.items() if k in valid_keys}

        return cls(
            splitter=SplitterSettings(**get_valid_data(SplitterSettings, data.get('splitter', {}))),
            system=SystemSettings(**get_valid_data(SystemSettings, data.get('system', {})))
        )


class SettingsManager:
    """Manages application settings persistence"""
    
    def __init__(self):
        self.config_file = get_app_data_dir() / 'settings.json'
        self._settings: Optional[AppSettings] = None
    
    @property
    def settings(self) -> AppSettings:
        if self._settings is None:
            self._settings = self.load()
        return self._settings
    
    def load(self) -> AppSettings:
        """Load settings from file or return defaults"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    logger.info(f"Loaded settings from {self.config_file}")
                    return AppSettings.from_dict(data)
        except Exception as e:
            logger.warning(f"Error loading settings: {e}, using defaults")
        
        return AppSettings()
    
    def save(self, settings: Optional[AppSettings] = None) -> bool:
        """Save settings to file"""
        if settings:
            self._settings = settings
        
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.settings.to_dict(), f, indent=2)
            logger.info(f"Saved settings to {self.config_file}")
            return True
        except Exception as e:
            logger.error(f"Error saving settings: {e}")
            return False
    
    def update(self, updates: dict) -> AppSettings:
        """Update settings with partial data"""
        current = self.settings.to_dict()
        
        for category, values in updates.items():
            if category in current and isinstance(values, dict):
                current[category].update(values)
        
        self._settings = AppSettings.from_dict(current)
        self.save()
        return self._settings
    
    def ensure_directories(self):
        """Ensure all output directories exist"""
        paths = [
            self.settings.splitter.output_path,
            self.settings.system.temp_path
        ]
        for path in paths:
            Path(path).mkdir(parents=True, exist_ok=True)


# Global settings manager instance
settings_manager = SettingsManager()
