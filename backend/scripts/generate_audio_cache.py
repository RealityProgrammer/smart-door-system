import os
import sys
import asyncio
import json
from pathlib import Path

# Add parent directory to path to import services
sys.path.append(str(Path(__file__).parent.parent))

from src.services.gemini_service import gemini_service

# Audio cache configuration
AUDIO_CACHE_DIR = Path(__file__).parent.parent / "static" / "audio"
AUDIO_MANIFEST_FILE = AUDIO_CACHE_DIR / "manifest.json"

# Pre-defined system audio messages
SYSTEM_AUDIO_MESSAGES = {
    "quota_exceeded": "Hệ thống đang quá tải. Vui lòng thử lại sau vài phút.",
    "thinking": "Để tôi suy nghĩ một chút...",
}

async def generate_audio_file(key: str, text: str, format: str = "mp3") -> bool:
    """Generate and save audio file"""
    try:
        print(f"🎵 Generating audio for '{key}': {text[:50]}...")
        
        # Generate audio using Gemini TTS
        audio_data, mime_type = gemini_service.text_to_speech(text, format)
        
        # Save to file
        extension = "mp3" if format.lower() == "mp3" else "wav"
        filename = f"{key}.{extension}"
        filepath = AUDIO_CACHE_DIR / filename
        
        with open(filepath, 'wb') as f:
            f.write(audio_data)
        
        print(f"✅ Saved: {filename} ({len(audio_data)} bytes)")
        return True
        
    except Exception as e:
        print(f"❌ Failed to generate {key}: {e}")
        return False

async def generate_all_audio_files():
    """Generate all system audio files"""
    # Create audio cache directory
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    print(f"🚀 Starting audio generation...")
    print(f"📁 Cache directory: {AUDIO_CACHE_DIR}")
    print(f"📝 Total messages: {len(SYSTEM_AUDIO_MESSAGES)}")
    print("-" * 50)
    
    manifest = {}
    success_count = 0
    
    for key, text in SYSTEM_AUDIO_MESSAGES.items():
        try:
            # Add delay to avoid rate limiting
            if success_count > 0:
                print("⏳ Waiting 3 seconds to avoid rate limit...")
                await asyncio.sleep(3)
            
            success = await generate_audio_file(key, text, "mp3")
            
            if success:
                filename = f"{key}.mp3"
                manifest[key] = {
                    "filename": filename,
                    "text": text,
                    "format": "mp3",
                    "mime_type": "audio/mpeg",
                    "generated_at": str(Path(AUDIO_CACHE_DIR / filename).stat().st_mtime)
                }
                success_count += 1
            
        except Exception as e:
            print(f"❌ Error processing {key}: {e}")
            continue
    
    # Save manifest file
    with open(AUDIO_MANIFEST_FILE, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    print("-" * 50)
    print(f"🎉 Generation complete!")
    print(f"✅ Success: {success_count}/{len(SYSTEM_AUDIO_MESSAGES)} files")
    print(f"📋 Manifest saved: {AUDIO_MANIFEST_FILE}")
    
    # List generated files
    print("\n📂 Generated files:")
    for file in AUDIO_CACHE_DIR.glob("*.mp3"):
        size_kb = file.stat().st_size / 1024
        print(f"   {file.name} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    print("🎤 Audio Cache Generator")
    print("=" * 50)
    
    try:
        asyncio.run(generate_all_audio_files())
    except KeyboardInterrupt:
        print("\n⚠️ Generation cancelled by user")
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)