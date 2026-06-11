module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-debugger": "warn",
      "no-duplicate-case": "error",
      "no-empty": "error",
      "no-extra-semi": "error",
      "no-unreachable": "error",
      "curly": "error",
      "eqeqeq": "error",
      "no-var": "error",
      "prefer-const": "error"
    }
  }
];
