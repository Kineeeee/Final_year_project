const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    topic: {
        type: String,
        enum: ['math', 'english'],
        required: true,
    },
    difficulty: {
        type: Number,
        min: 1, // 8-9 yo
        max: 3, // 12-13 yo
        default: 1,
    },
    questionText: {
        type: String,
        required: true,
    },
    correctAnswer: {
        type: String,
        required: true,
    },
    wrongAnswers: {
        type: [String],
        validate: [arrayLimit, '{PATH} must have at least 1 wrong answer'],
    },
}, { timestamps: true });

function arrayLimit(val) {
    return val.length > 0;
}

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
