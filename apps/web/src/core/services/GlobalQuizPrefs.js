const KEY = 'globalQuizSource';

class GlobalQuizPrefs {
    constructor() {
        this.quizSource = this._load();
    }

    _load() {
        const saved = localStorage.getItem(KEY);
        return saved === 'USER' ? 'USER' : 'SYSTEM';
    }

    getQuizSource() {
        return this.quizSource;
    }

    setQuizSource(src) {
        this.quizSource = src === 'USER' ? 'USER' : 'SYSTEM';
        localStorage.setItem(KEY, this.quizSource);
    }
}

export const globalQuizPrefs = new GlobalQuizPrefs();
