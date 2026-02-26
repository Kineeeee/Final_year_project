import { userQuizApi } from '../../core/services/UserQuizApi';
import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { Logger } from '../../utils/Logger';
import { globalQuizPrefs } from '../../core/services/GlobalQuizPrefs';

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
        this.selectedQuizSource = globalQuizPrefs.getQuizSource() || 'SYSTEM';
        this.status = null;
        this.previewQuestions = [];
        this.previewErrors = [];
        this._escHandler = null;

        this.root = null;
        this.textarea = null;
        this.statusBadge = null;
        this.toggleInput = null;
        this.errorBox = null;
        this.previewBox = null;
        this.progressBox = null;
        this.warningBox = null;
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
        this.progressBox = this.root.querySelector('[data-role=parse-status]');
        this.warningBox = this.root.querySelector('[data-role=warn]');
        this.playButton = this.root.querySelector('[data-action=start]');
        this.saveButton = this.root.querySelector('[data-action=save]');
        this.docInput = this.root.querySelector('#quiz-docx');
        this.sourceLabel = this.root.querySelector('[data-role=source-label]');
        this.playButton.disabled = true;
        if (this.disablePlay && this.playButton) this.playButton.style.display = 'none';

        this.bindEvents();
        this.bindEscapeToClose();
        this.loadStatus();
    }

    close() {
        if (this.root) {
            this.root.remove();
            this.root = null;
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
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
        // allow click outside panel to close
        const backdrop = this.root.querySelector('.quiz-overlay__backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.close());
        }
        this.docInput.addEventListener('change', (e) => this.handleDocx(e.target.files[0]));
    }

    bindEscapeToClose() {
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);
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
            // Default selection comes from stored preference
            this.toggleInput.checked = this.selectedQuizSource === 'USER' && !!this.status.isValid;
            this.toggleInput.disabled = !this.status.isValid;
            this.updateSourceLabel();
            await this.loadExistingQuizIfAny();
            await this.applySourceSelection(); // sync server + prefs
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

    async loadExistingQuizIfAny() {
        if (!this.status || !this.status.hasQuiz) return;
        try {
            const questions = await userQuizApi.getQuiz(this.category);
            if (Array.isArray(questions) && questions.length) {
                this.previewQuestions = questions;
                this.previewErrors = this.status.errors || [];
                this.renderPreview();
                this.showErrors([{ questionIndex: -1, reason: 'Đang hiển thị đề đã lưu. Lưu mới sẽ thay thế đề cũ.' }], 'success');
            }
        } catch (err) {
            Logger.warn('QuizOverlay', 'Load existing quiz failed', err);
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
        this.applySourceSelection();
        this.updatePlayButtonState();
    }

    async handleParse() {
        const text = this.normalizeText(this.textarea.value);
        if (!text) {
            this.showErrors([{ questionIndex: -1, reason: 'Nội dung trống' }]);
            return;
        }
        this.setLoading(true);
        this.setProgress(['1) Gửi AI chuẩn hoá (LM Studio)...'], 'muted');
        try {
            const res = await userQuizApi.parseText(this.category, text);
            this.setProgress(['2) AI trả về, đang kiểm tra cấu trúc...'], 'muted');
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            if (res.notice) {
                this.showErrors([{ questionIndex: -1, reason: res.notice }], 'success');
            }
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'Parse thành công. Bạn hãy lưu đề.' }], 'success');
                this.setProgress([
                    '1) Gửi AI chuẩn hoá: ✔',
                    '2) Kiểm tra cấu trúc: ✔',
                    '3) Hiển thị preview: ✔'
                ], 'success');
            } else {
                this.showErrors(this.previewErrors);
                this.setProgress(['Quá trình dừng do lỗi kiểm tra cấu trúc.'], 'danger');
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
            this.setProgress(['Lỗi AI/Server: ' + (err.message || 'Không xác định')], 'danger');
        }
        this.setLoading(false);
    }

    async handleDocx(file) {
        if (!file) return;
        this.setLoading(true);
        this.setProgress(['1) Đọc file DOCX...', '2) Gửi AI chuẩn hoá (LM Studio)...'], 'muted');
        try {
            const res = await userQuizApi.uploadDocx(this.category, file);
            this.setProgress(['3) AI trả về, đang kiểm tra cấu trúc...'], 'muted');
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'Đã đọc file. Bấm Lưu đề.' }], 'success');
                this.setProgress([
                    '1) Đọc file DOCX: ✔',
                    '2) Gửi AI chuẩn hoá: ✔',
                    '3) Kiểm tra cấu trúc & hiển thị preview: ✔'
                ], 'success');
            } else {
                this.showErrors(this.previewErrors);
                this.setProgress(['Quá trình dừng do lỗi kiểm tra cấu trúc.'], 'danger');
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
            this.setProgress(['Lỗi AI/Server: ' + (err.message || 'Không xác định')], 'danger');
        } finally {
            this.docInput.value = '';
            this.updatePlayButtonState();
            this.setLoading(false);
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
                globalQuizPrefs.setQuizSource('USER'); // ensure MainMenu uses your quiz on next start
                this.showErrors(
                    [{ questionIndex: -1, reason: 'Đã lưu & bật đề của bạn (đề cũ đã được thay thế)' }],
                    'success'
                );
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

            const sanitizedQuestion = this.cleanQuestionText(q.question || '');
            this.previewQuestions[idx].question = sanitizedQuestion;

            const qInput = document.createElement('textarea');
            qInput.value = sanitizedQuestion;
            qInput.rows = 2;
            qInput.className = 'q-edit';
            qInput.addEventListener('input', () => {
                this.previewQuestions[idx].question = this.cleanQuestionText(qInput.value);
            });
            item.appendChild(qInput);

            const answersWrap = document.createElement('div');
            answersWrap.className = 'answers-grid';
            q.answers.forEach((ans, aIdx) => {
                const sanitizedText = this.cleanAnswerText(ans.text || '');
                this.previewQuestions[idx].answers[aIdx].text = sanitizedText;

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
                input.value = sanitizedText;
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

    setLoading(isLoading) {
        this.loading = isLoading;
        const parseBtn = this.root?.querySelector('[data-action=parse]');
        if (parseBtn) parseBtn.disabled = isLoading;
        if (this.saveButton) this.saveButton.disabled = isLoading;
        if (this.playButton) this.playButton.disabled = isLoading;
        if (this.docInput) this.docInput.disabled = isLoading;

        if (this.warningBox) {
            this.warningBox.innerHTML = `
                <div class="warning-box">
                    AI có thể trả lời sai. Vui lòng kiểm tra lại câu hỏi/đáp án trước khi bấm Lưu.
                    ${isLoading ? '<div class="loading-pill"><span class="loading-dot"></span> Đang xử lý...</div>' : ''}
                </div>
            `;
        }
    }

    setProgress(lines = [], tone = 'muted') {
        if (!this.progressBox) return;
        if (!lines || lines.length === 0) {
            this.progressBox.innerHTML = '';
            return;
        }
        const cls = tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'muted';
        this.progressBox.className = `status-box ${cls}`;
        this.progressBox.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
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

    async applySourceSelection() {
        const source = this.selectedQuizSource;
        // Persist preference locally
        globalQuizPrefs.setQuizSource(source);

        // Notify server only when toggle is usable
        if (source === 'USER') {
            if (this.status?.isValid) {
                try {
                    await userQuizApi.setQuizSource(this.category, 'USER');
                } catch (e) {
                    Logger.warn('QuizOverlay', 'Failed to set USER source', e);
                    this.showErrors([{ questionIndex: -1, reason: e.message || 'Không chuyển được sang đề của bạn' }]);
                }
            }
        } else {
            try {
                await userQuizApi.setQuizSource(this.category, 'SYSTEM');
            } catch (e) {
                Logger.warn('QuizOverlay', 'Failed to set SYSTEM source', e);
            }
        }
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

    cleanAnswerText(text = '') {
        return (text || '').replace(/\s*\[(đúng|sai)\]\s*/gi, '')
            .replace(/\s*\((đúng|sai|correct)\)\s*/gi, '')
            .replace(/\s*\[correct\]\s*/gi, '')
            .replace(/\s*\[x\]\s*/gi, '')
            .replace(/[*✔]/g, '')
            .trim();
    }

    cleanQuestionText(text = '') {
        if (!text) return '';
        // Nếu câu hỏi có lẫn đáp án dạng " | A. ... | B. ..." chỉ giữ phần trước dấu |
        const parts = text.split('|').map((p) => p.trim());
        if (parts.length > 1) {
            return parts[0].replace(/\s+\?*$/, '?').trim();
        }
        // Loại bỏ nhãn [ĐÚNG], dấu * hay bullet ở đầu.
        return text
            .replace(/\[đúng\]/gi, '')
            .replace(/^[*\-•\d]+\s*/g, '')
            .trim();
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
            <div class="quiz-overlay__body">
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
                            <textarea id="quiz-raw-text" rows="8" placeholder=""></textarea>
                        </div>
                        <div class="actions-inline">
                            <button class="primary" data-action="parse">Parse & Preview</button>
                            <label class="secondary file-label">
                                Tải DOCX
                                <input type="file" id="quiz-docx" accept=".docx" hidden />
                            </label>
                            <button class="ghost" data-action="save">Lưu đề</button>
                        </div>
                        <div class="upload-hint">
                            <strong>Hướng dẫn nhanh:</strong>
                            <ul>
                                <li>Chọn category phù hợp.</li>
                                <li>Bật <em>Đề của bạn</em> nếu muốn dùng đề cá nhân đã lưu.</li>
                                <li>Định dạng câu hỏi: câu hỏi ? | đáp án 1 [ĐÚNG]| đáp án 2 | đáp án 3. đây là định dạng câu hỏi trắc nghiệm </li>
                                <li>Bạn có thể nhờ AI chuẩn bị đề dựa theo định dạng trên.</li>
                                <li>Hoặc chỉ cần dán nội dung hoặc chọn file DOCX có đánh dấu [ĐÚNG] nếu có.</li>
                                <li>Nhấn <em>Parse & Preview</em> để hệ thống chuẩn hoá.</li>
                                <li>Kiểm tra & chọn đáp án đúng trong preview trước khi <em>Lưu đề</em>.</li>
                            </ul>
                        </div>
                        <div data-role="warn"></div>
                        <div data-role="parse-status" class="status-box muted-text"></div>
                        <div data-role="errors" class="error-box"></div>
                    </div>
                    <div>
                        <div class="section-title">Preview</div>
                        <div data-role="preview" class="preview-box"></div>
                    </div>
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
