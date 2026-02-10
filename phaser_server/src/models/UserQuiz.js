const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
    {
        text: { type: String, required: true, trim: true },
        isCorrect: { type: Boolean, required: true },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        question: { type: String, required: true, trim: true },
        answers: {
            type: [answerSchema],
            validate: [
                (arr) => Array.isArray(arr) && arr.length === 4,
                'Each question must have exactly 4 answers',
            ],
        },
    },
    { _id: false }
);

const userQuizSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        category: { type: String, enum: ['math', 'english'], required: true },
        questions: { type: [questionSchema], default: [] },
        isValid: { type: Boolean, default: false },
        parseErrors: {
            type: [
                {
                    questionIndex: Number,
                    reason: String,
                },
            ],
            default: [],
        },
    },
    { timestamps: true }
);

userQuizSchema.index({ userId: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('UserQuiz', userQuizSchema);
