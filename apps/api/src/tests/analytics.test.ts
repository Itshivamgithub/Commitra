import { HealthScoreCalculator } from '../modules/analytics/health.calculator';

describe('HealthScoreCalculator', () => {
  let calculator: HealthScoreCalculator;

  beforeEach(() => {
    calculator = new HealthScoreCalculator();
  });

  describe('calculateCommitConsistency', () => {
    it('returns a low score for no commits', () => {
      const score = calculator.calculateCommitConsistency([]);
      expect(score).toBeLessThan(30);
    });
  });

  describe('calculatePRHealth', () => {
    it('returns a neutral score for no PRs', () => {
      const score = calculator.calculatePRHealth([]);
      expect(score).toBe(40);
    });
  });

  describe('calculateIssueHealth', () => {
    it('returns a neutral score for no issues', () => {
      const score = calculator.calculateIssueHealth([]);
      expect(score).toBe(50);
    });
  });

  describe('calculateOverallScore', () => {
    it('calculates weighted average correctly', () => {
      const scores = {
        commitConsistency: 100,
        prHealthScore: 100,
        issueHealthScore: 100,
        codeActivityScore: 100,
        communityScore: 100
      };
      const overall = calculator.calculateOverallScore(scores);
      expect(overall).toBe(100);
    });
  });

  describe('gradeFromScore', () => {
    it('returns correct grades', () => {
      expect(calculator.gradeFromScore(95)).toBe('A+');
      expect(calculator.gradeFromScore(85)).toBe('A');
      expect(calculator.gradeFromScore(75)).toBe('B+');
      expect(calculator.gradeFromScore(65)).toBe('B');
      expect(calculator.gradeFromScore(55)).toBe('C');
      expect(calculator.gradeFromScore(45)).toBe('D');
      expect(calculator.gradeFromScore(30)).toBe('F');
    });
  });
});
