import { ACHIEVEMENTS } from './achievementsCatalog';
import { REWARDS, REWARD_CHIPS_BY_RARITY } from './rewardsCatalog';
import { Logger } from '../../utils/Logger';
import { CONFIG } from '../../config/constants';

const STORAGE_KEY = 'achievements:v1';

const defaultState = () => ({
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
    unlocked: {}, // { achievementId: timestamp }
    rewardsOwned: {}, // { rewardId: true }
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

class AchievementManager {
    constructor() {
        this.state = this._loadState();
        this.scene = null;
        this.uiScene = null;
        this._bindings = [];
        this.activeSession = null;
        this.sessionFlags = {};
    }

    // --- Session lifecycle ---
    startSession(scene, { mode, quizSource, customNamespace } = {}) {
        this.detach();
        this.scene = scene;
        this.uiScene = scene.scene ? scene.scene.get(CONFIG.SCENES.UI) : null;
        this._bindings = [];

        const now = Date.now();
        const topic = this._deriveTopic({ mode, quizSource, customNamespace });
        const subject = this._deriveSubject(mode);
        this.sessionFlags = {
            quickAnswer: false,
            lightning: false,
            comeback: false,
            lastSurvivor: false,
            burstGrowth: false,
        };

        this.activeSession = {
            startedAt: now,
            ended: false,
            mode: mode || CONFIG.GAME_MODES.NORMAL,
            quizSource: (quizSource || 'SYSTEM').toUpperCase(),
            topic,
            subject,
            correctCount: 0,
            wrongCount: 0,
            currentStreak: 0,
            bestStreak: 0,
            questionStartedAt: null,
            correctTimestamps: [],
            lengthWindow: [], // [{t, length}]
            previousRank: null,
            comebackCandidate: null,
        };

        // Progress bumps at session start
        this._bumpMatchCounters(now, topic);

        // Bind events from the Game scene
        this._bind(scene.events, 'updateQuestion', (payload) => this._onQuestion(payload));
        this._bind(scene.events, 'answer:result', (payload) => this._onAnswer(payload));
        this._bind(scene.events, 'updateScore', (score) => this._onScore(score));
        this._bind(scene.events, 'updateRank', ({ rank, total }) => this._onRank(rank, total));
        this._bind(scene.events, 'roundStart', () => this._onRoundStart());
        this._bind(scene.events, 'state:localDied', (payload) => this.finishSession({ reason: 'death', payload }));
        this._bind(scene.events, 'roundEnd', () => this.finishSession({ reason: 'roundEnd' }));
        this._bind(scene.events, 'match:result', () => this.finishSession({ reason: 'result' }));

        // Cleanup on scene shutdown
        if (scene.events && scene.events.once) {
            scene.events.once('shutdown', () => this.detach());
        }

        this._evaluateAchievements();
        this._saveState();
    }

    attachUiScene(uiScene) {
        this.uiScene = uiScene;
    }

    detach() {
        if (this.scene && this._bindings) {
            this._bindings.forEach(({ emitter, event, handler }) => emitter.off(event, handler));
        }
        this._bindings = [];
        this.scene = null;
        this.uiScene = null;
        this.activeSession = null;
    }

    // --- Event Handlers ---
    _onQuestion() {
        if (!this.activeSession) return;
        this.activeSession.questionStartedAt = Date.now();
    }

    _onAnswer(data) {
        if (!this.activeSession || !data) return;
        const localId = this.scene?.gameState?.localPlayerId || this.scene?.networkManager?.socket?.id;
        if (!localId || data.playerId !== localId) return;

        const now = Date.now();
        const timeToAnswer = this._computeAnswerTime(now, data);

        if (data.correct) {
            this.state.progress.totalCorrect += 1;
            this.activeSession.correctCount += 1;
            this.activeSession.currentStreak += 1;
            this.activeSession.bestStreak = Math.max(this.activeSession.bestStreak, this.activeSession.currentStreak);
            this.state.progress.bestStreak = Math.max(this.state.progress.bestStreak, this.activeSession.bestStreak);

            // Subject counters
            const subject = data.subject || this.activeSession.subject || 'general';
            this._bumpSubject(subject);

            // Quick thinker
            if (timeToAnswer !== null && timeToAnswer < 3000) {
                this.sessionFlags.quickAnswer = true;
            }

            // Lightning brain window (5 correct in 10s)
            this.activeSession.correctTimestamps.push(now);
            this.activeSession.correctTimestamps = this.activeSession.correctTimestamps.filter((t) => now - t <= 10000);
            if (this.activeSession.correctTimestamps.length >= 5) {
                this.sessionFlags.lightning = true;
            }
        } else {
            this.state.progress.totalWrong += 1;
            this.activeSession.wrongCount += 1;
            this.activeSession.currentStreak = 0;
        }

        this._evaluateAchievements();
        this._saveState();
    }

    _onScore(score) {
        if (!this.activeSession || typeof score !== 'number') return;
        const lengthVal = Math.max(0, Math.floor(score));
        const now = Date.now();

        // Track max length lifetime
        if (lengthVal > this.state.progress.maxLength) {
            this.state.progress.maxLength = lengthVal;
        }

        // Burst growth detection (30s window)
        this.activeSession.lengthWindow.push({ t: now, length: lengthVal });
        this.activeSession.lengthWindow = this.activeSession.lengthWindow.filter((s) => now - s.t <= 30000);
        const minInWindow = Math.min(...this.activeSession.lengthWindow.map((s) => s.length));
        if (lengthVal - minInWindow >= 150) {
            this.sessionFlags.burstGrowth = true;
        }

        this._evaluateAchievements();
    }

    _onRank(rank, total) {
        if (!this.activeSession) return;
        if (typeof rank !== 'number') return;

        this.state.progress.bestRank = Math.min(this.state.progress.bestRank || Infinity, rank);

        // Arena King
        if (rank === 1) {
            this._unlockByMetric('bestRank', rank);
        }

        // Last Survivor: rank 1 and only player left
        if (rank === 1 && total === 1) {
            this.sessionFlags.lastSurvivor = true;
        }

        // Comeback tracking
        if (rank >= 20) {
            this.activeSession.comebackCandidate = rank;
        } else if (rank <= 5 && this.activeSession.comebackCandidate && this.activeSession.comebackCandidate >= 20) {
            this.sessionFlags.comeback = true;
            this.activeSession.comebackCandidate = null;
        }

        this.activeSession.previousRank = rank;
    }

    _onRoundStart() {
        if (!this.activeSession) return;
        this.activeSession.currentStreak = 0;
        this.activeSession.questionStartedAt = null;
    }

    finishSession({ reason } = {}) {
        if (!this.activeSession || this.activeSession.ended) return;
        this.activeSession.ended = true;

        const now = Date.now();
        const durationSec = Math.round((now - (this.activeSession.startedAt || now)) / 1000);
        this.state.progress.survivalSeconds = Math.max(this.state.progress.survivalSeconds, durationSec);

        // Flawless run check
        if (this.activeSession.wrongCount === 0 && this.activeSession.correctCount > 0) {
            this._unlockByMetric('flawlessMatch');
        }

        // Update consecutive match streak (reset if gap > 1h)
        if (this.state.meta.lastSessionEndedAt && now - this.state.meta.lastSessionEndedAt > 60 * 60 * 1000) {
            this.state.progress.consecutiveMatches = 0;
        }
        this.state.progress.consecutiveMatches += 1;
        this.state.meta.lastSessionEndedAt = now;

        this._evaluateAchievements({ allowSecrets: true });
        this._saveState();

        Logger.info('Achievements', `Session finished (${reason || 'end'}) duration=${durationSec}s`);
    }

    // --- Evaluation ---
    _evaluateAchievements({ allowSecrets = false } = {}) {
        ACHIEVEMENTS.forEach((ach) => {
            if (this.state.unlocked[ach.id]) return;
            if (ach.secret && !allowSecrets) return;

            const value = this._getMetricValue(ach);
            let meets = false;

            switch (ach.type) {
                case 'counter':
                case 'streak':
                    meets = typeof value === 'number' && value >= ach.target;
                    break;
                case 'rank':
                    meets = typeof value === 'number' && value <= ach.target;
                    break;
                case 'flag':
                    meets = !!value;
                    break;
                case 'custom':
                    meets = !!value;
                    break;
                default:
                    break;
            }

            if (meets) {
                this._grantAchievement(ach);
            }
        });
    }

    _grantAchievement(achievement) {
        if (!achievement || this.state.unlocked[achievement.id]) return;

        const unlockedAt = Date.now();
        this.state.unlocked[achievement.id] = unlockedAt;

        const rewards = [achievement.rewardId, ...(achievement.extraRewardIds || [])].filter(Boolean);
        const grantedRewards = rewards.map((rid) => this._grantReward(rid, achievement.rarity)).filter(Boolean);

        const payload = {
            id: achievement.id,
            name: achievement.name,
            rarity: achievement.rarity,
            rewards: grantedRewards,
            unlockedAt,
        };

        this._emitUnlock(payload);
        this._saveState();
    }

    _grantReward(rewardId, fallbackRarity) {
        if (!rewardId) return null;
        const reward = REWARDS[rewardId];
        if (!reward) {
            // Fallback to chips if unknown
            const chips = REWARD_CHIPS_BY_RARITY[fallbackRarity] || 25;
            this.state.brainChips += chips;
            return { id: rewardId, type: 'chips', amount: chips, duplicate: false };
        }

        // Chips reward type
        if (reward.type === 'chips') {
            const amount = reward.amount || REWARD_CHIPS_BY_RARITY[reward.rarity] || 25;
            this.state.brainChips += amount;
            return { ...reward, amount, duplicate: false };
        }

        const alreadyOwned = !!this.state.rewardsOwned[rewardId];
        if (alreadyOwned) {
            const chips = REWARD_CHIPS_BY_RARITY[reward.rarity || fallbackRarity] || 25;
            this.state.brainChips += chips;
            return { id: rewardId, type: 'chips', amount: chips, duplicate: true };
        }

        this.state.rewardsOwned[rewardId] = true;

        // Auto-equip if slot empty
        const slot = this._slotForReward(reward.type);
        if (slot && !this.state.activeCosmetics[slot]) {
            this.state.activeCosmetics[slot] = rewardId;
        }

        return { ...reward, duplicate: false };
    }

    _emitUnlock(payload) {
        if (this.scene && this.scene.events) {
            this.scene.events.emit('achievement:unlocked', payload);
        }
        if (this.uiScene && this.uiScene.events) {
            this.uiScene.events.emit('achievement:unlocked', payload);
        }
    }

    // --- Metrics ---
    _getMetricValue(achievement) {
        const p = this.state.progress;
        switch (achievement.metric) {
            case 'totalCorrect':
                return p.totalCorrect;
            case 'bestStreak':
                return p.bestStreak;
            case 'maxLength':
                return p.maxLength;
            case 'survivalSeconds':
                return p.survivalSeconds;
            case 'matchesPlayed':
                return p.matchesPlayed;
            case 'consecutiveMatches':
                return p.consecutiveMatches;
            case 'uniqueTopics':
                return p.uniqueTopics.length;
            case 'mathCorrect':
            case 'englishCorrect':
            case 'scienceCorrect':
                return p[achievement.metric] || 0;
            case 'uniqueSubjects':
                return p.uniqueSubjects.length;
            case 'bestRank':
                return p.bestRank || Infinity;
            case 'flawlessMatch':
                return this.activeSession?.wrongCount === 0;
            case 'quickAnswer':
                return this.sessionFlags.quickAnswer;
            case 'lightningWindow':
                return this.sessionFlags.lightning;
            case 'comeback':
                return this.sessionFlags.comeback;
            case 'night':
                return this._customMetric('night');
            case 'lastSurvivor':
                return this.sessionFlags.lastSurvivor;
            case 'burstGrowth':
                return this.sessionFlags.burstGrowth;
            default:
                return 0;
        }
    }

    _customMetric(metric) {
        const now = Date.now();
        switch (metric) {
            case 'night': {
                const hour = new Date(now).getHours();
                return hour >= 22 || hour < 5;
            }
            default:
                return false;
        }
    }

    _unlockByMetric(metricName) {
        ACHIEVEMENTS.filter((a) => a.metric === metricName).forEach((a) => {
            if (!this.state.unlocked[a.id]) {
                this._grantAchievement(a);
            }
        });
    }

    _deriveTopic({ mode, quizSource, customNamespace }) {
        if (customNamespace) return `custom:${customNamespace.split('/').pop()}`;
        if (mode === CONFIG.GAME_MODES.MATH || mode === 'math') return 'math';
        if (mode === CONFIG.GAME_MODES.ENGLISH || mode === 'english') return 'english';
        if (mode) return mode;
        return quizSource ? `src:${(quizSource || '').toLowerCase()}` : 'unknown';
    }

    _deriveSubject(mode) {
        if (mode === CONFIG.GAME_MODES.MATH || mode === 'math') return 'math';
        if (mode === CONFIG.GAME_MODES.ENGLISH || mode === 'english') return 'english';
        return 'general';
    }

    _bumpMatchCounters(now, topic) {
        this.state.progress.matchesPlayed += 1;
        if (topic && !this.state.progress.uniqueTopics.includes(topic)) {
            this.state.progress.uniqueTopics.push(topic);
        }
    }

    _bumpSubject(subject) {
        const key = `${subject}Correct`;
        if (this.state.progress[key] !== undefined) {
            this.state.progress[key] += 1;
        }
        if (!this.state.progress.uniqueSubjects.includes(subject)) {
            this.state.progress.uniqueSubjects.push(subject);
        }
    }

    _computeAnswerTime(now, data) {
        if (typeof data.timeToAnswer === 'number') return data.timeToAnswer;
        if (this.activeSession?.questionStartedAt) {
            return now - this.activeSession.questionStartedAt;
        }
        return null;
    }

    _slotForReward(type) {
        switch (type) {
            case 'skin':
                return 'skin';
            case 'trail':
                return 'trail';
            case 'glow':
                return 'glow';
            case 'aura':
                return 'aura';
            case 'headFx':
                return 'headFx';
            case 'title':
                return 'title';
            case 'spawnFx':
                return 'spawnFx';
            case 'deathFx':
                return 'deathFx';
            case 'theme':
                return 'theme';
            case 'decal':
                return 'decal';
            case 'shimmer':
                return 'shimmer';
            default:
                return null;
        }
    }

    // --- Accessors for UI ---
    getSnapshot() {
        return {
            progress: this.state.progress,
            unlocked: { ...this.state.unlocked },
            rewardsOwned: { ...this.state.rewardsOwned },
            activeCosmetics: { ...this.state.activeCosmetics },
            brainChips: this.state.brainChips,
        };
    }

    equipReward(rewardId) {
        const reward = REWARDS[rewardId];
        if (!reward || !this.state.rewardsOwned[rewardId]) return false;
        const slot = this._slotForReward(reward.type);
        if (!slot) return false;
        this.state.activeCosmetics[slot] = rewardId;
        this._saveState();
        return true;
    }

    // --- Storage ---
    _loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            const progress = { ...defaultState().progress, ...(parsed.progress || {}) };
            if (!progress.bestRank || progress.bestRank < 0) {
                progress.bestRank = defaultState().progress.bestRank;
            }
            return { ...defaultState(), ...parsed, progress };
        } catch (e) {
            Logger.error('Achievements', 'Failed to load state', e);
            return defaultState();
        }
    }

    _saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
        } catch (e) {
            // Storage might be unavailable (private mode). Ignore.
        }
    }

    // --- Internals ---
    _bind(emitter, event, handler) {
        if (!emitter || !emitter.on) return;
        emitter.on(event, handler);
        this._bindings.push({ emitter, event, handler });
    }
}

export const achievementManager = new AchievementManager();
