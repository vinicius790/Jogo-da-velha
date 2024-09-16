const cells = document.querySelectorAll('.cell');
let currentPlayer = 'X';
let gameOver = false;

function handleClick(cell) {
  if (gameOver || cell.textContent) return;

  cell.textContent = currentPlayer;
  if (checkWinner()) {
    gameOver = true;
    alert(`${currentPlayer} venceu!`);
  } else if (checkTie()) {
    gameOver = true;
    alert('Empate!');
  } else {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  }
}

function checkWinner() {
  const winningCombinations = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  return winningCombinations.some(combination => {
    return combination.every(index => cells[index].textContent === currentPlayer);
  });
}

function checkTie() {
  return [...cells].every(cell => cell.textContent);
}

function resetGame() {
  cells.forEach(cell => {
    cell.textContent = '';
  });
  currentPlayer = 'X';
  gameOver = false;
}

cells.forEach(cell => {
  cell.addEventListener('click', () => handleClick(cell));
});

document.querySelector('.reset-button').addEventListener('click', resetGame);
