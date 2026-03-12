import { Logger } from '../../../utils/Logger';

const STORAGE_KEY = 'achievements:v1';

export const defaultAchievementState = () => ({
    progress: {
        totalCorrect: 0,
        totalWrong: 0,
        bestStreak: 0,
        maxLength: 0,
        survivalSeconds: 0,
        bestRank: 9999,
        matchesPlayed: 0,
        consecutiveMatches: 0,
        uniqueTopics: [],
        mathCorrect: 0,
        englishCorrect: 0,
        scienceCorrect: 0,
        uniqueSubjects: [],
    },
    unlocked: {},
    rewardsOwned: {},
    activeCosmetics: {
        skin: null,
        trail: null,
        glow: null,
        aura: null,
        headFx: null,
        title: null,
        spawnFx: null,
        deathFx: null,
        theme: null,
        decal: null,
        shimmer: null,
    },
    brainChips: 0,
    meta: {
        lastSessionEndedAt: null,
    }
});

export function loadAchievementState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultAchievementState();
        const parsed = JSON.parse(raw);
        const base = defaultAchievementState();
        const progress = { ...base.progress, ...(parsed.progress || {}) };
        const activeCosmetics = {
            ...base.activeCosmetics,
            ...(parsed.activeCosmetics || {}),
        };
        if (!progress.bestRank || progress.bestRank < 0) {
            progress.bestRank = base.progress.bestRank;
        }
        return { ...base, ...parsed, progress, activeCosmetics };
    } catch (e) {
        Logger.error('Achievements', 'Failed to load state', e);
        return defaultAchievementState();
    }
}

export function saveAchievementState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage might be unavailable (private mode). Ignore.
    }
}
