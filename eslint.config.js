const commonGlobals = {
  Buffer: "readonly",
  console: "readonly",
  process: "readonly"
};

const commonJsGlobals = {
  ...commonGlobals,
  __dirname: "readonly",
  __filename: "readonly",
  exports: "readonly",
  module: "readonly",
  require: "readonly"
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "cdk.out/**"
    ]
  },
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: commonJsGlobals
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-redeclare": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: commonGlobals
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-redeclare": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }]
    }
  }
];
