module.exports = {
  "extends": "airbnb-base",
  "plugins": [
    "import"
  ],
  "env": {
    "node": true
  },
  "rules": {
    "comma-dangle": [
      "error",
      {
        "arrays": "never",
        "objects": "never",
        "imports": "never",
        "exports": "never",
        "functions": "never"
      }
    ],

    "no-prototype-builtins": "off",
    "max-len": ["error", 100, 2, {
      "ignoreUrls": true,
      "ignoreComments": true,
      "ignoreRegExpLiterals": true,
      "ignoreStrings": true,
      "ignoreTemplateLiterals": true,
    }],
    "no-underscore-dangle": "off",
    "no-param-reassign": "off",
    "guard-for-in": "off",
    "class-methods-use-this": "off",
  }
};
