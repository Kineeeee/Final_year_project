import { REWARDS } from '../RewardsCatalog';
import { Logger } from '../../../utils/Logger';

export function slotForRewardType(type) {
    switch (type) {
        case 'skin':
        case 'trail':
        case 'glow':
        case 'aura':
        case 'headFx':
        case 'title':
        case 'spawnFx':
        case 'deathFx':
        case 'theme':
        case 'decal':
        case 'shimmer':
            return type;
        default:
            return null;
    }
}

export function emitSocketSafely(networkManager, eventName, payload) {
    if (!networkManager || !eventName) return false;

    try {
        if (typeof networkManager.emit === 'function') {
            networkManager.emit(eventName, payload);
            return true;
        }

        if (networkManager.socket && typeof networkManager.socket.emit === 'function') {
            networkManager.socket.emit(eventName, payload);
            return true;
        }
    } catch (e) {
        Logger.warn('Achievements', `Failed to emit ${eventName}`, e);
    }

    return false;
}

export function requestEquipReward({ state, rewardId, saveState, emitUpdated, networkManager }) {
    const reward = REWARDS[rewardId];
    if (!reward || (!state.rewardsOwned[rewardId] && !reward.isDefault)) return false;

    const slot = slotForRewardType(reward.type);
    if (!slot) return false;

    state.activeCosmetics[slot] = rewardId;
    saveState();
    emitUpdated();

    emitSocketSafely(networkManager, 'equip_cosmetic', { rewardId, category: slot });
    return true;
}

export function requestUnequipReward({ state, category, saveState, emitUpdated, networkManager }) {
    if (!category) return false;

    state.activeCosmetics[category] = null;
    saveState();
    emitUpdated();

    emitSocketSafely(networkManager, 'equip_cosmetic', { rewardId: null, category });
    return true;
}

export function syncServerCosmetics({ state, serverCosmetics, saveState, emitUpdated, baseActiveCosmetics }) {
    if (!serverCosmetics || typeof serverCosmetics !== 'object') return;
    const keys = Object.keys(serverCosmetics);
    if (keys.length === 0) return;

    state.activeCosmetics = {
        ...baseActiveCosmetics,
        ...serverCosmetics,
    };
    saveState();
    emitUpdated();
}

export function syncServerUnlocks({ state, unlockedRewardsArray, saveState }) {
    if (!Array.isArray(unlockedRewardsArray)) return;
    unlockedRewardsArray.forEach((id) => {
        state.rewardsOwned[id] = true;
    });
    saveState();
}
