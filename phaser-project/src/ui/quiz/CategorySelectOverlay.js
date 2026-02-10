import { globalQuizPrefs } from '../../core/services/GlobalQuizPrefs';
import { userQuizApi } from '../../core/services/UserQuizApi';
import { overlayBlocker } from '../../core/services/OverlayBlocker';

export class CategorySelectOverlay {
    constructor({ onSelect, onCancel } = {}) {
        this.onSelect = onSelect;
        this.onCancel = onCancel;
        this.root = null;
    }

    open() {
        this.blockToken = overlayBlocker.block('category-select');
        if (this.root) return;
        this.root = document.createElement('div');
        this.root.className = 'quiz-overlay';
        this.root.innerHTML = `
          <div class="quiz-overlay__backdrop"></div>
          <div class="quiz-overlay__panel small">
            <div class="quiz-overlay__header">
              <div>
                <div class="eyebrow">Chọn category</div>
                <h2>Math hay English?</h2>
              </div>
              <button class="ghost-btn" data-action="close">✕</button>
            </div>
            <div class="chip-row">
              <button class="chip" data-cat="math">Math</button>
              <button class="chip" data-cat="english">English</button>
            </div>
            <div class="error-box" data-role="message"></div>
          </div>`;
        document.body.appendChild(this.root);
        this.root.style.pointerEvents = 'auto';
        const panel = this.root.querySelector('.quiz-overlay__panel');
        if (panel) {
            panel.style.pointerEvents = 'auto';
            panel.addEventListener('pointerdown', (e) =>
                console.log('[CategoryOverlay] pointerdown target=', e.target?.className || e.target?.tagName)
            );
        }
        this.root.querySelector('[data-action=close]').addEventListener('click', () => this.close());
        this.root.querySelectorAll('[data-cat]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleChoose(btn.dataset.cat);
            });
            btn.addEventListener('pointerdown', (e) => e.stopPropagation());
        });
    }

    async handleChoose(category) {
        const msg = this.root.querySelector('[data-role=message]');
        msg.textContent = '';
        const source = globalQuizPrefs.getQuizSource();
        if (source === 'USER') {
            try {
                const status = await userQuizApi.getStatus(category);
                if (!status?.isValid) {
                    msg.textContent = 'Bạn chưa có đề cho category này';
                    return;
                }
            } catch (e) {
                msg.textContent = e.message || 'Không kiểm tra được đề';
                return;
            }
        }
        if (typeof this.onSelect === 'function') this.onSelect(category);
        this.close();
    }

    close() {
        if (this.root) this.root.remove();
        this.root = null;
        overlayBlocker.unblock(this.blockToken);
        if (typeof this.onCancel === 'function') this.onCancel();
    }
}
