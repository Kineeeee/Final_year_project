export const ACHIEVEMENTS = [
    // --- Progress / Correct Answers ---
    {
        id: 'first_bite',
        name: 'First Bite',
        description: 'Eat 1 correct answer',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 1,
        rewardId: 'chips_small',
        rarity: 'bronze'
    },
    {
        id: 'knowledge_snack',
        name: 'Knowledge Snack',
        description: 'Eat 10 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 10,
        rewardId: 'chips_small',
        rarity: 'bronze'
    },
    {
        id: 'answer_hunter_bronze',
        name: 'Answer Hunter · Bronze',
        description: 'Eat 50 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 50,
        rewardId: 'trail_neon_line',
        rarity: 'bronze'
    },
    {
        id: 'answer_hunter_silver',
        name: 'Answer Hunter · Silver',
        description: 'Eat 200 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 200,
        rewardId: 'glow_electric_blue',
        rarity: 'silver'
    },
    {
        id: 'answer_hunter_gold',
        name: 'Answer Hunter · Gold',
        description: 'Eat 500 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 500,
        rewardId: 'skin_graphite_serpent',
        rarity: 'gold'
    },
    {
        id: 'master_of_answers',
        name: 'Master of Answers',
        description: 'Eat 1000 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 1000,
        rewardId: 'skin_golden',
        rarity: 'diamond'
    },
    {
        id: 'answer_hunter_diamond',
        name: 'Answer Hunter · Diamond',
        description: 'Eat 1000 correct answers',
        category: 'progress',
        type: 'counter',
        metric: 'totalCorrect',
        target: 1000,
        rewardId: 'death_knowledge_burst',
        rarity: 'diamond'
    },

    // --- Learning / Accuracy ---
    {
        id: 'perfect_mind',
        name: 'Perfect Mind',
        description: '10 correct answers in a row',
        category: 'learning',
        type: 'streak',
        metric: 'bestStreak',
        target: 10,
        rewardId: 'glow_emerald',
        rarity: 'silver'
    },
    {
        id: 'genius_mode',
        name: 'Genius Mode',
        description: '20 correct answers in a row',
        category: 'learning',
        type: 'streak',
        metric: 'bestStreak',
        target: 20,
        rewardId: 'skin_professor',
        extraRewardIds: ['title_genius_mode'],
        rarity: 'gold'
    },
    {
        id: 'no_mistakes',
        name: 'No Mistakes',
        description: 'Finish a match without eating any wrong answers',
        category: 'learning',
        type: 'flag',
        metric: 'flawlessMatch',
        target: 1,
        rewardId: 'theme_clean_slate',
        rarity: 'gold'
    },
    {
        id: 'quick_thinker',
        name: 'Quick Thinker',
        description: 'Answer correctly in <3s',
        category: 'learning',
        type: 'custom',
        metric: 'quickAnswer',
        target: 1,
        rewardId: 'trail_lightning_dash',
        rarity: 'silver'
    },
    {
        id: 'lightning_brain',
        name: 'Lightning Brain',
        description: '5 correct answers in 10s',
        category: 'learning',
        type: 'custom',
        metric: 'lightningWindow',
        target: 1,
        rewardId: 'spawn_thunder_flash',
        rarity: 'gold'
    },

    // --- Snake Growth ---
    {
        id: 'tiny_snake',
        name: 'Tiny Snake',
        description: 'Reach length 50',
        category: 'growth',
        type: 'counter',
        metric: 'maxLength',
        target: 50,
        rewardId: 'decal_basic',
        rarity: 'bronze'
    },
    {
        id: 'growing_brain',
        name: 'Growing Brain',
        description: 'Reach length 200',
        category: 'growth',
        type: 'counter',
        metric: 'maxLength',
        target: 200,
        rewardId: 'decal_gradient',
        rarity: 'silver'
    },
    {
        id: 'knowledge_giant',
        name: 'Knowledge Giant',
        description: 'Reach length 500',
        category: 'growth',
        type: 'counter',
        metric: 'maxLength',
        target: 500,
        rewardId: 'skin_giant',
        rarity: 'gold'
    },
    {
        id: 'mega_brain_snake',
        name: 'Mega Brain Snake',
        description: 'Reach length 1000',
        category: 'growth',
        type: 'counter',
        metric: 'maxLength',
        target: 1000,
        rewardId: 'shimmer_mega',
        rarity: 'diamond'
    },

    // --- Skill / Survival ---
    {
        id: 'survivor',
        name: 'Survivor',
        description: 'Survive for 3 minutes',
        category: 'skill',
        type: 'counter',
        metric: 'survivalSeconds',
        target: 180,
        rewardId: 'aura_survivor',
        rarity: 'silver'
    },
    {
        id: 'unstoppable',
        name: 'Unstoppable',
        description: 'Survive for 10 minutes',
        category: 'skill',
        type: 'counter',
        metric: 'survivalSeconds',
        target: 600,
        rewardId: 'aura_heartbeat',
        rarity: 'gold'
    },
    {
        id: 'arena_king',
        name: 'Arena King',
        description: 'Reach #1 on the leaderboard',
        category: 'skill',
        type: 'rank',
        metric: 'bestRank',
        target: 1,
        rewardId: 'crown_effect',
        extraRewardIds: ['spawn_confetti'],
        rarity: 'diamond'
    },
    {
        id: 'comeback_kid',
        name: 'Comeback Kid',
        description: 'Go from top 20 to top 5 in the same match',
        category: 'skill',
        type: 'custom',
        metric: 'comeback',
        target: 1,
        rewardId: 'title_comeback',
        rarity: 'gold'
    },

    // --- Exploration ---
    {
        id: 'first_game',
        name: 'First Game',
        description: 'Play your first game',
        category: 'exploration',
        type: 'counter',
        metric: 'matchesPlayed',
        target: 1,
        rewardId: 'sticker_smile',
        rarity: 'bronze'
    },
    {
        id: 'night_learner',
        name: 'Night Learner',
        description: 'Play after 10 PM',
        category: 'exploration',
        type: 'custom',
        metric: 'night',
        target: 1,
        rewardId: 'glow_night',
        rarity: 'silver'
    },
    {
        id: 'study_marathon',
        name: 'Study Marathon',
        description: 'Play 5 matches in a row',
        category: 'exploration',
        type: 'counter',
        metric: 'consecutiveMatches',
        target: 5,
        rewardId: 'trail_marathon',
        rarity: 'silver'
    },
    {
        id: 'knowledge_explorer',
        name: 'Knowledge Explorer',
        description: 'Play 5 different topics',
        category: 'exploration',
        type: 'counter',
        metric: 'uniqueTopics',
        target: 5,
        rewardId: 'title_explorer',
        rarity: 'gold'
    },

    // --- Subject Specials ---
    {
        id: 'math_wizard',
        name: 'Math Wizard',
        description: 'Eat 50 Math answers',
        category: 'subject',
        type: 'counter',
        metric: 'mathCorrect',
        target: 50,
        rewardId: 'skin_math',
        rarity: 'silver'
    },
    {
        id: 'vocabulary_king',
        name: 'Vocabulary King',
        description: 'Eat 50 English answers',
        category: 'subject',
        type: 'counter',
        metric: 'englishCorrect',
        target: 50,
        rewardId: 'skin_vocab',
        rarity: 'silver'
    },
    {
        id: 'science_brain',
        name: 'Science Brain',
        description: 'Eat 50 Science answers',
        category: 'subject',
        type: 'counter',
        metric: 'scienceCorrect',
        target: 50,
        rewardId: 'skin_science',
        rarity: 'silver'
    },
    {
        id: 'all_rounder',
        name: 'All-rounder',
        description: 'Get correct answers in 5 different subjects',
        category: 'subject',
        type: 'counter',
        metric: 'uniqueSubjects',
        target: 5,
        rewardId: 'title_all_rounder',
        rarity: 'gold'
    },

    // --- Secret ---
    {
        id: 'last_survivor',
        name: 'Last Survivor',
        description: 'Be the last one in the room',
        category: 'secret',
        type: 'custom',
        metric: 'lastSurvivor',
        target: 1,
        rewardId: 'skin_phantom',
        rarity: 'mythic',
        secret: true
    },
    {
        id: 'brain_explosion',
        name: 'Brain Explosion',
        description: 'Extremely fast growth in 30s',
        category: 'secret',
        type: 'custom',
        metric: 'burstGrowth',
        target: 1,
        rewardId: 'trail_neural_storm',
        rarity: 'mythic',
        secret: true
    }
];
