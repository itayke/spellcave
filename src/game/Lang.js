import fs from 'fs/promises';

export class Lang {
  // Constants
  static PublicFilePath = 'public/';
  static LangDataFilePath = 'assets/langData/';
  static LangWordsFilePrefix = 'words-';
  static LangDataFilePrefix = 'config-';
  static LangTreeFilePrefix = 'tree-';
  static LangProbFilePrefix = 'prob-';
  static WildcardToken = '?';
  static MaxTokenLen = 1;
  static MinWordLength = 2;

  langTokensUpper = new Set();
  gameTokensUpper = new Set();
  gameOnlyTokensUpper = new Set();
  allTokensUpper = new Set();
  gameTokensUpperToReadable = new Map();

  #letterTree = null;
  #frequencies = null;
  #frequenciesBase = null;
  #frequenciesTemp = null;
  #langDataJSON = null;

  static #Instance = null;
  #initialized = false;

  constructor() {
    if (Lang.#Instance) {
      throw new Error('Lang instance already exists');
    }
    Lang.#Instance = this;
  }

  static getInstance = () => Lang.#Instance ??= new Lang();
  isInitialized = () => this.#initialized;

  async initialize(lang) {
    if (this.#initialized)
      return false;

    try {
      await this.#readLangData(lang);
      await this.#readProbData(lang);
      await this.#readLetterTree(lang);
      this.#initialized = true;
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  async #readLangData(lang) {
    try {
      const response = await fetch(`${Lang.LangDataFilePath}${Lang.LangDataFilePrefix}${lang}.json`);
      if (!response.ok) {
        throw new Error(`${Lang.LangDataFilePath}${this.LangDataFilePrefix}${lang} file missing`);
      }

      this.#langDataJSON = await response.json();

      await this.processLangData(this.#langDataJSON);

    } catch (error) {
      console.error('Error reading language data:', error);
      throw error;
    }
  }

  async processLangData(langDataJSON) {
    this.langTokensUpper.clear();
    this.gameTokensUpper.clear();
    this.allTokensUpper.clear();
    this.gameOnlyTokensUpper.clear();
    this.gameTokensUpperToReadable.clear();

    // Process tokens
    for (const token of langDataJSON.Tokens) {
      const tok = token.toUpperCase();
      this.langTokensUpper.add(tok);
      this.allTokensUpper.add(tok);
    }

    // Process game tokens
    for (const token of langDataJSON.GameTokens) {
      const up = token.toUpperCase();
      this.gameTokensUpper.add(up);

      if (up !== token) {
        this.gameTokensUpperToReadable.set(up, token);
      }

      if (token.length > Lang.MaxTokenLen) {
        Lang.MaxTokenLen = token.length;
      }

      if (!this.langTokensUpper.has(up)) {
        this.gameOnlyTokensUpper.add(up);
        this.allTokensUpper.add(up);
      }
    }

    // Process parameters
    if (langDataJSON.MinimumWord) {
      Lang.MinWordLength = langDataJSON.MinimumWord;
    }

    if (langDataJSON.WildcardToken) {
      Lang.WildcardToken = langDataJSON.WildcardToken;
    }
  }

  async #readProbData(lang) {
    try {
      const response = await fetch(`${Lang.LangDataFilePath}${Lang.LangProbFilePrefix}${lang}.json`);
      if (!response.ok) {
        throw new Error(`${Lang.LangDataFilePath}${Lang.LangProbFilePrefix}${lang} file missing`);
      }

      const probData = await response.json();
      this.#frequenciesBase = new Map();

      let baseTotalFreq = 0;
      for (const [key, value] of Object.entries(probData)) {
        this.#frequenciesBase.set(key, value);
        baseTotalFreq += value;
      }

      // Normalize frequencies
      for (const [key, value] of this.#frequenciesBase) {
        this.#frequenciesBase.set(key, value / baseTotalFreq);
      }
    } catch (error) {
      console.error('Error reading probability data:', error);
      throw error;
    }
  }

  async #readLetterTree(lang) {
    try {
      const response = await fetch(`${Lang.LangDataFilePath}${Lang.LangTreeFilePrefix}${lang}.txt`);
      if (!response.ok) {
        throw new Error(`${Lang.LangDataFilePath}${Lang.LangTreeFilePrefix}${lang} file missing`);
      }

      const text = await response.text();
      this.#letterTree = new TokenNode();
      this.#letterTree.deserialize(text);
    } catch (error) {
      console.error('Error reading words:', error);
      throw error;
    }
  }

  finalizeProbs(extraProbs) {
    this.#frequencies = new Map(this.#frequenciesBase);
    let totalFreq = 1.0;

    for (const [key, value] of Object.entries(extraProbs)) {
      this.#frequencies.set(key, value);
      totalFreq += value;
    }

    // Normalize all frequencies
    for (const [key, value] of this.#frequencies) {
      this.#frequencies.set(key, value / totalFreq);
    }

    // Initialize temporary frequencies
    this.#frequenciesTemp = new Map();
    for (const [key, value] of this.#frequencies) {
      this.#frequenciesTemp.set(key, 0);
    }
  }

  randomizeToken(baseOnly = false) {
    let rando = Lang.getRandom01();
    const freqs = baseOnly ? this.#frequenciesBase : this.#frequencies;

    for (const [key, value] of freqs) {
      if (rando < value) return key;
      rando -= value;
    }
    return null;
  }

  #addTempTokens(probs, negProbs, totalTmpProbs, mul = 1.0, tokenRandom = 0.0) {
    for (const [key, value] of Object.entries(probs)) {
      let negProb = 0;
      let prob = value === 0 ? 0 : (lerp(value, 1, tokenRandom) * mul);

      if (negProbs?.has(key)) {
        negProb = negProbs.get(key);
        prob *= (1 - negProb);
      }

      totalTmpProbs += prob;
      this.#frequenciesTemp.set(key, prob);
    }
    return totalTmpProbs;
  }

  // Queries

  randomizeTokenWithProbabilities(negProbs, addlTokens, baseTokensOnly = false, tokenRandom = 0.0) {
    let totalTmpProbs = 0;
    this.#frequenciesTemp.clear();

    totalTmpProbs = this.#addTempTokens(
      baseTokensOnly ? this.#frequenciesBase : this.#frequencies,
      negProbs,
      totalTmpProbs,
      1.0,
      tokenRandom
    );

    if (!baseTokensOnly && addlTokens) {
      totalTmpProbs = this.#addTempTokens(
        addlTokens,
        negProbs,
        totalTmpProbs,
        totalTmpProbs,
        tokenRandom
      );
    }

    let rando = Lang.getRandom01() * totalTmpProbs;
    for (const [key, prob] of this.#frequenciesTemp) {
      if (rando < prob) return key;
      rando -= prob;
    }

    throw new Error('No letters available');
  }

  getAllWildcardPartialWords(word, results = new Set()) {
    const wildIdx = word.indexOf(Lang.WildcardToken);
    if (wildIdx < 0) {
      if (this.isPartialWord(word)) {
        results.add(word);
      }
      return results;
    }

    const part = wildIdx === 0 ? '' : word.slice(0, wildIdx);
    const wildcardOptions = wildIdx === 0 ?
      this.allTokensUpper :
      this.nextLettersInPartialWord(part);

    if (!wildcardOptions) return results;

    const rest = word.slice(wildIdx + 1);
    for (const option of wildcardOptions) {
      this.getAllWildcardPartialWords(part + option + rest, results);
    }

    return results;
  }

  isPartialWord(word) {
    if (!word.length) return false;
    const result = this.#letterTree.isPartialOrFullWord(word.toUpperCase(), this);
    return result.isPartial;
  }

  isWord(word) {
    if (word.length < Lang.MinWordLength) return false;
    const result = this.#letterTree.isPartialOrFullWord(word.toUpperCase(), this);
    return result.isFullWord;
  }

  nextLettersInPartialWord(word) {
    if (!word.length) return null;
    const partial = this.#letterTree.getPartialWord(word.toUpperCase(), this);
    return partial?.nextTokens ? Array.from(partial.nextTokens.keys()) : null;
  }

  getRandomWord = (length) => this.#letterTree.getRandomWord(length, this);

  getNextGameToken = (word) => Lang.getNextToken(word, this.gameTokensUpper);

  getReadableToken = (tok) => this.gameTokensUpperToReadable.get(tok) || tok;

  //
  // Static functions
  //

  static getRandom01 = () => Math.random();

  static getRandomRange(min, max) {
    if (Number.isInteger(min) && Number.isInteger(max)) {
      return Math.floor(Math.random() * (max - min)) + min;
    }
    return Math.random() * (max - min) + min;
  }

  static generateRandomSeed = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

  static getNextToken(word, tokenList) {
    if (word.length === 0) return null;

    for (let tokLen = 1; tokLen <= Lang.MaxTokenLen && tokLen <= word.length; tokLen++) {
      const token = word.slice(0, tokLen);
      if (tokenList.has(token)) return token;
    }
    return null;
  }

  static lerp = (start, end, amt) => ((1 - amt) * start + amt * end);

  static getAveragedRandom01(avg) {
    const rand = Lang.getRandom01();
    return rand < 0.5 ?
      Lang.lerp(0, avg, rand * 2) :
      Lang.lerp(avg, 1, (rand - 0.5) * 2);
  }

  static getAveragedRandomRange(min, avg, max) {
    const rand = Lang.getAveragedRandom01((avg - min) / (max - min));
    return Lang.lerp(min, max, rand);
  }

  // Remove first character (byte order mark) if available
  static stripBOM = (data) => data.charCodeAt(0) === 0xFEFF ? data.substring(1) : data;

  //
  //  Offline processing (menu items)
  //

  static async exportLetterTree(lang) {
    try {

      const langInstance = Lang.getInstance();

      const configContent = await fs.readFile(`${Lang.PublicFilePath}${Lang.LangDataFilePath}${Lang.LangDataFilePrefix}${lang}.json`, 'utf-8');
      langInstance.processLangData(JSON.parse(Lang.stripBOM(configContent)));

      const timeStart = performance.now();

      // Read words file
      const wordsContent = await fs.readFile(`${Lang.PublicFilePath}${Lang.LangDataFilePath}${Lang.LangWordsFilePrefix}${lang}.txt`, 'utf-8');

      // Process words and create tree
      const { numWords, treeData, probabilities } = await Lang.processWords(Lang.stripBOM(wordsContent), langInstance);

      // Save tree file
      await fs.writeFile(`${Lang.PublicFilePath}${Lang.LangDataFilePath}${Lang.LangTreeFilePrefix}${lang}.txt`, treeData);

      // Save probabilities file
      await fs.writeFile(`${Lang.PublicFilePath}${Lang.LangDataFilePath}${Lang.LangProbFilePrefix}${lang}.json`, JSON.stringify(probabilities, null, 2));

      const timeSec = (performance.now() - timeStart) / 1000;
      console.log(`Tree data length: ${(treeData.length/1024).toFixed(2)} kb, #words: ${numWords}, Time: ${timeSec.toFixed(3)}s`);

    } catch (error) {
      console.error('Error exporting letter tree:', error);
    }
  }

  /**
   * Process words to create tree and probability data
   * @param {string} content - Raw words content
   * @returns {Promise<{treeData: string, probabilities: Object, numWords: Number}>}
   */
  static async processWords(content, langInstance) {
    const words = content.split('\n')
      .map(word => word.trim().toUpperCase())
      .filter(word => word.length >= Lang.MinWordLength);

    const probabilities = new Map();
    const tree = new TokenNode();

    words.forEach(word => {
      tree.addWord(word, langInstance);

      for (let i = 0, tok;
        tok = Lang.getNextToken(word.substring(i), langInstance.gameTokensUpper);
        i += tok.length) {
        probabilities[tok] = (probabilities[tok] ?? 0) + 1;
      }
    });

    return {
      numWords: words.length,
      treeData: tree.serialize(),
      probabilities
    };
  }
}

class TokenNode {
  nextTokens = null;
  isWord = false;

  addWord(word, langInstance) {
    const token = Lang.getNextToken(word, langInstance.langTokensUpper);
    let next;
    let rest;

    if (token !== null) {
      next = this.#addWordToken(token);
      rest = word.slice(token.length);
      if (rest.length > 0) {
        next.addWord(rest, langInstance);
      } else {
        next.isWord = true;
      }
    }

    const gameToken = Lang.getNextToken(word, langInstance.gameOnlyTokensUpper);
    if (gameToken === null) return;

    next = this.#addWordToken(gameToken);
    rest = word.slice(gameToken.length);
    if (rest.length > 0) {
      next.addWord(rest, langInstance);
    } else {
      next.isWord = true;
    }
  }

  #addWordToken(token) {
    if (!this.nextTokens) {
      this.nextTokens = new Map();
    }

    let wordToken = this.nextTokens.get(token);
    if (!wordToken) {
      wordToken = new TokenNode();
      this.nextTokens.set(token, wordToken);
    }
    return wordToken;
  }

  isPartialOrFullWord(word, langInstance) {
    if (word.length === 0) {
      return { isPartial: true, isFullWord: this.isWord };
    }

    const token = Lang.getNextToken(word, langInstance.langTokensUpper);
    if (!token) return { isPartial: false, isFullWord: false };

    const rest = word.slice(token.length);
    if (!this.nextTokens || !this.nextTokens.has(token)) {
      return { isPartial: false, isFullWord: false };
    }

    return this.nextTokens.get(token).isPartialOrFullWord(rest, langInstance);
  }

  getPartialWord(word, langInstance) {
    if (word.length === 0) return this;

    const token = Lang.getNextToken(word, langInstance.langTokensUpper);
    if (!token) return null;

    const rest = word.slice(token.length);
    if (!this.nextTokens || !this.nextTokens.has(token)) return null;

    return this.nextTokens.get(token).getPartialWord(rest, langInstance);
  }

  getRandomWord(numTokens, langInstance, word = '') {
    if (!this.nextTokens || this.nextTokens.size === 0) return null;

    const options = Array.from(this.nextTokens.keys());
    while (options.length > 0) {
      const i = getRandomRange(0, options.length);
      const tok = options[i];
      if (langInstance.gameTokensUpper.has(tok)) {
        const nl = this.nextTokens.get(tok);
        if (numTokens <= 1) {
          return nl.isWord ? (word + tok) : null;
        } else {
          const recWord = nl.getRandomWord(numTokens - 1, langInstance, word + tok);
          if (recWord !== null) return recWord;
        }
      }
      options.splice(i, 1);
    }
    return null;
  }

  serialize() {
    if (!this.nextTokens) return '';

    let result = this.isWord ? '[' : '(';
    let first = true;

    for (const [token, nextLetter] of this.nextTokens) {
      if (first) {
        first = false;
      }
      result += token.length === 1 ? token : `{${token}}`;
      result += nextLetter.serialize();
    }

    return result + (this.isWord ? ']' : ')');
  }

  deserialize(text) {
    this.isWord = true;
    let pos = 0;

    const peek = () => text[pos] || '';
    const read = () => text[pos++] || '';

    const next = peek();
    if (!next) return;

    if (next === ')' || next === ']') return;

    if (next === '(') this.isWord = false;
    else if (next !== '[') return;

    pos++;

    while (pos < text.length) {
      const c = read();
      if (c === ')' || c === ']') return;

      let token;
      if (c === '{') {
        token = '';
        while (pos < text.length) {
          const nextChar = read();
          if (!nextChar || nextChar === '}') break;
          token += nextChar;
        }
      } else {
        token = c;
      }

      const nl = this.#addWordToken(token);
      nl.deserialize(text.slice(pos));
    }
  }
}

// Language module usage example:
/*
// Initialize the language system
const lang = Lang.getInstance();
await lang.initialize();

// Get a random word of length 5
const word = lang.getRandomWord(5);

// Check if a word is valid
const isValid = lang.isWord('HELLO');

// Get next possible letters for a partial word
const nextLetters = lang.nextLettersInPartialWord('HE');

// Get a random token based on frequencies
const token = lang.randomizeToken();

// Add extra probabilities and get a token
lang.finalizeProbs({
  'A': 0.1,
  'B': 0.2
});
const tokenWithProb = lang.randomizeTokenWithProbabilities(
  new Map([['X', 0.5]]),  // negative probabilities
  { 'Y': 0.3 },          // additional tokens
  false,                 // use base tokens only
  0.2                    // token randomness
);
*/