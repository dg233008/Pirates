/* Interactive Quiz App (日本語化 + AFAA PILATES サンプル組み込み)
   使い方:
   - index.html をブラウザで開く
   - 「サンプル（AFAA PILATES）を読み込む」を押すと、下記の模擬試験（10問）がロードされます
*/

(() => {
  // Elements
  const importBtn = document.getElementById('import-btn');
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');
  const pasteArea = document.getElementById('paste-area');
  const loadBtn = document.getElementById('load-btn');
  const sampleBtn = document.getElementById('sample-btn');
  const loaderError = document.getElementById('loader-error');

  const quizCard = document.getElementById('quiz-card');
  const doneCard = document.getElementById('done-card');
  const questionText = document.getElementById('question-text');
  const choicesEl = document.getElementById('choices');
  const currentEl = document.getElementById('current');
  const totalEl = document.getElementById('total');
  const scoreValue = document.getElementById('score-value');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');
  const feedbackEl = document.getElementById('feedback');

  const reviewArea = document.getElementById('review-area');
  const reviewList = document.getElementById('review-list');

  const finalScore = document.getElementById('final-score');
  const finalTotal = document.getElementById('final-total');
  const retryBtn = document.getElementById('retry-btn');
  const reviewBtn = document.getElementById('review-btn');
  const exportBtn = document.getElementById('export-btn');
  const shareEl = document.getElementById('share');
  const resetBtn = document.getElementById('reset-btn');

  // State
  let quiz = { title: 'Interactive Quiz', questions: [] };
  let state = {
    index: 0,
    answers: [], // user's selected indexes arrays
    score: 0,
    submitted: [] // whether each question has been submitted
  };

  // Utilities
  function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

  function showSection(id){
    document.getElementById(id).classList.remove('hidden');
  }
  function hideSection(id){
    document.getElementById(id).classList.add('hidden');
  }

  // Quiz data parser (JSON優先、プレーンテキストフォールバック)
  function parseQuizText(text) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return { title: 'Imported Quiz', questions: normalizeQuestions(parsed) };
      } else if (parsed && parsed.questions) {
        return { title: parsed.title || 'Imported Quiz', questions: normalizeQuestions(parsed.questions) };
      }
    } catch (e) {
      // fallthrough
    }
    // 簡易プレーンテキスト解析（省略：既存のロジックをそのまま使う）
    const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const questions = [];
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;
      let qLine = lines[0];
      if (qLine.toLowerCase().startsWith('q:')) qLine = qLine.slice(2).trim();
      const choices = [];
      const correct = [];
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        if (/^[-*]\s+/.test(line)) line = line.replace(/^[-*]\s+/, '');
        let isCorrect = false;
        if (/\*\s*$/.test(line)) { isCorrect = true; line = line.replace(/\*\s*$/, '').trim(); }
        if (/\(correct\)\s*$/i.test(line)) { isCorrect = true; line = line.replace(/\(correct\)\s*$/i, '').trim(); }
        choices.push(line);
        correct.push(isCorrect);
      }
      const q = {
        question: qLine,
        choices: choices.length ? choices : ['True','False'],
        correct: correct.length ? correct.map((v,i)=> v ? i : -1).filter(i=>i>=0) : [0]
      };
      questions.push(q);
    }
    if (questions.length === 0) throw new Error('テキストから問題が見つかりませんでした。');
    return { title: 'Imported Quiz', questions: normalizeQuestions(questions) };
  }

  function normalizeQuestions(qs) {
    return qs.map((q) => {
      if (typeof q === 'string') {
        return { question: q, choices: ['True','False'], correct: [0] };
      }
      const questionText = q.question || q.prompt || q.title || '';
      const choices = q.choices || q.options || [];
      let correct = [];
      if (Array.isArray(q.correct)) correct = q.correct.map(i => (typeof i === 'number' ? i : parseInt(i))).filter(n=>!isNaN(n));
      else if (typeof q.answer === 'number') correct = [q.answer];
      else if (typeof q.answer === 'string') {
        const idx = choices.findIndex(c => String(c).trim().toLowerCase() === String(q.answer).trim().toLowerCase());
        if (idx >= 0) correct = [idx];
      } else if (q.correctIndex !== undefined) correct = [q.correctIndex];
      if (correct.length === 0) {
        choices.forEach((c,i) => {
          if (/\*\s*$/.test(String(c))) {
            correct.push(i);
            choices[i] = String(c).replace(/\*\s*$/,'').trim();
          }
          if (/\(correct\)\s*$/i.test(String(c))) {
            correct.push(i);
            choices[i] = String(c).replace(/\(correct\)\s*$/i,'').trim();
          }
        });
      }
      if (correct.length === 0) correct = [0];
      return {
        question: String(questionText),
        choices: choices.map(c => String(c)),
        correct,
        explanation: q.explanation || ''
      };
    });
  }

  // Rendering
  function renderQuestion() {
    const q = quiz.questions[state.index];
    currentEl.textContent = state.index + 1;
    totalEl.textContent = quiz.questions.length;
    document.getElementById('quiz-title').textContent = quiz.title || 'Interactive Quiz';
    questionText.textContent = q.question;
    clearChildren(choicesEl);
    q.choices.forEach((choice, i) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.type = 'button';
      btn.setAttribute('role','listitem');
      btn.setAttribute('data-index', i);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = `<span class="label">${String.fromCharCode(65 + i)}</span><div class="text">${choice}</div>`;
      const selected = state.answers[state.index];
      if (selected && selected.includes(i)) btn.setAttribute('aria-pressed','true');
      btn.addEventListener('click', () => toggleSelect(i));
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleSelect(i); }
      });
      choicesEl.appendChild(btn);
    });

    prevBtn.disabled = state.index === 0;
    nextBtn.disabled = state.index >= quiz.questions.length - 1;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    if (state.submitted[state.index]) {
      showResultForQuestion(state.index);
    }
    questionText.focus?.();
  }

  function toggleSelect(choiceIndex) {
    const q = quiz.questions[state.index];
    const multi = q.correct && q.correct.length > 1;
    state.answers[state.index] = state.answers[state.index] || [];
    if (!multi) {
      state.answers[state.index] = [choiceIndex];
    } else {
      const idx = state.answers[state.index].indexOf(choiceIndex);
      if (idx === -1) state.answers[state.index].push(choiceIndex);
      else state.answers[state.index].splice(idx,1);
    }
    Array.from(choicesEl.children).forEach(child => {
      const idx = parseInt(child.getAttribute('data-index'));
      child.setAttribute('aria-pressed', state.answers[state.index].includes(idx) ? 'true' : 'false');
    });
  }

  function checkAnswerForQuestion(i) {
    const q = quiz.questions[i];
    const user = state.answers[i] || [];
    const correctSet = new Set(q.correct);
    const userSet = new Set(user);
    if (correctSet.size !== userSet.size) return false;
    for (const x of correctSet) if (!userSet.has(x)) return false;
    return true;
  }

  function showResultForQuestion(i) {
    const q = quiz.questions[i];
    const correct = q.correct;
    Array.from(choicesEl.children).forEach(child => {
      const idx = parseInt(child.getAttribute('data-index'));
      child.classList.remove('correct','incorrect');
      if (correct.includes(idx)) child.classList.add('correct');
      const user = state.answers[i] || [];
      if (!correct.includes(idx) && user.includes(idx)) child.classList.add('incorrect');
      child.setAttribute('aria-pressed', user.includes(idx) ? 'true' : 'false');
    });
    const ok = checkAnswerForQuestion(i);
    if (ok) {
      feedbackEl.textContent = q.explanation || '正解です！';
      feedbackEl.className = 'feedback success';
    } else {
      feedbackEl.textContent = q.explanation || '不正解です。上の正答を確認してください。';
      feedbackEl.className = 'feedback error';
    }
    scoreValue.textContent = state.score;
  }

  function submitCurrent() {
    if (!state.answers[state.index] || state.answers[state.index].length === 0) {
      feedbackEl.textContent = '先に選択してください。';
      feedbackEl.className = 'feedback error';
      return;
    }
    if (state.submitted[state.index]) {
      return;
    }
    const correct = checkAnswerForQuestion(state.index);
    state.submitted[state.index] = true;
    if (correct) state.score += 1;
    showResultForQuestion(state.index);
    persistProgress();
    if (state.index === quiz.questions.length - 1) {
      finishQuiz();
    }
  }

  function finishQuiz() {
    hideSection('quiz-card');
    finalScore.textContent = state.score;
    finalTotal.textContent = quiz.questions.length;
    showSection('done-card');
    shareEl.innerHTML = `スコア: <strong>${state.score}/${quiz.questions.length}</strong>`;
    feedbackEl.textContent = '';
  }

  function gotoIndex(i) {
    if (i < 0 || i >= quiz.questions.length) return;
    state.index = i;
    renderQuestion();
    persistProgress();
  }

  function prev() { gotoIndex(state.index - 1); }
  function next() { gotoIndex(state.index + 1); }

  function buildReview() {
    clearChildren(reviewList);
    quiz.questions.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'review-item';
      const ok = checkAnswerForQuestion(i);
      div.innerHTML = `<strong>Q${i+1}:</strong> ${escapeHtml(q.question)}<br>
        あなたの答え: ${escapeHtml((state.answers[i] || []).map(a=>q.choices[a]).join(', ') || '—')}<br>
        正解: ${escapeHtml(q.correct.map(ci=>q.choices[ci]).join(', '))} ${ok ? '<span style="color:var(--success)">✔</span>' : '<span style="color:var(--danger)">✖</span>'}
        ${q.explanation ? `<div class="explain"><em>${escapeHtml(q.explanation)}</em></div>` : ''}`;
      reviewList.appendChild(div);
    });
  }

  // Persistence
  const STORAGE_KEY = 'copilot_quiz_progress_v1';
  function persistProgress() {
    const data = { quiz, state };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.quiz && parsed.state) {
        quiz = parsed.quiz;
        state = parsed.state;
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }
  function resetProgress() {
    localStorage.removeItem(STORAGE_KEY);
    state = { index: 0, answers: [], score: 0, submitted: [] };
    hideSection('done-card');
    showSection('loader');
    hideSection('quiz-card');
    loaderError.textContent = '';
  }

  // File & paste handlers
  function tryLoad(text) {
    try {
      const parsed = parseQuizText(text);
      quiz = parsed;
      state = { index: 0, answers: [], score: 0, submitted: [] };
      state.answers = new Array(quiz.questions.length).fill(null);
      state.submitted = new Array(quiz.questions.length).fill(false);
      persistProgress();
      hideSection('loader');
      showSection('quiz-card');
      hideSection('done-card');
      renderQuestion();
      scoreValue.textContent = state.score;
    } catch (e) {
      loaderError.textContent = 'クイズ読み込みエラー: ' + e.message;
    }
  }

  loadBtn.addEventListener('click', () => {
    loaderError.textContent = '';
    const val = pasteArea.value.trim();
    if (!val) { loaderError.textContent = 'まずクイズのテキストを貼り付けてください。'; return; }
    tryLoad(val);
  });

  sampleBtn.addEventListener('click', () => {
    const sample = SAMPLE_QUIZ_JSON;
    tryLoad(JSON.stringify(sample, null, 2));
  });

  importBtn.addEventListener('click', () => {
    pasteArea.focus();
    document.getElementById('loader').scrollIntoView({behavior:'smooth'});
  });

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const text = await file.text();
    tryLoad(text);
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  submitBtn.addEventListener('click', submitCurrent);

  retryBtn.addEventListener('click', () => {
    state = { index: 0, answers: new Array(quiz.questions.length).fill(null), score: 0, submitted: new Array(quiz.questions.length).fill(false) };
    persistProgress();
    hideSection('done-card');
    showSection('quiz-card');
    renderQuestion();
  });

  reviewBtn.addEventListener('click', () => {
    buildReview();
    showSection('review-area');
  });

  exportBtn.addEventListener('click', () => {
    const payload = {
      quizTitle: quiz.title,
      date: new Date().toISOString(),
      score: state.score,
      total: quiz.questions.length,
      answers: quiz.questions.map((q,i)=>({
        question: q.question,
        your: (state.answers[i] || []).map(a=> q.choices[a]),
        correct: q.correct.map(ci=> q.choices[ci]),
        ok: checkAnswerForQuestion(i)
      }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title.replace(/\s+/g,'_')}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('保存された進捗を消して読み込み画面に戻りますか？')) resetProgress();
  });

  document.addEventListener('keydown', (ev) => {
    if (document.querySelector('#quiz-card.hidden') !== null) return;
    if (ev.key === 'ArrowRight') next();
    if (ev.key === 'ArrowLeft') prev();
    if (ev.key === 'Enter' && document.activeElement.closest('.choice')) {
      document.activeElement.click();
    }
    if (ev.key === ' ' && document.activeElement === document.body) {
      ev.preventDefault();
      submitCurrent();
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  if (loadPersisted()) {
    if (confirm('保存された進捗が見つかりました。続行しますか？')) {
      hideSection('loader');
      hideSection('done-card');
      showSection('quiz-card');
      renderQuestion();
      scoreValue.textContent = state.score;
    } else {
      resetProgress();
    }
  } else {
    showSection('loader');
  }

  // サンプルクイズ（ご提示のAFAA PILATES 模擬試験 10問）
  const SAMPLE_QUIZ_JSON = {
    title: "AFAA PILATES 模擬試験（ランダム10問）",
    questions: [
      {
        question: "ピラティスの創始者ジョセフ・ピラティスが提唱した「コントロロジー（Contrology）」とは、どのような考え方を指すか？",
        choices: [
          "筋肉を最大限に使う運動理論",
          "身体と心を意識的にコントロールする方法",
          "呼吸だけに集中するリラクゼーション法",
          "激しい有酸素運動の一種"
        ],
        correct: [1],
        explanation: "コントロロジーとは「身体・心・精神を意識的に統合的にコントロールする」という、ピラティスの基本理念です。単なる筋トレや呼吸法ではありません。"
      },
      {
        question: "ピラティスの6原則のうち、以下のうち誤っているものはどれか。",
        choices: [
          "呼吸（Breathing）",
          "精神統一（Concentration）",
          "緊張（Tension）",
          "制御（Control）"
        ],
        correct: [2],
        explanation: "6原則は「呼吸・集中・制御・正確さ・流れ・中心化」。Tension（緊張）は含まれません。"
      },
      {
        question: "「Powerhouse（パワーハウス）」とは、主にどの部位を指すか？",
        choices: [
          "胸郭全体",
          "上腕二頭筋",
          "体幹部（腹部・骨盤底・背筋）",
          "足首とふくらはぎ"
        ],
        correct: [2],
        explanation: "パワーハウスは、腹部・骨盤底・背部を中心とした体幹部を意味し、全ての動作の基礎です。"
      },
      {
        question: "ピラティスの呼吸法として最も適切なのはどれか。",
        choices: [
          "腹式呼吸",
          "胸式呼吸（ラテラル呼吸）",
          "口呼吸",
          "無呼吸で行う"
        ],
        correct: [1],
        explanation: "ピラティスでは胸郭を横に広げる胸式呼吸（lateral breathing）を用います。体幹の安定を保ちながら酸素を取り入れるためです。"
      },
      {
        question: "「ロールアップ（Roll Up）」の主な目的はどれか。",
        choices: [
          "脚力強化",
          "背骨の柔軟性向上と腹筋の強化",
          "有酸素能力向上",
          "肩の安定性向上"
        ],
        correct: [1],
        explanation: "ロールアップは脊柱の分節的な動きと腹直筋のコントロールを目的とします。"
      },
      {
        question: "ピラティスにおける「ニュートラルポジション」とは何を指すか。",
        choices: [
          "背骨を完全に平らにした姿勢",
          "骨盤と背骨が自然な湾曲を保った位置",
          "骨盤を前傾させた姿勢",
          "猫背の状態"
        ],
        correct: [1],
        explanation: "ニュートラルポジションは、骨盤と脊柱の自然なカーブを維持した状態。これが正しい姿勢の基準となります。"
      },
      {
        question: "「プランク（Plank）」ポジションで特に意識すべき筋群はどれか。",
        choices: [
          "下腿三頭筋",
          "体幹（腹横筋・腹斜筋・背筋）",
          "前腕屈筋群",
          "頸部屈筋"
        ],
        correct: [1],
        explanation: "プランクはコア全体の安定を目的としており、特に体幹部の筋群を強く意識します。"
      },
      {
        question: "ピラティスにおける「プレパレーション（Preparation）」の意義として正しいものは？",
        choices: [
          "運動前の筋肉疲労を促す",
          "関節の可動性を制限する",
          "正しい呼吸と姿勢を確認し、動作準備を行う",
          "強度を上げるためのウォームアップ"
        ],
        correct: [2],
        explanation: "プレパレーションは、呼吸と姿勢を整え、動作の精度を高める重要な段階です。"
      },
      {
        question: "次のうち、リフォーマー（Reformer）を使用する利点として最も適切なものはどれか。",
        choices: [
          "体幹の安定性を無視できる",
          "重力を利用せずに運動できる",
          "抵抗を調整して個人に合ったトレーニングが可能",
          "主に有酸素運動目的で使われる"
        ],
        correct: [2],
        explanation: "リフォーマーではスプリングの抵抗を調整することで、個人のレベルに合わせた安全なトレーニングが可能です。"
      },
      {
        question: "インストラクターがクラスを指導する際、最も重視すべき安全原則はどれか。",
        choices: [
          "生徒の疲労を無視して続行させる",
          "解剖学的アライメントの確認",
          "呼吸を止めさせて集中させる",
          "難易度を上げ続ける"
        ],
        correct: [1],
        explanation: "安全な指導の基本は、参加者のアライメント（姿勢）を常に確認し、ケガを防ぐことです。"
      }
    ]
  };

  window.__quizApp = {
    getState: () => ({ quiz, state }),
    loadText: tryLoad,
    resetProgress
  };

})();