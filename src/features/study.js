const MAX_LESSONS = 50;

/**
 * Transforma o relatório de `gradeReplay` em lições: cada imprecisão ou erro grave de `player`
 * vira um item com o lance jogado e a alternativa que a busca preferiu.
 * Sem `player` (ex.: replay de partida local), considera os dois lados.
 */
export function lessonsFromReport(replay, report, player = null) {
  return report.grades
    .filter((grade) => grade.grade === 'inaccuracy' || grade.grade === 'blunder')
    .filter((grade) => !player || grade.mark === player)
    .slice(0, MAX_LESSONS)
    .map((grade) => ({
      source: replay.id,
      turn: grade.turn,
      mark: grade.mark,
      played: grade.index,
      best: grade.best,
      severity: grade.grade,
    }));
}
