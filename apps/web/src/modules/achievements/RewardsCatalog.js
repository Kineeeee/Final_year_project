export const REWARD_CHIPS_BY_RARITY = {
    bronze: 25,
    silver: 50,
    gold: 100,
    diamond: 200,
    mythic: 300
};

export const REWARDS = {
    // Utility / currency
    chips_small: { id: 'chips_small', type: 'chips', name: 'Brain Chips', amount: 15, rarity: 'bronze' },

    // Skins
    skin_default: { id: 'skin_default', type: 'skin', name: 'Original Snake', rarity: 'bronze', texture: 'snake-circle', preloadPath: 'snake/circle.png', isDefault: true },
    skin_professor: { id: 'skin_professor', type: 'skin', name: 'Professor Snake', rarity: 'gold', texture: 'skin_professor', preloadPath: 'skins/skin_professor.png' },
    skin_golden: { id: 'skin_golden', type: 'skin', name: 'Golden Snake', rarity: 'diamond', texture: 'skin_golden', preloadPath: 'skins/skin_golden.png' },
    skin_graphite_serpent: { id: 'skin_graphite_serpent', type: 'skin', name: 'Graphite Serpent', rarity: 'gold', texture: 'skin_graphite_serpent', preloadPath: 'skins/skin_graphite_serpent.png' },
    skin_giant: { id: 'skin_giant', type: 'skin', name: 'Giant Slate', rarity: 'gold', texture: 'skin_giant', preloadPath: 'skins/skin_giant.png' },
    skin_math: { id: 'skin_math', type: 'skin', name: 'Chalkboard', rarity: 'silver', texture: 'skin_math', preloadPath: 'skins/skin_math.png' },
    skin_vocab: { id: 'skin_vocab', type: 'skin', name: 'Dictionary Print', rarity: 'silver', texture: 'skin_vocab', preloadPath: 'skins/skin_vocab.png' },
    skin_science: { id: 'skin_science', type: 'skin', name: 'Lab Neon', rarity: 'silver', texture: 'skin_science', preloadPath: 'skins/skin_science.png' },
    skin_phantom: { id: 'skin_phantom', type: 'skin', name: 'Phantom Serpent', rarity: 'mythic', texture: 'skin_phantom', preloadPath: 'skins/skin_phantom.png' },

    // Trails
    trail_default: { id: 'trail_default', type: 'trail', name: 'No Trail', rarity: 'bronze', color: 0x000000, speed: 0, lifespan: 0, isDefault: true },
    trail_neon_line: { id: 'trail_neon_line', type: 'trail', name: 'Neon Line', rarity: 'bronze', color: 0x22d3ee, width: 8 },
    trail_lightning_dash: { id: 'trail_lightning_dash', type: 'trail', name: 'Lightning Dash', rarity: 'silver', color: 0xfbbf24, sparkle: true },
    trail_photon_beam: { id: 'trail_photon_beam', type: 'trail', name: 'Photon Beam', rarity: 'diamond', color: 0x7dd3fc, speed: 240 },
    trail_neural_storm: { id: 'trail_neural_storm', type: 'trail', name: 'Neural Storm', rarity: 'mythic', colors: [0x22d3ee, 0xa855f7, 0xf472b6], chaotic: true },
    trail_marathon: { id: 'trail_marathon', type: 'trail', name: 'Marathon Wake', rarity: 'silver', color: 0x10b981, long: true },

    // Glows / aura
    glow_electric_blue: { id: 'glow_electric_blue', type: 'glow', name: 'Electric Blue', rarity: 'silver', color: 0x60a5fa, radius: 42 },
    glow_emerald: { id: 'glow_emerald', type: 'glow', name: 'Emerald Focus', rarity: 'silver', color: 0x34d399, radius: 38 },
    glow_night: { id: 'glow_night', type: 'glow', name: 'Night Learner', rarity: 'silver', color: 0x6366f1, radius: 36 },
    aura_survivor: { id: 'aura_survivor', type: 'aura', name: 'Survivor Aura', rarity: 'silver', color: 0x38bdf8 },
    aura_heartbeat: { id: 'aura_heartbeat', type: 'aura', name: 'Heartbeat Aura', rarity: 'gold', color: 0xef4444, pulse: true },

    // Head / accessory / titles
    crown_effect: { id: 'crown_effect', type: 'headFx', name: 'Crown', rarity: 'diamond', icon: '👑' },
    title_genius_mode: { id: 'title_genius_mode', type: 'title', name: 'Genius Mode', rarity: 'gold', text: 'Genius Mode' },
    title_comeback: { id: 'title_comeback', type: 'title', name: 'Comeback Kid', rarity: 'gold', text: 'Comeback Kid' },
    title_explorer: { id: 'title_explorer', type: 'title', name: 'Explorer', rarity: 'gold', text: 'Explorer' },
    title_all_rounder: { id: 'title_all_rounder', type: 'title', name: 'All-rounder', rarity: 'gold', text: 'All-rounder' },

    // FX
    spawn_thunder_flash: { id: 'spawn_thunder_flash', type: 'spawnFx', name: 'Thunder Flash', rarity: 'gold', colors: [0xfacc15, 0xf97316] },
    spawn_confetti: { id: 'spawn_confetti', type: 'spawnFx', name: 'Gold Confetti', rarity: 'diamond', colors: [0xfbbf24, 0xf97316, 0xffffff] },
    death_knowledge_burst: { id: 'death_knowledge_burst', type: 'deathFx', name: 'Knowledge Burst', rarity: 'diamond', colors: [0x22d3ee, 0xf472b6] },

    // Decals / shimmer
    decal_basic: { id: 'decal_basic', type: 'decal', name: 'Stripe Decal', rarity: 'bronze' },
    decal_gradient: { id: 'decal_gradient', type: 'decal', name: 'Gradient Spine', rarity: 'silver' },
    shimmer_mega: { id: 'shimmer_mega', type: 'shimmer', name: 'Segment Shimmer', rarity: 'diamond' },

    // Themes
    theme_default: { id: 'theme_default', type: 'theme', name: 'Classic Grid', rarity: 'bronze', bgTexture: 'background', preloadPath: 'themes/tile.png', isDefault: true },
    theme_clean_slate: { id: 'theme_clean_slate', type: 'theme', name: 'Clean Slate', rarity: 'gold', bgTexture: 'theme_clean_slate_bg', preloadPath: 'themes/theme_clean_slate_bg.png' },
    theme_space: { id: 'theme_space', type: 'theme', name: 'Deep Space', rarity: 'mythic', bgTexture: 'theme_space_bg', preloadPath: 'themes/theme_space_bg.png' },

    // Stickers / misc
    sticker_smile: { id: 'sticker_smile', type: 'sticker', name: 'First Game Sticker', rarity: 'bronze' }
};

export const GENERATED_SKIN_TEXTURE_PREFIX = 'reward_skin_';

function resolveReward(rewardOrId) {
    if (!rewardOrId) return null;
    if (typeof rewardOrId === 'string') return REWARDS[rewardOrId] || null;
    return rewardOrId;
}

export function getGeneratedSkinTextureKey(rewardOrId) {
    const reward = resolveReward(rewardOrId);
    if (!reward || reward.type !== 'skin') return null;
    return `${GENERATED_SKIN_TEXTURE_PREFIX}${reward.id}`;
}

export function getSkinTextureKey(rewardOrId) {
    const reward = resolveReward(rewardOrId);
    if (!reward || reward.type !== 'skin') return null;
    return reward.texture || getGeneratedSkinTextureKey(reward);
}

export function ensureSkinTextureForScene(scene, rewardOrId) {
    const reward = resolveReward(rewardOrId);
    if (!reward || reward.type !== 'skin') return null;

    if (reward.texture) {
        return reward.texture;
    }

    const generatedKey = getGeneratedSkinTextureKey(reward);
    if (!scene || !scene.textures || !generatedKey) {
        return generatedKey;
    }

    if (!scene.textures.exists(generatedKey)) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        const fill = reward.tint || 0xffffff;
        const alpha = reward.alpha ?? 1;

        graphics.fillStyle(fill, alpha);
        graphics.fillCircle(15, 15, 15);
        graphics.lineStyle(3, 0xffffff, Math.min(0.35, alpha));
        graphics.strokeCircle(15, 15, 12);
        graphics.generateTexture(generatedKey, 30, 30);
        graphics.destroy();
    }

    return generatedKey;
}

export function getRewardPreloadEntries() {
    const entries = [];
    const seen = new Set();

    Object.values(REWARDS).forEach((reward) => {
        if (reward.texture && reward.type === 'skin') {
            const key = reward.texture;
            const path = reward.preloadPath || `skins/${reward.texture}.png`;
            if (!seen.has(key)) {
                seen.add(key);
                entries.push({ key, path });
            }
        }

        if (reward.bgTexture && reward.type === 'theme') {
            const key = reward.bgTexture;
            const path = reward.preloadPath || `themes/${reward.bgTexture}.png`;
            if (!seen.has(key)) {
                seen.add(key);
                entries.push({ key, path });
            }
        }
    });

    return entries;
}
