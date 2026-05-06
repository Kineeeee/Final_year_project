import { Logger } from '../../utils/Logger';
import { QuizSetupOverlay } from '../../ui/quiz/QuizSetupOverlay';
import { globalQuizPrefs } from '../../core/services/GlobalQuizPrefs';
import { CustomRoomModal } from '../../ui/quiz/CustomRoomModal';
import { userQuizApi } from '../../core/services/UserQuizApi';
import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { roomService } from '../../core/services/RoomService';
import io from 'socket.io-client';
import parser from 'socket.io-msgpack-parser';
import { CONFIG } from '../../config/AppConfig';

export class MainMenuFlowController {
    constructor(scene) {
        this.scene = scene;
    }

    startGame(mode) {
        const s = this.scene;
        const isBlocked = overlayBlocker.isBlocked();
        if (isBlocked) {
            Logger.warn('MainMenu', 'Start blocked because overlay is active');
            return;
        }
        if (mode === 'custom_quiz') {
            this.startCustomQuizFlow();
            return;
        }
        if (mode === 'quiz') {
            // Quiz now requires explicit category selection.
            this.openCategorySelect('quiz');
            return;
        }
        if (mode === 'shooting') {
            this.openCategorySelect(mode);
            return;
        }

        Logger.info('MainMenu', `Starting: ${mode}`);
        s.cameras.main.fadeOut(300);
        s.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
            s.scene.start('Game', { mode: mode });
        });
    }

    async startCustomQuizFlow() {
        const s = this.scene;
        if (overlayBlocker.isBlocked()) return;
        if (!s.customOverlay) {
            const { width, height } = s.scale;
            s.customOverlay = new CustomRoomModal(s, width / 2, height / 2, {
                onJoin: (code) => {
                    s.customOverlay?.close();
                    this.startCustomRoomJoin(code);
                },
                onCreate: () => {
                    s.customOverlay?.close();
                    this.openCategorySelect('custom_create');
                },
                onClose: () => {
                    s.input.enabled = true;
                    s.customOverlay = null; // Clean up reference
                }
            });
        }
    }

    startCustomRoomJoin(code) {
        const s = this.scene;
        (async () => {
            try {
                const meta = await roomService.getRoomMeta(code);
                if (meta.players >= meta.capacity) {
                    this.showNetworkErrorModal('Phòng đã đầy.');
                    return;
                }
                if (meta.started) {
                    this.showNetworkErrorModal('Trận đấu trong phòng này đã bắt đầu. Không thể tham gia.');
                    return;
                }
                Logger.info('MainMenu', `Join custom room ${code}`);
                const namespace = `/custom/${code}`;
                s.cameras.main.fadeOut(300);
                s.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                    s.scene.start('Game', {
                        mode: 'quiz',
                        quizSource: 'USER',
                        customNamespace: namespace,
                        roomMeta: meta
                    });
                });
            } catch (err) {
                const msg = err.response?.data?.message === 'room_already_started'
                    ? 'Trận đấu trong phòng đã bắt đầu.'
                    : (err.message || 'Không tìm thấy phòng');
                this.showNetworkErrorModal(msg);
            }
        })();
    }

    async setGlobalQuizSource(src) {
        const s = this.scene;
        if (src === 'USER') {
            // Require at least one valid quiz in any category; deeper check when selecting category
            try {
                const [mathStatus, engStatus] = s.userQuizStatus
                    ? [s.userQuizStatus.math, s.userQuizStatus.english]
                    : await Promise.all([
                        userQuizApi.getStatus('math').catch(() => null),
                        userQuizApi.getStatus('english').catch(() => null),
                    ]);
                const hasValid = (mathStatus && mathStatus.isValid) || (engStatus && engStatus.isValid);
                if (!hasValid) {
                    this.showNetworkErrorModal('You don\'t have valid questions for Math or English. Using system questions.');
                    this.refreshSourceChips();
                    return;
                }
                s.userQuizStatus = { math: mathStatus, english: engStatus };
            } catch (e) {
                this.showNetworkErrorModal('Cannot check your questions. Using system questions.');
                this.refreshSourceChips();
                return;
            }
            globalQuizPrefs.setQuizSource('USER');
        } else {
            globalQuizPrefs.setQuizSource('SYSTEM');
        }
        this.refreshSourceChips();
    }

    refreshSourceChips() {
        const s = this.scene;
        const src = globalQuizPrefs.getQuizSource();
        if (s.chipSystem) s.chipSystem.setAlpha(src === 'SYSTEM' ? 1 : 0.5);
        if (s.chipUser) {
            s.chipUser.setAlpha(src === 'USER' ? 1 : 0.5);
            if (s.userQuizStatus) {
                const allValid = s.userQuizStatus.math?.isValid || s.userQuizStatus.english?.isValid;
                s.chipUser.setTint(allValid ? 0xffffff : 0xffaa00);
            }
        }
    }

    async preloadUserQuizStatus() {
        const s = this.scene;
        if (!localStorage.getItem('token')) return;
        try {
            const [mathStatus, engStatus] = await Promise.all([
                userQuizApi.getStatus('math').catch(() => null),
                userQuizApi.getStatus('english').catch(() => null),
            ]);
            s.userQuizStatus = { math: mathStatus, english: engStatus };
            this.refreshSourceChips();
        } catch (e) {
            // ignore
        }
    }

    openUploadOverlay() {
        const s = this.scene;
        const token = localStorage.getItem('token');
        if (!token) {
            this.showNetworkErrorModal('Please login to upload your questions.');
            return;
        }
        const mountNode = document.getElementById('game-container') || document.body;
        const overlay = new QuizSetupOverlay({
            defaultCategory: 'math',
            mountNode,
            onClose: () => {
                s.input.enabled = true;
            },
            disablePlay: true,
        });
        try {
            // Do not hard-disable scene input here; if overlay rendering fails,
            // MainMenu must remain usable instead of looking frozen.
            overlay.open();
        } catch (err) {
            s.input.enabled = true;
            this.showNetworkErrorModal(err?.message || 'Không mở được màn hình Upload');
        }
    }

    openCategorySelect(mode) {
        const s = this.scene;
        if (s._categoryModal) return;

        const { width, height } = s.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        const overlay = s.add.container(0, 0).setDepth(100);

        const bg = s.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
        bg.setInteractive();

        const modal = s.add.container(centerX, centerY);
        const panelW = Math.min(720, width * 0.9);
        const panelH = 340;

        const panelBg = s.add.graphics();
        panelBg.fillStyle(0x000000, 0.5);
        panelBg.fillRoundedRect(-panelW / 2 + 6, -panelH / 2 + 6, panelW, panelH, 12);
        panelBg.fillStyle(0x273043, 1);
        panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);

        const title = s.add.text(0, -panelH / 2 + 72, 'Chọn Category', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '30px',
            color: '#fff',
            stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // Add static panel elements first so interactive buttons stay above them.
        modal.add([panelBg, title]);

        s.createStylishButton(modal, -160, 26, 'Math', 0x27ae60, () => this.handleCategoryChoice('math', mode, overlay));
        s.createStylishButton(modal, 160, 26, 'English', 0x8e44ad, () => this.handleCategoryChoice('english', mode, overlay));

        s.createPixelButton(modal, 0, panelH / 2 - 54, 'ĐÓNG', 0x7f8c8d, () => {
            overlay.destroy();
            s._categoryModal = null;
        });

        bg.on('pointerdown', (pointer) => {
            const insidePanel =
                pointer.x >= centerX - panelW / 2 &&
                pointer.x <= centerX + panelW / 2 &&
                pointer.y >= centerY - panelH / 2 &&
                pointer.y <= centerY + panelH / 2;
            if (insidePanel) return;
            overlay.destroy();
            s._categoryModal = null;
        });
        overlay.add([bg, modal]);

        modal.setScale(0.8);
        s.tweens.add({ targets: modal, scale: 1, duration: 150, ease: 'Back.easeOut' });

        s._categoryModal = overlay;
    }

    handleCategoryChoice(category, mode, overlay) {
        const s = this.scene;
        overlay.destroy();
        s._categoryModal = null;

        const source = (mode === 'custom_create') ? 'USER' : globalQuizPrefs.getQuizSource();
        const proceed = async () => {
            let finalSource = source;
            if (source === 'USER') {
                if (mode === 'custom_create') {
                    try {
                        const { namespace } = await roomService.createCustomRoom(category);
                        Logger.info('MainMenu', `Created custom room ${namespace}`);
                        s.cameras.main.fadeOut(300);
                        s.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                            s.scene.start('Game', { mode: 'quiz', quizSource: 'USER', customNamespace: namespace });
                        });
                        return;
                    } catch (err) {
                        this.showNetworkErrorModal(err.message || 'Tạo phòng custom thất bại');
                        return;
                    }
                } else {
                    try {
                        const status = await userQuizApi.getStatus(category);
                        if (!status?.isValid) {
                            finalSource = 'SYSTEM';
                            this.showNetworkErrorModal('You don\'t have valid questions for this category. Using system questions.');
                        }
                    } catch (e) {
                        finalSource = 'SYSTEM';
                        this.showNetworkErrorModal('Cannot check your questions. Using system questions.');
                    }
                }
            }
            if (mode === 'quiz') {
                Logger.info('MainMenu', `Starting Quiz ${category} source=${finalSource}`);
                s.cameras.main.fadeOut(300);
                s.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                    s.scene.start('Game', { mode: category, quizSource: finalSource });
                });
            } else if (mode === 'shooting') {
                Logger.info('MainMenu', `Starting Shooting ${category} source=${finalSource}`);
                s.cameras.main.fadeOut(300);
                s.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
                    s.scene.start('ShootingScene', { category, quizSource: finalSource });
                });
            }
        };
        proceed();
    }

    showNetworkErrorModal(message) {
        const s = this.scene;
        if (s._errorModal) return; // Prevent spam

        const { width, height } = s.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        const overlay = s.add.container(0, 0).setDepth(100);

        // Dark background
        const bg = s.add.rectangle(0, 0, width, height, 0x000000, 0.85).setOrigin(0);
        bg.setInteractive(); // consume clicks

        // Modal panel
        const modal = s.add.container(centerX, centerY);
        const panelW = Math.min(600, width * 0.8);
        const panelH = 300;

        const panelBg = s.add.graphics();
        panelBg.fillStyle(0x000000, 0.5);
        panelBg.fillRoundedRect(-panelW / 2 + 6, -panelH / 2 + 6, panelW, panelH, 12);
        panelBg.fillStyle(0x2b3b5c, 1);
        panelBg.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);
        panelBg.lineStyle(6, 0xe74c3c, 1);
        panelBg.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 12);

        const title = s.add.text(0, -panelH / 2 + 40, 'LỖI', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '24px',
            color: '#e74c3c',
            stroke: '#000000',
            strokeThickness: 4,
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', fill: true }
        }).setOrigin(0.5);

        const closeX = s.add.text(panelW / 2 - 24, -panelH / 2 + 28, 'X', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '22px',
            color: '#e74c3c',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        closeX.on('pointerdown', () => {
            overlay.destroy();
            s._errorModal = null;
        });

        const msgText = s.add.text(0, 0, message, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '14px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: panelW - 40 }
        }).setOrigin(0.5);

        modal.add([panelBg, title, msgText, closeX]);

        // Close button
        s.createStylishButton(modal, 0, panelH / 2 - 50, 'ĐÓNG', 0xe74c3c, () => {
            overlay.destroy();
            s._errorModal = null;
        });

        bg.on('pointerdown', (pointer) => {
            const insidePanel =
                pointer.x >= centerX - panelW / 2 &&
                pointer.x <= centerX + panelW / 2 &&
                pointer.y >= centerY - panelH / 2 &&
                pointer.y <= centerY + panelH / 2;
            if (insidePanel) return;
            overlay.destroy();
            s._errorModal = null;
        });
        overlay.add([bg, modal]);

        // Pop animation
        modal.setScale(0.8);
        s.tweens.add({
            targets: modal,
            scale: 1,
            duration: 150,
            ease: 'Back.easeOut'
        });

        s._errorModal = overlay;
    }

    requestGlobalLeaderboard({ limit = 5, onSuccess, onError } = {}) {
        const socket = io(CONFIG.SERVER_URL, {
            forceNew: true,
            parser,
            reconnection: false,
            timeout: 5000,
        });

        let settled = false;
        let fallbackTimer = null;

        const emitSuccess = (payload) => {
            if (settled) return;
            settled = true;
            if (onSuccess) onSuccess(payload);
        };

        const emitError = (err) => {
            if (settled) return;
            settled = true;
            if (onError) onError(err);
        };

        const cleanup = () => {
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            socket.removeAllListeners();
            socket.disconnect();
        };

        const requestViaHttp = async () => {
            try {
                const endpoint = `${CONFIG.SERVER_URL}/api/leaderboard/global?limit=${encodeURIComponent(limit)}`;
                const res = await fetch(endpoint, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const payload = await res.json();
                emitSuccess(payload);
            } catch (err) {
                emitError(err);
            } finally {
                cleanup();
            }
        };

        socket.on('connect', () => {
            socket.emit('requestGlobalLeaderboard', { limit });
            fallbackTimer = setTimeout(() => {
                requestViaHttp();
            }, 2500);
        });

        socket.on('globalLeaderboard', (payload) => {
            emitSuccess(payload);
            cleanup();
        });

        socket.on('connect_error', (err) => {
            requestViaHttp().catch(() => {
                emitError(err);
                cleanup();
            });
        });

        return cleanup;
    }
}