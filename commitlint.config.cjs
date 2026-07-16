module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "build",
        "chore",
        "ci",
        "design",
        "docs",
        "feat",
        "feature",
        "fix",
        "perf",
        "refactor",
        "release",
        "revert",
        "style",
        "test",
        "tools",
      ],
    ],
  },
}
