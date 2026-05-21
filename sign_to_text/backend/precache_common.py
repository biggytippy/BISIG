import os
import sys
import asyncio

# Add Backend-API to path so we can import video_service
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_API_DIR = os.path.join(os.path.dirname(os.path.dirname(CURRENT_DIR)), "Backend-API")
sys.path.append(BACKEND_API_DIR)

from services import video_service

COMMON_WORDS = [
    "hello",
    "thank you",
    "please",
    "yes",
    "no",
    "love",
    "friend",
    "family",
    "father",
    "mother",
    "help",
    "sorry",
    "more",
    "go",
    "stop",
    "eat",
    "drink",
    "happy",
    "sad",
    "good"
]

async def process_word_lang(word: str, lang: str, semaphore: asyncio.Semaphore):
    async with semaphore:
        print(f"[{lang.upper()}] Seeding sign: '{word}'...")
        try:
            # 1. Fetch Video file (downloads if not cached)
            video_info = await video_service.get_or_fetch_video(word, lang=lang)
            if not video_info:
                print(f"  [!] Video not found for: '{word}' in {lang}")
                return False
                
            # 2. Extract Skeleton Data (JSON)
            print(f"  [+] Extracting/Caching skeleton for: '{word}' in {lang}...")
            skeleton_data = await video_service.get_skeleton_for_video(video_info)
            if skeleton_data:
                print(f"  [v] Success: '{word}' ({lang}) - {len(skeleton_data)} frames cached.")
                return True
            else:
                print(f"  [x] Failed to extract skeleton for: '{word}' in {lang}")
                return False
        except Exception as e:
            print(f"  [Error] '{word}' ({lang}): {e}")
            return False

async def main():
    # Enforce online search and saving
    video_service.SEARCH_ONLINE = True
    
    print("Starting common sign language dataset seeding...")
    print(f"Target words: {COMMON_WORDS}")
    
    # 5 concurrent downloads/extractions
    semaphore = asyncio.Semaphore(3)
    
    tasks = []
    for lang in ["asl", "fsl"]:
        for word in COMMON_WORDS:
            tasks.append(process_word_lang(word, lang, semaphore))
            
    results = await asyncio.gather(*tasks)
    success_count = sum(1 for r in results if r)
    print(f"\nSeeding Complete! Successfully cached {success_count}/{len(tasks)} sign skeletons.")

if __name__ == "__main__":
    asyncio.run(main())
