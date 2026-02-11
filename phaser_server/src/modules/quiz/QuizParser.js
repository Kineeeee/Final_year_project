const { validateQuiz, CATEGORY_ENUM } = require('./QuizValidator');

const QUIZ_PARSE_PROMPT = `You are a strict quiz parser.
Input category: {{CATEGORY}} (one of: MATH, ENGLISH).
Input text: """{{RAW_TEXT}}"""

Rules:
- Extract each question with at least 2 answers (more is fine).
- Detect explicit correctness markers ([ĐÚNG], (correct), [x], *, ✔). If present, set isCorrect=true for that answer.
- If multiple answers are marked, keep the first marked answer as isCorrect=true, set others to false.
- If no answer is marked, set all isCorrect=false (user will choose later).
- Remove markers like [ĐÚNG], [SAI], (correct), *, ✔ from the answer text.
- No empty text; all questions must belong to category {{CATEGORY}}.

Output (JSON only):
[
  {
    "question": "...",
    "answers": [
      {"text": "...", "isCorrect": false},
      {"text": "...", "isCorrect": false},
      {"text": "...", "isCorrect": false}
    ]
  }
]

If any issue: return {"errors":[{"questionIndex":n,"reason":"..."}]} and no questions.
Do not include any extra text outside JSON.`;

const MARKERS = ['[x]', '(x)', '(correct)', '[correct]', '✔', '*'];

function normalizeText(raw) {
    if (!raw) return '';
    // Normalize line endings and ensure '---' always acts as a separator
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/-{3,}/g, '\n---\n')
        .trim();
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
        // Treat blank lines or separator lines (---) as block breaks
        const isSeparatorLine = /^-{3,}$/.test(trimmed);
        if (!trimmed || isSeparatorLine) {
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
    let lines = block.split('\n').map((l) => l.trim()).filter(Boolean);

    // Support inline format: "Question | A.... | B.... | C.... | D...."
    if (lines.length < 3 && lines.some((l) => l.includes('|'))) {
        const tokens = lines
            .join(' ')
            .split('|')
            .map((t) => t.trim())
            .filter(Boolean);
        if (tokens.length >= 3) {
            const questionLine = tokens.shift();
            lines = [questionLine, ...tokens];
        }
    }

    if (lines.length < 3) {
        return { error: 'Thiếu đáp án, cần 1 câu hỏi và ít nhất 2 đáp án' };
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
    const validation = validateQuiz({ questions, category: normalizedCategory }, { allowNoCorrect: true });
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
