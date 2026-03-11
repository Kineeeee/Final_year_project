import Phaser from 'phaser';
import { achievementManager } from './AchievementManager';
import { REWARDS } from './rewardsCatalog';
import { Logger } from '../../utils/Logger';

const DEFAULT_BG = '#028af8';

export function applyActiveCosmeticsToSnake(scene, snake) {
    if (!scene || !snake) return;
    const active = achievementManager.state?.activeCosmetics || {};

    cleanupCosmetics(snake);

    Object.keys(active).forEach((slot) => {
        const rewardId = active[slot];
        if (!rewardId) return;
        const reward = REWARDS[rewardId];
        if (!reward) return;
        try {
            switch (reward.type) {
                case 'skin':
                    applySkin(snake, reward);
                    break;
                case 'trail':
                    applyTrail(scene, snake, reward);
                    break;
                case 'glow':
                    applyGlow(scene, snake, reward);
                    break;
                case 'aura':
                    applyAura(scene, snake, reward);
                    break;
                case 'headFx':
                    applyHeadFx(scene, snake, reward);
                    break;
                case 'title':
                    applyTitle(scene, snake, reward);
                    break;
                case 'spawnFx':
                    playSpawnFx(scene, snake, reward);
                    break;
                case 'deathFx':
                    snake.cosmeticDeathFx = reward;
                    break;
                case 'decal':
                    applyDecal(snake, reward);
                    break;
                case 'shimmer':
                    applyShimmer(scene, snake, reward);
                    break;
                default:
                    break;
            }
        } catch (e) {
            Logger.error('Cosmetics', `Failed to apply ${rewardId}`, e);
        }
    });
}

export function playDeathFx(scene, snake) {
    if (!scene || !snake || !snake.cosmeticDeathFx) return;
    const reward = snake.cosmeticDeathFx;
    const colors = reward.colors || [0xffffff];
    const emitter = scene.add.particles(0, 0, 'snake-circle', {
        speed: 240,
        scale: { start: 1.2 * (snake.scale || 1), end: 0 },
        lifespan: 600,
        blendMode: 'ADD',
        tint: colors,
        quantity: 32,
        emitting: false,
    });
    emitter.explode(32, snake.head.x, snake.head.y);
    scene.time.delayedCall(700, () => emitter.destroy());
}

export function applyActiveTheme(scene) {
    if (!scene) return;
    const themeId = achievementManager.state?.activeCosmetics?.theme;
    const reward = REWARDS[themeId];
    const colorHex = reward?.backgroundColor || DEFAULT_BG;
    scene.cameras?.main?.setBackgroundColor(colorHex);

    if (scene.backgroundTile && scene.backgroundTile.setTint) {
        const tintInt = Phaser.Display.Color.HexStringToColor(colorHex).color;
        scene.backgroundTile.setTint(tintInt);
    }

    if (!reward || !reward.overlayAlpha) {
        if (scene._themeOverlay) {
            scene._themeOverlay.destroy();
            scene._themeOverlay = null;
        }
        return;
    }

    if (!scene._themeOverlay) {
        scene._themeOverlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, reward.overlayAlpha)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(1);
    } else {
        scene._themeOverlay.setFillStyle(0x000000, reward.overlayAlpha);
    }
}

// --- helpers ---
function cleanupCosmetics(snake) {
    if (snake.cosmeticTrailEmitter) {
        snake.cosmeticTrailEmitter.destroy();
        snake.cosmeticTrailEmitter = null;
    }
    if (snake.cosmeticGlow) {
        snake.cosmeticGlow.destroy();
        snake.cosmeticGlow = null;
    }
    if (snake.cosmeticAura) {
        snake.cosmeticAura.destroy();
        snake.cosmeticAura = null;
    }
    if (snake.cosmeticHeadFx) {
        snake.cosmeticHeadFx.destroy();
        snake.cosmeticHeadFx = null;
    }
    if (snake.cosmeticTitleText) {
        snake.cosmeticTitleText.destroy();
        snake.cosmeticTitleText = null;
    }
    if (snake.cosmeticShimmerTween) {
        snake.cosmeticShimmerTween.stop();
        snake.cosmeticShimmerTween = null;
    }
    snake.cosmeticDeathFx = null;
}

function applySkin(snake, reward) {
    if (reward.tint) snake.setColor(reward.tint);
    if (reward.alpha) {
        snake.head.setAlpha(reward.alpha);
        snake.body.forEach((b) => b.setAlpha(reward.alpha));
    }
}

function applyTrail(scene, snake, reward) {
    const colors = reward.colors || [reward.color || 0x22d3ee];
    const emitter = scene.add.particles(0, 0, 'snake-circle', {
        speed: reward.speed || 140,
        scale: { start: (reward.width ? reward.width / 10 : 1.1) * (snake.scale || 1), end: 0 },
        lifespan: reward.long ? 900 : 600,
        blendMode: 'ADD',
        tint: colors,
        emitting: false,
    });
    emitter.setDepth(3);
    snake.cosmeticTrailEmitter = emitter;
}

function applyGlow(scene, snake, reward) {
    const radius = reward.radius || 32;
    const glow = scene.add.circle(snake.head.x, snake.head.y, radius, reward.color || 0xffffff, 0.25);
    glow.setDepth(3);
    snake.cosmeticGlow = glow;
}

function applyAura(scene, snake, reward) {
    const radius = (reward.radius || 46) * (snake.scale || 1);
    const aura = scene.add.circle(snake.head.x, snake.head.y, radius, reward.color || 0xffffff, 0.18);
    aura.setDepth(2);
    aura.pulse = !!reward.pulse;
    snake.cosmeticAura = aura;
}

function applyHeadFx(scene, snake, reward) {
    const fx = scene.add.text(snake.head.x, snake.head.y - 30, reward.icon || '★', {
        fontFamily: 'Arial',
        fontSize: '26px',
        stroke: '#000000',
        strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    snake.cosmeticHeadFx = fx;
}

function applyTitle(scene, snake, reward) {
    const txt = scene.add.text(snake.head.x, snake.head.y - 48, reward.text || reward.name, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#f8fafc',
        stroke: '#000000',
        strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);
    snake.cosmeticTitleText = txt;
}

function playSpawnFx(scene, snake, reward) {
    const colors = reward.colors || [0xffffff];
    const emitter = scene.add.particles(0, 0, 'snake-circle', {
        speed: 220,
        scale: { start: 1.4 * (snake.scale || 1), end: 0 },
        lifespan: 500,
        tint: colors,
        blendMode: 'ADD',
        emitting: false,
    });
    emitter.explode(26, snake.head.x, snake.head.y);
    scene.time.delayedCall(650, () => emitter.destroy());
}

function applyDecal(snake, reward) {
    const baseTint = snake.color || 0xffffff;
    snake.body.forEach((part, idx) => {
        const factor = (reward.id === 'decal_gradient') ? (0.8 + 0.4 * (idx / Math.max(1, snake.body.length))) : (idx % 2 === 0 ? 1 : 0.75);
        const colorObj = Phaser.Display.Color.IntegerToColor(baseTint).clone();
        colorObj.brighten(Math.round(30 * factor));
        part.setTint(colorObj.color);
    });
}

function applyShimmer(scene, snake, reward) {
    const baseTint = snake.color || 0xffffff;
    const c1 = Phaser.Display.Color.IntegerToColor(baseTint).brighten(30).color;
    const c2 = Phaser.Display.Color.IntegerToColor(baseTint).darken(20).color;
    snake.cosmeticShimmerTween = scene.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 1200,
        repeat: -1,
        yoyo: true,
        onUpdate: (tw) => {
            const t = tw.getValue() / 100;
            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(
                Phaser.Display.Color.IntegerToColor(c1),
                Phaser.Display.Color.IntegerToColor(c2),
                1,
                t
            );
            const tint = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
            snake.head.getAt(0)?.setTint(tint);
            snake.body.forEach((b, idx) => {
                const localT = (t + idx * 0.05) % 1;
                const mix2 = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.IntegerToColor(c1),
                    Phaser.Display.Color.IntegerToColor(c2),
                    1,
                    localT
                );
                b.setTint(Phaser.Display.Color.GetColor(mix2.r, mix2.g, mix2.b));
            });
        }
    });
    snake.cosmeticShimmerTween.play();
}
