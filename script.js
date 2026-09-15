(() => {
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const levelSelect = document.getElementById('level-select');
  const startBtn = document.getElementById('start-btn');
  const restartBtn = document.getElementById('restart-btn');
  const loadError = document.getElementById('load-error');
  const board = document.getElementById('board');

  const statTime = document.getElementById('stat-time');
  const statMoves = document.getElementById('stat-moves');
  const statAccuracy = document.getElementById('stat-accuracy');

  const winModal = document.getElementById('win-modal');
  const finalTime = document.getElementById('final-time');
  const finalMoves = document.getElementById('final-moves');
  const finalAccuracy = document.getElementById('final-accuracy');
  const playAgainBtn = document.getElementById('play-again-btn');
  const changeLevelBtn = document.getElementById('change-level-btn');

  let jpWords = [];
  let plWords = [];
  let selectedPairs = null;

  let flippedCards = [];
  let matchedCount = 0;
  let moves = 0;
  let successfulMatches = 0;
  let boardLocked = false;
  let timerInterval = null;
  let secondsElapsed = 0;
  let timerStarted = false;
  let mismatchTimeout = null;

  Promise.all([
    fetch('data/words-jp.json').then((res) => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    }),
    fetch('data/words-pl.json').then((res) => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    }),
  ])
    .then(([jp, pl]) => {
      jpWords = jp;
      plWords = pl;
    })
    .catch(() => {
      loadError.hidden = false;
    });

  levelSelect.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-btn');
    if (!btn) return;
    document.querySelectorAll('.level-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedPairs = Number(btn.dataset.pairs);
    startBtn.disabled = false;
  });

  startBtn.addEventListener('click', () => {
    if (!selectedPairs || jpWords.length === 0 || plWords.length === 0) return;
    startGame(selectedPairs);
  });

  restartBtn.addEventListener('click', () => {
    goToStart();
  });

  playAgainBtn.addEventListener('click', () => {
    winModal.hidden = true;
    startGame(selectedPairs);
  });

  changeLevelBtn.addEventListener('click', () => {
    winModal.hidden = true;
    goToStart();
  });

  function goToStart() {
    stopTimer();
    clearMismatchTimeout();
    gameScreen.hidden = true;
    startScreen.hidden = false;
  }

  function clearMismatchTimeout() {
    if (mismatchTimeout) {
      clearTimeout(mismatchTimeout);
      mismatchTimeout = null;
    }
  }

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function startGame(pairCount) {
    const plByEnglish = new Map(plWords.map((word) => [word.english, word]));
    const pairKeys = shuffle(
      jpWords.filter((word) => plByEnglish.has(word.english)).map((word) => word.english)
    ).slice(0, pairCount);

    const cards = [];
    pairKeys.forEach((english) => {
      const jpWord = jpWords.find((word) => word.english === english);
      const plWord = plByEnglish.get(english);
      cards.push({ uid: `${english}-jp`, matchKey: english, type: 'jp', word: jpWord });
      cards.push({ uid: `${english}-pl`, matchKey: english, type: 'pl', word: plWord });
    });

    const shuffledCards = shuffle(cards);

    flippedCards = [];
    matchedCount = 0;
    moves = 0;
    successfulMatches = 0;
    boardLocked = false;
    secondsElapsed = 0;
    timerStarted = false;

    updateStats();
    stopTimer();
    clearMismatchTimeout();
    statTime.textContent = '00:00';

    renderBoard(shuffledCards, pairCount);

    startScreen.hidden = true;
    gameScreen.hidden = false;
  }

  function renderBoard(cards, pairCount) {
    board.innerHTML = '';
    board.className = 'board';
    if (pairCount === 10) board.classList.add('board-10');
    if (pairCount === 15) board.classList.add('board-15');

    cards.forEach((card) => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.type}`;
      cardEl.dataset.uid = card.uid;
      cardEl.dataset.matchKey = card.matchKey;
      cardEl.dataset.type = card.type;

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.textContent = '合';

      const front = document.createElement('div');
      front.className = 'card-face card-front';

      if (card.type === 'jp') {
        front.innerHTML = `
          <span class="card-kanji">${card.word.kanji}</span>
          <span class="card-kana">${card.word.kana}</span>
          <span class="card-romaji">${card.word.romaji}</span>
        `;
      } else {
        front.innerHTML = `<span class="card-polish">${card.word.polish}</span>`;
      }

      inner.appendChild(back);
      inner.appendChild(front);
      cardEl.appendChild(inner);
      cardEl.addEventListener('click', () => onCardClick(cardEl));
      board.appendChild(cardEl);
    });
  }

  function onCardClick(cardEl) {
    if (boardLocked) return;
    if (cardEl.classList.contains('flipped') || cardEl.classList.contains('matched')) return;
    if (flippedCards.length === 2) return;

    if (!timerStarted) {
      startTimer();
    }

    cardEl.classList.add('flipped');
    flippedCards.push(cardEl);

    if (flippedCards.length === 2) {
      moves += 1;
      updateStats();
      checkMatch();
    }
  }

  function checkMatch() {
    const [first, second] = flippedCards;
    const isMatch =
      first.dataset.matchKey === second.dataset.matchKey &&
      first.dataset.type !== second.dataset.type;

    if (isMatch) {
      first.classList.add('matched');
      second.classList.add('matched');
      matchedCount += 1;
      successfulMatches += 1;
      flippedCards = [];
      updateStats();

      if (matchedCount === board.children.length / 2) {
        setTimeout(finishGame, 500);
      }
    } else {
      boardLocked = true;
      first.classList.add('mismatch');
      second.classList.add('mismatch');
      mismatchTimeout = setTimeout(() => {
        first.classList.remove('flipped', 'mismatch');
        second.classList.remove('flipped', 'mismatch');
        flippedCards = [];
        boardLocked = false;
        mismatchTimeout = null;
      }, 800);
    }
  }

  function updateStats() {
    statMoves.textContent = String(moves);
    const accuracy = moves === 0 ? 100 : Math.round((successfulMatches / moves) * 100);
    statAccuracy.textContent = `${accuracy}%`;
  }

  function startTimer() {
    timerStarted = true;
    timerInterval = setInterval(() => {
      secondsElapsed += 1;
      statTime.textContent = formatTime(secondsElapsed);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function finishGame() {
    stopTimer();
    finalTime.textContent = formatTime(secondsElapsed);
    finalMoves.textContent = String(moves);
    const accuracy = moves === 0 ? 100 : Math.round((successfulMatches / moves) * 100);
    finalAccuracy.textContent = `${accuracy}%`;
    winModal.hidden = false;
  }
})();
