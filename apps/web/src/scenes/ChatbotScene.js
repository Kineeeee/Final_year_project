import { Scene } from 'phaser';
import { chatbotApi } from '../core/services/ChatbotApi';
import { Logger } from '../utils/Logger';

export class ChatbotScene extends Scene {
    constructor() {
        super('ChatbotScene');
        this.messages = [];
        this.isSending = false;
        this.domRefs = null;
        this.domUi = null;
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0);

        const panelW = Math.min(1200, width * 0.92);
        const panelH = Math.min(840, height * 0.9);

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.5);
        panel.fillRoundedRect(centerX - panelW / 2 + 6, centerY - panelH / 2 + 6, panelW, panelH, 16);
        panel.fillStyle(0x1f2b44, 1);
        panel.fillRoundedRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH, 16);
        panel.lineStyle(5, 0x38bdf8, 1);
        panel.strokeRoundedRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH, 16);

        this.add.text(centerX, centerY - panelH / 2 + 40, 'CHATBOT', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);

        this.statusText = this.add.text(centerX, centerY - panelH / 2 + 82, 'Nhap cau hoi va nhan Enter', {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '25px',
            color: '#9ee7ff',
        }).setOrigin(0.5);

        const chatX = centerX - panelW / 2 + 34;
        const chatY = centerY - panelH / 2 + 120;
        const chatW = panelW - 68;
        const chatH = panelH - 250;

        this.createChatDomUI({
            centerX,
            centerY,
            panelW,
            panelH,
            chatX,
            chatY,
            chatW,
            chatH,
        });

        this.createActionButton(centerX + panelW / 2 - 95, centerY - panelH / 2 + 42, 'CLOSE', 0xe74c3c, () => {
            this.closeScene();
        });

        this.addSeedMessages();
        this.renderMessages();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.destroyDomUi();
        });

        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this.destroyDomUi();
        });
    }

    createChatDomUI(layout) {
        const { panelH, chatX, chatY, chatW } = layout;
        const domX = chatX + chatW / 2;
        const domW = chatW;
        const domH = panelH - 170;
        const domY = chatY + domH / 2;
        const inputAreaH = 64;

        const html = `
            <div id="chatbot-dom-root" style="
                width:${Math.floor(domW)}px;
                height:${Math.floor(domH)}px;
                display:flex;
                flex-direction:column;
                gap:20px;
                background:transparent;
                font-family:'Press Start 2P', monospace;
                color:#ffffff;
                pointer-events:auto;
            ">
                <div id="chat-log" style="
                    flex:1;
                    overflow-y:auto;
                    overflow-x:hidden;
                    border:2px solid #4a6ea8;
                    border-radius:10px;
                    background:rgba(11,18,32,0.95);
                    padding:14px 16px;
                    line-height:1.8;
                    font-size:25px;
                    white-space:pre-wrap;
                    word-break:break-word;
                    box-sizing:border-box;
                "></div>
                <div style="
                    display:flex;
                    align-items:stretch;
                    gap:14px;
                    height:${inputAreaH}px;
                    background:transparent;
                ">
                    <textarea id="chat-input" rows="2" placeholder="Nhap cau hoi..." style="
                        flex:1;
                        height:100%;
                        resize:none;
                        border:2px solid #7dd3fc;
                        border-radius:10px;
                        background:rgba(11,18,32,1);
                        color:#ffffff;
                        font-family:'Press Start 2P', monospace;
                        font-size:25px;
                        padding:10px 12px;
                        outline:none;
                        box-sizing:border-box;
                    "></textarea>
                    <button id="send-btn" type="button" style="
                        width:151px;
                        height:100%;
                        border:2px solid #000000;
                        background:linear-gradient(#27ae60 0 85%, #1f8f4f 85% 100%);
                        color:#ffffff;
                        font-family:'Press Start 2P', monospace;
                        font-size:25px;
                        cursor:pointer;
                    ">SEND</button>
                </div>
            </div>
        `;

        this.domUi = this.add.dom(domX, domY).createFromHTML(html);
        this.domUi.setOrigin(0.5);

        const root = this.domUi.node;
        const chatLog = root.querySelector('#chat-log');
        const chatInput = root.querySelector('#chat-input');
        const sendBtn = root.querySelector('#send-btn');

        this.domRefs = { root, chatLog, chatInput, sendBtn };

        this.handleSendClick = () => {
            this.sendCurrentMessage();
        };
        this.handleInputKeyDown = (event) => {
            if (!event) return;
            if (event.key === 'Escape') {
                this.closeScene();
                return;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendCurrentMessage();
            }
        };

        sendBtn.addEventListener('click', this.handleSendClick);
        chatInput.addEventListener('keydown', this.handleInputKeyDown);

        chatInput.focus();
    }

    createActionButton(x, y, label, color, onClick) {
        const container = this.add.container(x, y);
        const w = 120;
        const h = 44;
        const g = this.add.graphics();
        const darkColor = Phaser.Display.Color.IntegerToColor(color).darken(18).color;

        g.fillStyle(0x000000, 1);
        g.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
        g.fillStyle(darkColor, 1);
        g.fillRect(-w / 2, -h / 2, w, h);
        g.fillStyle(color, 1);
        g.fillRect(-w / 2, -h / 2, w, h - 4);

        const t = this.add.text(0, -1, label, {
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);

        const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => container.setScale(1.05))
            .on('pointerout', () => container.setScale(1))
            .on('pointerdown', () => {
                this.tweens.add({ targets: container, scale: 0.95, duration: 60, yoyo: true });
                onClick();
            });

        container.add([g, t, hit]);
        return container;
    }

    addSeedMessages() {
        this.messages.push({ role: 'assistant', content: 'Xin chao! Toi la chatbot Snake Arena. Ban co the hoi ve che do choi, meo lam bai quiz, hoac chien thuat sinh ton.' });
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    renderMessages() {
        const chatLog = this.domRefs?.chatLog;
        if (!chatLog) return;

        const visible = this.messages.slice(-18);
        const lines = visible.map((m) => {
            const prefix = m.role === 'assistant' ? 'BOT' : 'YOU';
            const color = m.role === 'assistant' ? '#9ee7ff' : '#fef08a';
            return `<div style="margin-bottom:12px;"><span style="color:${color};">${prefix}:</span> ${this.escapeHtml(m.content)}</div>`;
        });
        chatLog.innerHTML = lines.join('');
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    setInputsDisabled(disabled) {
        if (!this.domRefs) return;
        this.domRefs.chatInput.disabled = disabled;
        this.domRefs.sendBtn.disabled = disabled;
        this.domRefs.sendBtn.style.opacity = disabled ? '0.55' : '1';
        this.domRefs.sendBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }

    async sendCurrentMessage() {
        if (this.isSending) return;

        const inputEl = this.domRefs?.chatInput;
        if (!inputEl) return;

        const message = inputEl.value.trim();
        if (!message) return;

        const history = this.messages
            .filter((m) => m.role === 'assistant' || m.role === 'user')
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content }));

        inputEl.value = '';

        this.messages.push({ role: 'user', content: message });
        this.renderMessages();

        this.isSending = true;
        this.setInputsDisabled(true);
        this.statusText.setText('Dang ket noi LLM...');

        try {
            const data = await chatbotApi.ask(message, history);
            const reply = (data?.reply || '').toString().trim() || 'Khong co phan hoi tu chatbot.';
            this.messages.push({ role: 'assistant', content: reply });
            this.statusText.setText('Da nhan phan hoi. Enter de gui tiep, ESC de dong.');
        } catch (err) {
            Logger.error('ChatbotScene', 'Chat request failed', err);
            this.messages.push({ role: 'assistant', content: `Xin loi, ket noi that bai: ${err.message || 'Unknown error'}` });
            this.statusText.setText('Loi ket noi chatbot. Thu lai sau.');
        } finally {
            this.isSending = false;
            this.setInputsDisabled(false);
            this.renderMessages();
            inputEl.focus();
        }
    }

    destroyDomUi() {
        if (!this.domRefs) return;

        const { sendBtn, chatInput } = this.domRefs;
        if (sendBtn && this.handleSendClick) {
            sendBtn.removeEventListener('click', this.handleSendClick);
        }
        if (chatInput && this.handleInputKeyDown) {
            chatInput.removeEventListener('keydown', this.handleInputKeyDown);
        }

        if (this.domUi) {
            this.domUi.destroy();
        }

        this.domRefs = null;
        this.domUi = null;
        this.handleSendClick = null;
        this.handleInputKeyDown = null;
    }

    closeScene() {
        this.destroyDomUi();
        this.scene.stop('ChatbotScene');
        if (this.scene.get('MainMenu')) {
            this.scene.resume('MainMenu');
        }
    }
}
