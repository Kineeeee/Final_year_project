import { userQuizApi } from '../../core/services/UserQuizApi';
import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { Logger } from '../../utils/Logger';

const CATEGORY_LABELS = {
    math: 'Math',
    english: 'English',
};

export class QuizSetupOverlay {
    constructor({ defaultCategory = 'math', onStart, onClose, disablePlay = false } = {}) {
        this.category = defaultCategory;
        this.onStart = onStart;
        this.onClose = onClose;
        this.disablePlay = disablePlay;
        this.selectedQuizSource = 'SYSTEM';
        this.status = null;
        this.previewQuestions = [];
        this.previewErrors = [];

        this.root = null;
        this.textarea = null;
        this.statusBadge = null;
        this.toggleInput = null;
        this.errorBox = null;
        this.previewBox = null;
        this.playButton = null;
        this.saveButton = null;
        this.docInput = null;
        this.sourceLabel = null;
        this.loading = false;
    }

    open() {
        this.blockToken = overlayBlocker.block('quiz-upload');
        if (this.root) return;
        this.root = document.createElement('div');
        this.root.className = 'quiz-overlay';
        this.root.innerHTML = this.renderSkeleton();
        document.body.appendChild(this.root);
        // Ensure overlay is interactable and sits above canvas
        this.root.style.pointerEvents = 'auto';
        console.log('[QuizOverlay] opened, pointerEvents=', this.root.style.pointerEvents);
        this.root.addEventListener('pointerdown', (e) => {
            console.log('[QuizOverlay] pointerdown target=', e.target?.className || e.target?.tagName);
        });

        this.textarea = this.root.querySelector('#quiz-raw-text');
        this.statusBadge = this.root.querySelector('[data-role=status]');
        this.toggleInput = this.root.querySelector('#use-my-quiz');
        this.errorBox = this.root.querySelector('[data-role=errors]');
        this.previewBox = this.root.querySelector('[data-role=preview]');
        this.playButton = this.root.querySelector('[data-action=start]');
        this.saveButton = this.root.querySelector('[data-action=save]');
        this.docInput = this.root.querySelector('#quiz-docx');
        this.sourceLabel = this.root.querySelector('[data-role=source-label]');
        this.playButton.disabled = true;
        if (this.disablePlay && this.playButton) this.playButton.style.display = 'none';

        this.bindEvents();
        this.loadStatus();
    }

    close() {
        if (this.root) {
            this.root.remove();
            this.root = null;
        }
        overlayBlocker.unblock(this.blockToken);
        if (typeof this.onClose === 'function') this.onClose();
        console.log('[QuizOverlay] closed');
    }

    bindEvents() {
        this.root.querySelectorAll('[data-action=category]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.value;
                this.setCategory(cat);
            });
        });

        this.toggleInput.addEventListener('change', () => this.handleToggle());
        this.root.querySelector('[data-action=parse]').addEventListener('click', () => this.handleParse());
        this.saveButton.addEventListener('click', () => this.handleSave());
        this.playButton.addEventListener('click', () => this.handleStart());
        this.root.querySelector('[data-action=close]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        this.docInput.addEventListener('change', (e) => this.handleDocx(e.target.files[0]));
    }

    setCategory(category) {
        if (this.category === category) return;
        this.category = category;
        this.selectedQuizSource = 'SYSTEM';
        this.previewQuestions = [];
        this.previewErrors = [];
        this.renderPreview();
        this.updateSourceLabel();
        this.loadStatus();
    }

    async loadStatus() {
        const token = localStorage.getItem('token');
        if (!token) {
            this.setStatusText('Vui lòng đăng nhập để dùng đề của bạn', 'danger');
            this.toggleInput.disabled = true;
            this.playButton.disabled = false; // system still playable
            return;
        }
        this.setStatusText('Đang tải...', 'muted');
        this.playButton.disabled = true;
        try {
            this.status = await userQuizApi.getStatus(this.category);
            this.updateStatusBadge();
            // Default: system; auto enable toggle if valid and previously selected?
            this.toggleInput.checked = false;
            this.toggleInput.disabled = !this.status.isValid;
            this.updateSourceLabel();
            this.updatePlayButtonState();
        } catch (err) {
            Logger.error('QuizOverlay', 'Status error', err);
            this.setStatusText(err.message || 'Không tải được trạng thái', 'danger');
            this.toggleInput.checked = false;
            this.toggleInput.disabled = true;
            this.selectedQuizSource = 'SYSTEM';
            this.updateSourceLabel();
            // Cho phép chơi với đề hệ thống ngay cả khi không fetch được trạng thái
            this.updatePlayButtonState();
            this.showErrors([{ questionIndex: -1, reason: err.message || 'Không tải được trạng thái (có thể thiếu đăng nhập)' }]);
        }
    }

    updateStatusBadge() {
        if (!this.statusBadge) return;
        const { isValid, hasQuiz, userQuizStatus } = this.status || {};
        let text = 'Chưa có đề';
        let cls = 'muted';
        if (hasQuiz && isValid) {
            text = 'Đề hợp lệ';
            cls = 'success';
        } else if (hasQuiz && !isValid) {
            text = 'Đề không hợp lệ';
            cls = 'danger';
        }
        this.setStatusText(text, cls);
        this.root.querySelector('[data-role=category-label]').textContent =
            CATEGORY_LABELS[this.category] || this.category;
        this.root.querySelectorAll('[data-action=category]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.value === this.category);
        });
    }

    setStatusText(text, tone = 'muted') {
        if (!this.statusBadge) return;
        this.statusBadge.textContent = text;
        this.statusBadge.className = `status-pill ${tone}`;
    }

    handleToggle() {
        if (this.toggleInput.checked) {
            if (!this.status?.isValid) {
                this.toggleInput.checked = false;
                this.showErrors([
                    { questionIndex: -1, reason: 'Bạn chưa có đề cho category này. Vui lòng thêm đề trước.' },
                ]);
                return;
            }
            this.selectedQuizSource = 'USER';
            this.showErrors([]);
        } else {
            this.selectedQuizSource = 'SYSTEM';
        }
        this.updateSourceLabel();
        this.updatePlayButtonState();
    }

    async handleParse() {
        const text = this.normalizeText(this.textarea.value);
        if (!text) {
            this.showErrors([{ questionIndex: -1, reason: 'Nội dung trống' }]);
            return;
        }
        try {
            const res = await userQuizApi.parseText(this.category, text);
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            if (res.notice) {
                this.showErrors([{ questionIndex: -1, reason: res.notice }], 'success');
            }
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'Parse thành công. Bạn hãy lưu đề.' }], 'success');
            } else {
                this.showErrors(this.previewErrors);
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
        }
    }

    async handleDocx(file) {
        if (!file) return;
        try {
            const res = await userQuizApi.uploadDocx(this.category, file);
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'Đã đọc file. Bấm Lưu đề.' }], 'success');
            } else {
                this.showErrors(this.previewErrors);
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
        } finally {
            this.docInput.value = '';
            this.updatePlayButtonState();
        }
    }

    async handleSave() {
        if (!this.previewQuestions.length || this.previewErrors.length) {
            this.showErrors([{ questionIndex: -1, reason: 'Cần parse hợp lệ trước khi lưu' }]);
            return;
        }
        try {
            const res = await userQuizApi.saveQuiz(this.category, this.previewQuestions);
            this.status = await userQuizApi.getStatus(this.category);
            this.updateStatusBadge();
            this.toggleInput.disabled = !this.status.isValid;
            if (res.isValid) {
                this.toggleInput.checked = true;
                this.selectedQuizSource = 'USER';
                await userQuizApi.setQuizSource(this.category, 'USER');
                this.showErrors([{ questionIndex: -1, reason: 'Đã lưu & bật đề của bạn' }], 'success');
            } else {
                this.toggleInput.checked = false;
                this.selectedQuizSource = 'SYSTEM';
                this.showErrors(res.errors || []);
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
        } finally {
            this.updateSourceLabel();
            this.updatePlayButtonState();
        }
    }

    async handleStart() {
        if (this.playButton.disabled) return;
        if (this.selectedQuizSource === 'USER' && !this.status?.isValid) {
            this.showErrors([{ questionIndex: -1, reason: 'Không thể chơi với đề cá nhân chưa hợp lệ' }]);
            return;
        }

        try {
            await userQuizApi.setQuizSource(this.category, this.selectedQuizSource);
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
            return;
        }

        if (typeof this.onStart === 'function') {
            this.onStart({
                category: this.category,
                quizSource: this.selectedQuizSource,
            });
        }
        this.close();
    }

    renderPreview() {
        if (!this.previewBox) return;
        this.previewBox.innerHTML = '';
        if (!this.previewQuestions.length) {
            this.previewBox.innerHTML = '<div class="muted-text">Chưa có preview</div>';
            return;
        }
        const list = document.createElement('div');
        list.className = 'quiz-preview-list';
        this.previewQuestions.forEach((q, idx) => {
            while (q.answers.length < 4) q.answers.push({ text: '', isCorrect: false });
            if (q.answers.length > 4) q.answers = q.answers.slice(0, 4);

            const item = document.createElement('div');
            item.className = 'quiz-preview-item';

            const title = document.createElement('div');
            title.className = 'q-title';
            title.textContent = `Câu ${idx + 1}`;
            item.appendChild(title);

            const qInput = document.createElement('textarea');
            qInput.value = q.question || '';
            qInput.rows = 2;
            qInput.className = 'q-edit';
            qInput.addEventListener('input', () => {
                this.previewQuestions[idx].question = qInput.value;
            });
            item.appendChild(qInput);

            const answersWrap = document.createElement('div');
            answersWrap.className = 'answers-grid';
            q.answers.forEach((ans, aIdx) => {
                const row = document.createElement('label');
                row.className = 'answer-row';
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = `q-${idx}-correct`;
                radio.checked = !!ans.isCorrect;
                radio.addEventListener('change', () => {
                    this.previewQuestions[idx].answers.forEach((a, i) => (a.isCorrect = i === aIdx));
                    answersWrap.querySelectorAll('.answer-row').forEach((rowEl) => {
                        const b = rowEl.querySelector('.badge');
                        const r = rowEl.querySelector('input[type=radio]');
                        b.className = r.checked ? 'badge success' : 'badge muted';
                        b.textContent = r.checked ? 'Đúng' : 'Sai';
                    });
                });

                const input = document.createElement('input');
                input.type = 'text';
                input.value = ans.text || '';
                input.placeholder = `Đáp án ${aIdx + 1}`;
                input.addEventListener('input', () => {
                    this.previewQuestions[idx].answers[aIdx].text = input.value;
                });

                const badge = document.createElement('span');
                badge.className = radio.checked ? 'badge success' : 'badge muted';
                badge.textContent = radio.checked ? 'Đúng' : 'Sai';

                row.appendChild(radio);
                row.appendChild(badge);
                row.appendChild(input);
                answersWrap.appendChild(row);
            });
            item.appendChild(answersWrap);

            list.appendChild(item);
        });
        this.previewBox.appendChild(list);
        this.updatePlayButtonState();
    }

    showErrors(errors = [], tone = 'danger') {
        if (!this.errorBox) return;
        if (!errors || errors.length === 0) {
            this.errorBox.innerHTML = '';
            return;
        }
        this.errorBox.innerHTML = errors
            .map((e) => {
                const prefix = e.questionIndex >= 0 ? `Câu ${e.questionIndex + 1}: ` : '';
                return `<div class="error-line ${tone}">${prefix}${e.reason}</div>`;
            })
            .join('');
    }

    updateSourceLabel() {
        if (this.sourceLabel) {
            this.sourceLabel.textContent = this.selectedQuizSource;
        }
    }

    updatePlayButtonState() {
        const allow =
            this.selectedQuizSource === 'SYSTEM' ||
            (this.selectedQuizSource === 'USER' && this.status && this.status.isValid);
        this.playButton.disabled = !allow;
    }

    normalizeText(raw) {
        if (!raw) return '';
        let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        text = text.replace(/\n{3,}/g, '\n\n');
        const lines = text
            .split('\n')
            .map((l) => l.trim())
            .map((l) => l.replace(/^\d+\s*[\).\-\:]\s*/, ''))
            .map((l) => l.replace(/^[A-Da-d]\s*[\).\-\:]\s*/, ''))
            .map((l) => l.replace(/^[-•]\s*/, ''))
            .map((l) => l.replace(/\s*=>\s*/g, ' [x] '));
        return lines.join('\n').trim();
    }

    renderSkeleton() {
        return `
        <div class="quiz-overlay__backdrop"></div>
        <div class="quiz-overlay__panel">
            <div class="quiz-overlay__header">
                <div>
                    <div class="eyebrow">Quiz Mode</div>
                    <h2>Chọn category & đề</h2>
                    <div data-role="status" class="status-pill muted">--</div>
                </div>
                <button class="ghost-btn" data-action="close">✕</button>
            </div>
            <div class="quiz-overlay__section">
                <div class="chip-row">
                    <button class="chip" data-action="category" data-value="math">Math</button>
                    <button class="chip" data-action="category" data-value="english">English</button>
                </div>
                <div class="toggle-row">
                    <label class="toggle">
                        <input type="checkbox" id="use-my-quiz" />
                        <span class="toggle__slider"></span>
                        <span>Đề của bạn – <span data-role="category-label">Math</span></span>
                    </label>
                </div>
            </div>
            <div class="quiz-overlay__section grid">
                <div>
                    <div class="field">
                        <label>Nội dung đề (paste)</label>
                        <textarea id="quiz-raw-text" rows="8" placeholder="Q: 8 + 5 = ?&#10;A) 12&#10;B) *13&#10;C) 10&#10;D) 15&#10;&#10;Q: Synonym of happy?&#10;1) *joyful&#10;2) sad&#10;3) tired&#10;4) angry"></textarea>
                    </div>
                    <div class="actions-inline">
                        <button class="primary" data-action="parse">Parse & Preview</button>
                        <label class="secondary file-label">
                            Tải DOCX
                            <input type="file" id="quiz-docx" accept=".docx" hidden />
                        </label>
                        <button class="ghost" data-action="save">Lưu đề</button>
                    </div>
                    <div data-role="errors" class="error-box"></div>
                </div>
                <div>
                    <div class="section-title">Preview</div>
                    <div data-role="preview" class="preview-box"></div>
                </div>
            </div>
            <div class="quiz-overlay__footer">
                <div class="hint">Nguồn đề hiện tại: <strong data-role="source-label">${this.selectedQuizSource}</strong>. Category ưu tiên cao hơn nguồn đề.</div>
                <div class="footer-actions">
                    <button class="ghost" data-action="close">Huỷ</button>
                    <button class="primary" data-action="start">Play</button>
                </div>
            </div>
        </div>
        `;
    }
}
