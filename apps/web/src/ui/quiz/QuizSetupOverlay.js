import { userQuizApi } from '../../core/services/UserQuizApi';
import { overlayBlocker } from '../../core/services/OverlayBlocker';
import { Logger } from '../../utils/Logger';
import { globalQuizPrefs } from '../../core/services/GlobalQuizPrefs';

const CATEGORY_LABELS = {
    math: 'Math',
    english: 'English',
};

export class QuizSetupOverlay {
    constructor({ defaultCategory = 'math', onStart, onClose, disablePlay = false, mountNode = null } = {}) {
        this.category = defaultCategory;
        this.onStart = onStart;
        this.onClose = onClose;
        this.disablePlay = disablePlay;
        this.mountNode = mountNode;
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
        const host = this.mountNode || document.getElementById('game-container') || document.body;
        host.appendChild(this.root);

        // Inline fail-safe styles so the overlay still appears if external CSS conflicts.
        this.root.style.setProperty('position', 'fixed', 'important');
        this.root.style.setProperty('inset', '0', 'important');
        this.root.style.setProperty('z-index', '1200', 'important');
        this.root.style.setProperty('display', 'block', 'important');
        this.root.style.setProperty('pointer-events', 'auto', 'important');

        const backdrop = this.root.querySelector('.quiz-overlay__backdrop');
        if (backdrop) {
            backdrop.style.setProperty('position', 'absolute', 'important');
            backdrop.style.setProperty('inset', '0', 'important');
            backdrop.style.setProperty('pointer-events', 'auto', 'important');
        }

        const panel = this.root.querySelector('.quiz-overlay__panel');
        if (panel) {
            panel.style.setProperty('position', 'absolute', 'important');
            panel.style.setProperty('left', '50%', 'important');
            panel.style.setProperty('top', '50%', 'important');
            panel.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
            panel.style.setProperty('display', 'flex', 'important');
            panel.style.setProperty('pointer-events', 'auto', 'important');
        }

        // Ensure overlay is interactable and sits above canvas
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
            this.setStatusText('Please login to use your questions', 'danger');
            this.toggleInput.disabled = true;
            this.playButton.disabled = false; // system still playable
            return;
        }
        this.setStatusText('Loading...', 'muted');
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
            this.setStatusText(err.message || 'Cannot load status', 'danger');
            this.toggleInput.checked = false;
            this.toggleInput.disabled = true;
            this.selectedQuizSource = 'SYSTEM';
            this.updateSourceLabel();
            // Allow playing with system questions even if status cannot be fetched
            this.updatePlayButtonState();
            this.showErrors([{ questionIndex: -1, reason: err.message || 'Cannot load status (may lack login)' }]);
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
                this.showErrors([{ questionIndex: -1, reason: 'Now showing saved questions. Saving will replace old questions.' }], 'success');
            }
        } catch (err) {
            Logger.warn('QuizOverlay', 'Load existing quiz failed', err);
        }
    }

    updateStatusBadge() {
        if (!this.statusBadge) return;
        const { isValid, hasQuiz, userQuizStatus } = this.status || {};
        let text = 'No questions';
        let cls = 'muted';
        if (hasQuiz && isValid) {
            text = 'Valid questions';
            cls = 'success';
        } else if (hasQuiz && !isValid) {
            text = 'Invalid questions';
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
                    { questionIndex: -1, reason: 'You don\'t have valid questions for this category. Please add questions first.' },
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
            this.showErrors([{ questionIndex: -1, reason: 'Empty content' }]);
            return;
        }
        this.setLoading(true);
        this.setProgress(['1) Sending to AI...'], 'muted');
        try {
            const res = await userQuizApi.parseText(this.category, text);
            this.setProgress(['2) AI response, checking structure...'], 'muted');
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            if (res.notice) {
                this.showErrors([{ questionIndex: -1, reason: res.notice }], 'success');
            }
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'Parse successfully. Please save the questions.' }], 'success');
                this.setProgress([
                    '1) Sending to AI: ✔',
                    '2) Checking structure: ✔',
                    '3) Displaying preview: ✔'
                ], 'success');
            } else {
                this.showErrors(this.previewErrors);
                this.setProgress(['Process stopped due to structure check errors.'], 'danger');
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
            this.setProgress(['AI/Server error: ' + (err.message || 'Unknown error')], 'danger');
        }
        this.setLoading(false);
    }

    async handleDocx(file) {
        if (!file) return;
        this.setLoading(true);
        this.setProgress(['1) Reading DOCX file...', '2) Sending to AI...'], 'muted');
        try {
            const res = await userQuizApi.uploadDocx(this.category, file);
            this.setProgress(['3) AI response, checking structure...'], 'muted');
            this.previewQuestions = res.questions || [];
            this.previewErrors = res.errors || [];
            this.renderPreview();
            if (this.previewErrors.length === 0 && this.previewQuestions.length > 0) {
                this.showErrors([{ questionIndex: -1, reason: 'File read successfully. Please save the questions.' }], 'success');
                this.setProgress([
                    '1) Reading DOCX: ✔',
                    '2) Sending to AI: ✔',
                    '3) Checking structure & displaying preview: ✔'
                ], 'success');
            } else {
                this.showErrors(this.previewErrors);
                this.setProgress(['Process stopped due to structure check errors.'], 'danger');
            }
        } catch (err) {
            this.showErrors([{ questionIndex: -1, reason: err.message }]);
            this.setProgress(['AI/Server error: ' + (err.message || 'Unknown error')], 'danger');
        } finally {
            this.docInput.value = '';
            this.updatePlayButtonState();
            this.setLoading(false);
        }
    }

    async handleSave() {
        if (!this.previewQuestions.length || this.previewErrors.length) {
            this.showErrors([{ questionIndex: -1, reason: 'Need to parse valid questions before saving' }]);
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
                    [{ questionIndex: -1, reason: 'Saved and enabled your quiz (old questions replaced)' }],
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
            this.showErrors([{ questionIndex: -1, reason: 'Cannot play with invalid user quiz' }]);
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
            this.previewBox.innerHTML = '<div class="muted-text">No preview yet </div>';
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
            title.textContent = `Question ${idx + 1}`;
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
                        b.textContent = r.checked ? 'Correct' : 'Wrong';
                    });
                });

                const input = document.createElement('input');
                input.type = 'text';
                input.value = sanitizedText;
                input.placeholder = `Answer ${aIdx + 1}`;
                input.addEventListener('input', () => {
                    this.previewQuestions[idx].answers[aIdx].text = input.value;
                });

                const badge = document.createElement('span');
                badge.className = radio.checked ? 'badge success' : 'badge muted';
                badge.textContent = radio.checked ? 'Correct' : 'Wrong';

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
                    AI can make mistakes. Please check the questions and answers before saving.
                    ${isLoading ? '<div class="loading-pill"><span class="loading-dot"></span> Processing...</div>' : ''}
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
                    this.showErrors([{ questionIndex: -1, reason: e.message || 'Can not switch to user quiz' }]);
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
            // Chỉ bỏ số thứ tự nếu có dấu .) - : theo sau, không bỏ số đầu bài toán (vd "45 + 27")
            .replace(/^\d+\s*[)\.\-:]\s*/, '')
            .replace(/^[*\-•]+\s*/, '')
            .trim();
    }

    renderSkeleton() {
        return `
        <div class="quiz-overlay__backdrop"></div>
        <div class="quiz-overlay__panel">
            <div class="quiz-overlay__header">
                <div>
                    <div class="eyebrow">Quiz Mode</div>
                    <h2>Choose category & quiz</h2>
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
                            <span>Custom your quiz – <span data-role="category-label">Math</span></span>
                        </label>
                    </div>
                </div>
                <div class="quiz-overlay__section grid">
                    <div>
                        <div class="field">
                            <label>Paste your quiz</label>
                            <textarea id="quiz-raw-text" rows="8" placeholder=""></textarea>
                        </div>
                        <div class="actions-inline">
                            <button class="primary" data-action="parse">Parse & Preview</button>
                            <label class="secondary file-label">
                                Upload DOCX
                                <input type="file" id="quiz-docx" accept=".docx" hidden />
                            </label>
                            <button class="ghost" data-action="save">Save quiz</button>
                        </div>
                        <div class="upload-hint">
                            <strong>Quick guide:</strong>
                            <ul>
                                <li>Choose category.</li>
                                <li>Enable <em>Custom your quiz</em> if you want to use your own quiz.</li>
                                <li>Question format: question ? | answer 1 [TRUE]| answer 2 | answer 3. This is the format for multiple-choice questions.</li>
                                <li>You can ask AI to prepare a quiz based on the format above.</li>
                                <li>Or simply paste the content or select a DOCX file with [TRUE] marked if available.</li>
                                <li>Press <em>Parse & Preview</em> to let the system standardize.</li>
                                <li>Check & select the correct answer in the preview before <em>Save quiz</em>.</li>
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
                <div class="hint">Current quiz source: <strong data-role="source-label">${this.selectedQuizSource}</strong>. Category priority is higher than the quiz source.</div>
                <div class="footer-actions">
                    <button class="ghost" data-action="close">Cancel</button>
                    <button class="primary" data-action="start">Play</button>
                </div>
            </div>
        </div>
        `;
    }
}
