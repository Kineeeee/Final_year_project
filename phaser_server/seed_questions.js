const mongoose = require('mongoose');
const Question = require('./src/models/Question');
const connectDB = require('./src/config/db');
require('dotenv').config();

// Connect to DB
connectDB();

/**
 * Level 1: 8–9 tuổi
 * - Cộng / trừ đơn giản
 * - Nhân chia nhỏ
 */
const mathQuestions = [
    // LEVEL 1 (10 câu)
    {
        topic: 'math',
        difficulty: 1,
        questionText: '5 + 3 = ?',
        correctAnswer: '8',
        wrongAnswers: ['7', '9', '15'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '10 - 4 = ?',
        correctAnswer: '6',
        wrongAnswers: ['5', '8', '14'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '2 x 3 = ?',
        correctAnswer: '6',
        wrongAnswers: ['5', '8', '12'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '7 + 6 = ?',
        correctAnswer: '13',
        wrongAnswers: ['12', '14', '16'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '9 - 5 = ?',
        correctAnswer: '4',
        wrongAnswers: ['3', '6', '5'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '4 x 2 = ?',
        correctAnswer: '8',
        wrongAnswers: ['6', '10', '12'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '12 / 3 = ?',
        correctAnswer: '4',
        wrongAnswers: ['3', '5', '6'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '6 + 9 = ?',
        correctAnswer: '15',
        wrongAnswers: ['14', '16', '18'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '11 - 2 = ?',
        correctAnswer: '9',
        wrongAnswers: ['8', '10', '12'],
    },
    {
        topic: 'math',
        difficulty: 1,
        questionText: '3 x 5 = ?',
        correctAnswer: '15',
        wrongAnswers: ['10', '12', '20'],
    },

    // LEVEL 2 (10–11 tuổi)
    {
        topic: 'math',
        difficulty: 2,
        questionText: '12 / 4 = ?',
        correctAnswer: '3',
        wrongAnswers: ['2', '4', '6'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '15 + 15 = ?',
        correctAnswer: '30',
        wrongAnswers: ['25', '35', '40'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '18 - 7 = ?',
        correctAnswer: '11',
        wrongAnswers: ['10', '12', '9'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '6 x 7 = ?',
        correctAnswer: '42',
        wrongAnswers: ['36', '48', '40'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '45 / 5 = ?',
        correctAnswer: '9',
        wrongAnswers: ['8', '10', '7'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '14 + 9 = ?',
        correctAnswer: '23',
        wrongAnswers: ['21', '24', '22'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '8 x 6 = ?',
        correctAnswer: '48',
        wrongAnswers: ['42', '54', '56'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '30 - 13 = ?',
        correctAnswer: '17',
        wrongAnswers: ['16', '18', '15'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '64 / 8 = ?',
        correctAnswer: '8',
        wrongAnswers: ['6', '7', '9'],
    },
    {
        topic: 'math',
        difficulty: 2,
        questionText: '9 x 9 = ?',
        correctAnswer: '81',
        wrongAnswers: ['72', '90', '99'],
    },

    // LEVEL 3 (12–13 tuổi)
    {
        topic: 'math',
        difficulty: 3,
        questionText: 'Square root of 81?',
        correctAnswer: '9',
        wrongAnswers: ['8', '7', '18'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: 'Square root of 64?',
        correctAnswer: '8',
        wrongAnswers: ['6', '7', '16'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '5 x 12 = ?',
        correctAnswer: '60',
        wrongAnswers: ['50', '55', '70'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '6 x 15 = ?',
        correctAnswer: '90',
        wrongAnswers: ['75', '85', '100'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '120 / 10 = ?',
        correctAnswer: '12',
        wrongAnswers: ['10', '14', '20'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '25 + 37 = ?',
        correctAnswer: '62',
        wrongAnswers: ['60', '61', '65'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '100 - 48 = ?',
        correctAnswer: '52',
        wrongAnswers: ['50', '54', '58'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '9 x 12 = ?',
        correctAnswer: '108',
        wrongAnswers: ['96', '100', '120'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: '144 / 12 = ?',
        correctAnswer: '12',
        wrongAnswers: ['10', '14', '16'],
    },
    {
        topic: 'math',
        difficulty: 3,
        questionText: 'Square root of 49?',
        correctAnswer: '7',
        wrongAnswers: ['6', '8', '14'],
    },
];

const englishQuestions = [
    // LEVEL 1 (8–9 tuổi)
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Opposite of "Hot"?',
        correctAnswer: 'Cold',
        wrongAnswers: ['Warm', 'Wet', 'Ice'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Opposite of "Big"?',
        correctAnswer: 'Small',
        wrongAnswers: ['Tall', 'Wide', 'Heavy'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'What is a "Dog"?',
        correctAnswer: 'Animal',
        wrongAnswers: ['Plant', 'Mineral', 'Car'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'What color is the sky?',
        correctAnswer: 'Blue',
        wrongAnswers: ['Green', 'Red', 'Yellow'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Which one is a fruit?',
        correctAnswer: 'Apple',
        wrongAnswers: ['Chair', 'Car', 'Dog'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Opposite of "Fast"?',
        correctAnswer: 'Slow',
        wrongAnswers: ['Quick', 'Strong', 'Early'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Which one is an animal?',
        correctAnswer: 'Cat',
        wrongAnswers: ['Table', 'Book', 'Pen'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'What do you drink?',
        correctAnswer: 'Water',
        wrongAnswers: ['Stone', 'Paper', 'Chair'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Opposite of "Up"?',
        correctAnswer: 'Down',
        wrongAnswers: ['Left', 'Right', 'Near'],
    },
    {
        topic: 'english',
        difficulty: 1,
        questionText: 'Which one is a color?',
        correctAnswer: 'Red',
        wrongAnswers: ['Dog', 'Milk', 'Run'],
    },

    // LEVEL 2 (10–11 tuổi)
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Past tense of "Run"?',
        correctAnswer: 'Ran',
        wrongAnswers: ['Runned', 'Running', 'Runs'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Past tense of "Eat"?',
        correctAnswer: 'Ate',
        wrongAnswers: ['Eated', 'Eating', 'Eats'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Plural of "Child"?',
        correctAnswer: 'Children',
        wrongAnswers: ['Childs', 'Childes', 'Kids'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Plural of "Mouse"?',
        correctAnswer: 'Mice',
        wrongAnswers: ['Mouses', 'Mouse', 'Rats'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Opposite of "Early"?',
        correctAnswer: 'Late',
        wrongAnswers: ['Slow', 'Fast', 'Soon'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Which is a verb?',
        correctAnswer: 'Run',
        wrongAnswers: ['Blue', 'Chair', 'Happy'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Which word means "big"?',
        correctAnswer: 'Large',
        wrongAnswers: ['Tiny', 'Short', 'Low'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Past tense of "Go"?',
        correctAnswer: 'Went',
        wrongAnswers: ['Goed', 'Going', 'Goes'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Plural of "Foot"?',
        correctAnswer: 'Feet',
        wrongAnswers: ['Foots', 'Feets', 'Legs'],
    },
    {
        topic: 'english',
        difficulty: 2,
        questionText: 'Opposite of "Clean"?',
        correctAnswer: 'Dirty',
        wrongAnswers: ['Dry', 'Wet', 'Soft'],
    },

    // LEVEL 3 (12–13 tuổi)
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Synonym for "Happy"?',
        correctAnswer: 'Joyful',
        wrongAnswers: ['Sad', 'Angry', 'Tired'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Synonym for "Fast"?',
        correctAnswer: 'Quick',
        wrongAnswers: ['Slow', 'Late', 'Weak'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Opposite of "Dangerous"?',
        correctAnswer: 'Safe',
        wrongAnswers: ['Risky', 'Hard', 'Strong'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Which word means "begin"?',
        correctAnswer: 'Start',
        wrongAnswers: ['End', 'Stop', 'Close'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Synonym for "Angry"?',
        correctAnswer: 'Mad',
        wrongAnswers: ['Happy', 'Calm', 'Proud'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Opposite of "Noisy"?',
        correctAnswer: 'Quiet',
        wrongAnswers: ['Loud', 'Busy', 'Fast'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Which word means "very big"?',
        correctAnswer: 'Huge',
        wrongAnswers: ['Tiny', 'Short', 'Light'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Synonym for "Smart"?',
        correctAnswer: 'Clever',
        wrongAnswers: ['Lazy', 'Slow', 'Weak'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Opposite of "Win"?',
        correctAnswer: 'Lose',
        wrongAnswers: ['Play', 'Try', 'Fight'],
    },
    {
        topic: 'english',
        difficulty: 3,
        questionText: 'Which word means "easy"?',
        correctAnswer: 'Simple',
        wrongAnswers: ['Hard', 'Heavy', 'Dark'],
    },
];

const seedQuestions = async () => {
    try {
        await Question.deleteMany({});
        console.log('Cleared existing questions...');

        await Question.insertMany(mathQuestions);
        console.log('Added Math questions');

        await Question.insertMany(englishQuestions);
        console.log('Added English questions');

        console.log('Seeding Complete!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedQuestions();
