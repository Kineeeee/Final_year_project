const CATEGORY_ENUM = ['math', 'english'];

function validateQuestionShape(question, { allowNoCorrect = false } = {}) {
    if (!question || typeof question.question !== 'string' || !question.question.trim()) {
        return 'Câu hỏi không được để trống';
    }

    if (!Array.isArray(question.answers) || question.answers.length < 2) {
        return 'Mỗi câu hỏi cần ít nhất 2 đáp án';
    }

    let correctCount = 0;
    for (const ans of question.answers) {
        if (!ans || typeof ans.text !== 'string' || !ans.text.trim()) {
            return 'Đáp án không được để trống';
        }
        if (ans.isCorrect === true) correctCount += 1;
    }

    if (!allowNoCorrect && correctCount !== 1) {
        return 'Phải có đúng 1 đáp án đúng';
    }
    if (allowNoCorrect && correctCount > 1) {
        return 'Chỉ được tối đa 1 đáp án đúng';
    }

    return null;
}

function isCategoryContentMismatch(questionText, category) {
    const text = questionText.toLowerCase();
    if (category === 'math') {
        // Require at least one digit or math symbol
        return !/[0-9+\-*/=]/.test(text);
    }
    if (category === 'english') {
        // Heuristic: require at least one alphabetic word longer than 2 characters
        return !/[a-z]{3,}/.test(text);
    }
    return false;
}

/**
 * Validate entire quiz payload
 * @param {Object} params
 * @param {Array} params.questions
 * @param {String} params.category
 * @returns {{isValid:boolean, errors:Array}}
 */
function validateQuiz({ questions, category }, { allowNoCorrect = false } = {}) {
    const errors = [];
    const normalizedCategory = (category || '').toLowerCase();

    if (!CATEGORY_ENUM.includes(normalizedCategory)) {
        return { isValid: false, errors: [{ questionIndex: -1, reason: 'Category không hợp lệ' }] };
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        return { isValid: false, errors: [{ questionIndex: -1, reason: 'Cần ít nhất 1 câu hỏi' }] };
    }

    questions.forEach((q, index) => {
        const shapeError = validateQuestionShape(q, { allowNoCorrect });
        if (shapeError) {
            errors.push({ questionIndex: index, reason: shapeError });
            return;
        }

        // Category heuristic
        if (isCategoryContentMismatch(q.question, normalizedCategory)) {
            errors.push({ questionIndex: index, reason: 'Nội dung không khớp category đã chọn' });
        }
    });

    return { isValid: errors.length === 0, errors };
}

module.exports = {
    validateQuiz,
    validateQuestionShape,
    CATEGORY_ENUM,
};
