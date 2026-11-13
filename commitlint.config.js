// Commit-Nachrichten nach Conventional Commits: daraus berechnet semantic-release die nächste Version.
//   feat: …   → neue Minor-Version      fix: … / perf: …  → neue Patch-Version
//   feat!: … oder «BREAKING CHANGE:» im Text → neue Major-Version
//   docs, style, refactor, test, build, ci, chore → keine neue Version
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Deutsche Sätze beginnen oft mit Grossbuchstaben (Substantive)
    'subject-case': [0],
    'body-max-line-length': [1, 'always', 120],
    'footer-max-line-length': [0],
  },
};
