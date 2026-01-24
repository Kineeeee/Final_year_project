const API_URL = '/api/questions';

document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();

    document.getElementById('filterTopic').addEventListener('change', loadQuestions);
    document.getElementById('addQuestionForm').addEventListener('submit', handleAddQuestion);
});

async function loadQuestions() {
    const topic = document.getElementById('filterTopic').value;
    const list = document.getElementById('questionList');
    list.innerHTML = '<div class="text-center text-muted">Loading...</div>';

    try {
        const url = topic ? `${API_URL}?topic=${topic}` : API_URL;
        const res = await fetch(url);
        const questions = await res.json();

        renderList(questions);
    } catch (err) {
        console.error(err);
        list.innerHTML = '<div class="text-danger">Failed to load questions</div>';
    }
}

function renderList(questions) {
    const list = document.getElementById('questionList');
    if (questions.length === 0) {
        list.innerHTML = '<div class="text-muted text-center">No questions found.</div>';
        return;
    }

    list.innerHTML = questions.map(q => `
        <div class="card mb-2">
            <div class="card-body py-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <span class="badge bg-${q.topic === 'math' ? 'primary' : 'success'} me-2">${q.topic}</span>
                        <span class="badge bg-secondary me-2">${q.difficulty || 'easy'}</span>
                        <span class="fw-bold">${q.questionText}</span>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteQuestion('${q._id}')">×</button>
                </div>
                <div class="mt-2 small">
                    <span class="text-success fw-bold">✓ ${q.correctAnswer}</span>
                    <span class="text-muted ms-2">✗ ${q.wrongAnswers.join(', ')}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleAddQuestion(e) {
    e.preventDefault();

    const topic = document.getElementById('topic').value;
    const difficulty = document.getElementById('difficulty').value;
    const questionText = document.getElementById('questionText').value;
    const correctAnswer = document.getElementById('correctAnswer').value;

    // Collect wrong answers
    const wrongInputs = document.querySelectorAll('.wrong-input');
    const wrongAnswers = Array.from(wrongInputs).map(input => input.value).filter(val => val.trim() !== '');

    const payload = {
        topic,
        difficulty,
        questionText,
        correctAnswer,
        wrongAnswers
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await res.text());

        // Reset form
        e.target.reset();
        loadQuestions(); // Refresh list
        alert('Question added successfully!');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Expose delete function to global scope
async function deleteQuestion(id) {
    if (!confirm('Area you sure you want to delete this question?')) return;

    try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        loadQuestions();
    } catch (err) {
        alert('Failed to delete: ' + err.message);
    }
}
