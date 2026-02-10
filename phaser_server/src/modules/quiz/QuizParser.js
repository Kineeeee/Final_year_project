const { validateQuiz, CATEGORY_ENUM } = require('./QuizValidator');

const QUIZ_PARSE_PROMPT = `You are a strict quiz parser.
Input category: {{CATEGORY}} (one of: MATH, ENGLISH).
Input text: """{{RAW_TEXT}}"""

Rules:
- Each question: exactly 1 question string and 4 answers.
- Exactly 1 answer has isCorrect=true; 3 are false.
- No empty text; all questions must belong to category {{CATEGORY}}.
Output:
- If all valid: JSON array of questions using:
  [{"question":"...","answers":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false},{"text":"...","isCorrect":false}]}]
- If any issue: return JSON object {"errors":[{"questionIndex":n,"reason":"..."}]} and no questions.
Do not include explanations outside JSON.`;

const MARKERS = ['[x]', '(x)', '(correct)', '[correct]', '✔', '*'];

function normalizeText(raw) {
    if (!raw) return '';
    return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function splitBlocks(text) {
    // Split by blank lines, but also allow numbered prefixes
    const blocks = [];
    const lines = text.split('\n');
    let buffer = [];

    const flush = () => {
        if (buffer.length) {
            blocks.push(buffer.join('\n').trim());
            buffer = [];
        }
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            flush();
            return;
        }

        const isQuestionHeader = /^\d+[\).\s-]/.test(trimmed);
        if (isQuestionHeader && buffer.length) {
            flush();
        }
        buffer.push(trimmed);
    });
    flush();

    return blocks.filter(Boolean);
}

function parseAnswers(lines) {
    const answers = [];
    lines.forEach((raw) => {
        let text = raw.trim();
        let isCorrect = false;

        // Remove bullet prefixes (A. , 1) , - , * etc.)
        text = text.replace(/^[A-Da-d]\s*[\).\-\:]\s*/, '');
        text = text.replace(/^\d+\s*[\).\-\:]\s*/, '');
        text = text.replace(/^[-•]\s*/, '');

        // Detect correctness markers
        MARKERS.forEach((m) => {
            if (text.toLowerCase().includes(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase())) {
                isCorrect = true;
                text = text.replace(new RegExp(m, 'ig'), '');
            }
        });
        if (/\(đúng\)|\[đúng\]/i.test(text)) {
            isCorrect = true;
            text = text.replace(/\(đúng\)|\[đúng\]/gi, '');
        }

        answers.push({ text: text.trim(), isCorrect });
    });

    return answers;
}

function parseBlock(block) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 5) {
        return { error: 'Thiếu đáp án, cần 1 câu hỏi và 4 đáp án' };
    }

    const questionLine = lines[0].replace(/^\d+[\).\-\:]\s*/, '');
    const answers = parseAnswers(lines.slice(1));

    return { question: questionLine.trim(), answers };
}

function parseTextToQuiz(rawText, category) {
    const normalizedCategory = (category || '').toLowerCase();
    if (!CATEGORY_ENUM.includes(normalizedCategory)) {
        return { questions: [], errors: [{ questionIndex: -1, reason: 'Category không hợp lệ' }] };
    }

    const text = normalizeText(rawText);
    if (!text) {
        return { questions: [], errors: [{ questionIndex: -1, reason: 'Nội dung trống' }] };
    }

    const blocks = splitBlocks(text);
    if (blocks.length === 0) {
        return { questions: [], errors: [{ questionIndex: -1, reason: 'Không tìm thấy câu hỏi' }] };
    }

    const questions = [];
    const parseErrors = [];

    blocks.forEach((block, idx) => {
        const parsed = parseBlock(block);
        if (parsed.error) {
            parseErrors.push({ questionIndex: idx, reason: parsed.error });
            return;
        }
        questions.push(parsed);
    });

    // Run validation to surface structural errors (like answer counts / multiple correct)
    const validation = validateQuiz({ questions, category: normalizedCategory });
    if (!validation.isValid) {
        parseErrors.push(...validation.errors);
    }

    if (parseErrors.length) {
        return { questions: [], errors: dedupeErrors(parseErrors) };
    }

    return { questions, errors: [] };
}

function dedupeErrors(errors) {
    const seen = new Set();
    return errors.filter((err) => {
        const key = `${err.questionIndex}-${err.reason}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

module.exports = {
    parseTextToQuiz,
    QUIZ_PARSE_PROMPT,
};
