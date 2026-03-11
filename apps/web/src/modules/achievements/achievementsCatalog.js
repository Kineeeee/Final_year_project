export const ACHIEVEMENTS = [
    // --- Progress / Correct Answers ---
    {
        id: 'first_bite',
        name: 'First Bite',
        description: 'Ăn 1 đáp án đúng',
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
        description: 'Ăn 10 đáp án đúng',
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
        description: 'Ăn 50 đáp án đúng',
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
        description: 'Ăn 200 đáp án đúng',
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
        description: 'Ăn 500 đáp án đúng',
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
        description: 'Ăn 1000 đáp án đúng',
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
        description: 'Ăn 1000 đáp án đúng',
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
        description: '10 câu đúng liên tiếp',
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
        description: '20 câu đúng liên tiếp',
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
        description: 'Hoàn thành trận mà không ăn đáp án sai',
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
        description: 'Trả lời đúng trong <3s',
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
        description: '5 câu đúng trong 10s',
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
        description: 'Đạt độ dài 50',
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
        description: 'Đạt độ dài 200',
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
        description: 'Đạt độ dài 500',
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
        description: 'Đạt độ dài 1000',
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
        description: 'Sống sót 3 phút',
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
        description: 'Sống sót 10 phút',
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
        description: 'Đứng top 1 bảng xếp hạng',
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
        description: 'Từ top 20 lên top 5 trong cùng trận',
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
        description: 'Chơi trận đầu tiên',
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
        description: 'Chơi sau 22h',
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
        description: 'Chơi 5 trận liên tiếp',
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
        description: 'Chơi 5 chủ đề khác nhau',
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
        description: 'Ăn 50 đáp án toán',
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
        description: 'Ăn 50 đáp án tiếng Anh',
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
        description: 'Ăn 50 câu khoa học',
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
        description: 'Ăn đúng trong 5 môn khác nhau',
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
        description: 'Là người cuối cùng trong phòng',
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
        description: 'Tăng trưởng cực nhanh trong 30s',
        category: 'secret',
        type: 'custom',
        metric: 'burstGrowth',
        target: 1,
        rewardId: 'trail_neural_storm',
        rarity: 'mythic',
        secret: true
    }
];
