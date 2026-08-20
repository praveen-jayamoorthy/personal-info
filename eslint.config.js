const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: ["node_modules/**", ".expo/**", "android/**", "ios/**", "dist/**", "web-build/**"],
  },
];
