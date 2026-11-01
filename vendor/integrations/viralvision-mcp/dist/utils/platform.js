export function detectPlatform(input) {
    const url = input.trim();
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        const isShort = url.includes("/shorts/");
        return { platform: "youtube", url, videoId: ytMatch[1], isShortForm: isShort, isStory: false };
    }
    // Instagram
    if (url.includes("instagram.com")) {
        const isReel = url.includes("/reel/") || url.includes("/reels/");
        const isStory = url.includes("/stories/");
        const userMatch = url.match(/instagram\.com\/([^/?]+)/);
        return {
            platform: "instagram",
            url,
            username: userMatch?.[1],
            isShortForm: isReel,
            isStory,
        };
    }
    // TikTok
    if (url.includes("tiktok.com") || url.includes("vm.tiktok.com")) {
        const userMatch = url.match(/@([^/?]+)/);
        return { platform: "tiktok", url, username: userMatch?.[1], isShortForm: true, isStory: false };
    }
    // Twitter / X
    if (url.includes("twitter.com") || url.includes("x.com")) {
        return { platform: "twitter", url, isShortForm: false, isStory: false };
    }
    // Facebook
    if (url.includes("facebook.com") || url.includes("fb.watch")) {
        return { platform: "facebook", url, isShortForm: false, isStory: false };
    }
    // Reddit
    if (url.includes("reddit.com") || url.includes("v.redd.it")) {
        return { platform: "reddit", url, isShortForm: false, isStory: false };
    }
    // Local file
    if (!url.startsWith("http")) {
        return { platform: "local", url, isShortForm: false, isStory: false };
    }
    return { platform: "other", url, isShortForm: false, isStory: false };
}
export function getPlatformEmoji(platform) {
    const map = {
        youtube: "▶️",
        instagram: "📸",
        tiktok: "🎵",
        twitter: "🐦",
        facebook: "👍",
        reddit: "🤖",
        local: "💾",
        other: "🌐",
    };
    return map[platform];
}
export function getOptimalFps(info, durationSeconds) {
    if (info.isShortForm) {
        // Short-form: denser frames — 1 frame every 2 seconds, min 5, max 20
        return Math.min(20, Math.max(5, Math.floor(durationSeconds / 2)));
    }
    // Long-form: 1 frame every 5 seconds, min 3, max 30
    return Math.min(30, Math.max(3, Math.floor(durationSeconds / 5)));
}
