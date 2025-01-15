import fs from 'fs/promises';

export class LanguageTree {
  // Constants
  static PublicFilePath = 'public/';
  static LangDataFilePath = 'assets/langData/';
  static LangWordsFilePrefix = 'words-';
  static LangConfigFilePrefix = 'config-';
  static LangTreeFilePrefix = 'tree-';
  static LangProbFilePrefix = 'prob-';
  static WildcardToken = '?';
  static MaxTokenLen = 1;
  static MinWordLength = 2;

  // Utility data
  static generalData;

  langTokensUpper = new Set();
  gameTokensUpper = new Set();
  gameOnlyTokensUpper = new Set();
  allTokensUpper = new Set();
  gameTokensUpperToReadable = new Map();

  #tokenTree = null;
  #frequencies = null;
  #frequenciesBase = null;
  #frequenciesTemp = null;
  #langDataJSON = null;

  static #Instance = null;
  #initialized = false;

  constructor() {
    if (LanguageTree.#Instance) {
      throw new Error('LanguageTree instance already exists');
    }
    LanguageTree.#Instance = this;

    LanguageTree.generalData = {
      numWords: 0,
      numTokens: 0,
      letterTreeSize: 0
    };
  }

  static getInstance = () => LanguageTree.#Instance ??= new LanguageTree();
  isInitialized = () => this.#initialized;

  async initialize(langCode, offline) {
    if (this.#initialized)
      return false;

    try {
      await this.readLangConfig(langCode, offline);
      await this.readProbData(langCode, offline);
      await this.readLetterTree(langCode, offline);
      this.#initialized = true;
      return true;
    } catch (error) {
      console.error('Initialization error:', error);
      return false;
    }
  }

  async readLangConfig(langCode, offline) {
    try {
      this.#langDataJSON = await LanguageTree.readFileJSON(`${LanguageTree.LangConfigFilePrefix}${langCode}.json`, offline);
      await this.processLangConfig(this.#langDataJSON);

    } catch (error) {
      console.error('Error reading language data:', error);
      throw error;
    }
  }

  async processLangConfig(langConfigJSON) {
    this.langTokensUpper.clear();
    this.gameTokensUpper.clear();
    this.allTokensUpper.clear();
    this.gameOnlyTokensUpper.clear();
    this.gameTokensUpperToReadable.clear();

    // Process tokens
    for (const token of langConfigJSON.Tokens) {
      const tok = token.toUpperCase();
      this.langTokensUpper.add(tok);
      this.allTokensUpper.add(tok);
    }

    // Process game tokens
    for (const token of langConfigJSON.GameTokens) {
      const up = token.toUpperCase();
      this.gameTokensUpper.add(up);

      if (up !== token) {
        this.gameTokensUpperToReadable.set(up, token);
      }

      if (token.length > LanguageTree.MaxTokenLen) {
        LanguageTree.MaxTokenLen = token.length;
      }

      if (!this.langTokensUpper.has(up)) {
        this.gameOnlyTokensUpper.add(up);
        this.allTokensUpper.add(up);
      }
    }

    // Process parameters
    if (langConfigJSON.MinimumWord) {
      LanguageTree.MinWordLength = langConfigJSON.MinimumWord;
    }

    if (langConfigJSON.WildcardToken) {
      LanguageTree.WildcardToken = langConfigJSON.WildcardToken;
    }
  }

  async readProbData(langCode, offline) {
    try {
      const probData = await LanguageTree.readFileJSON(`${LanguageTree.LangProbFilePrefix}${langCode}.json`, offline);
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

  async readLetterTree(langCode, offline) {
    try {
      const text = await LanguageTree.readFile(`${LanguageTree.LangTreeFilePrefix}${langCode}.txt`, offline);
      LanguageTree.generalData.letterTreeSize = text.length;

      this.#tokenTree = new TokenNode();
      this.#tokenTree.deserialize(text);
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
    let rando = LanguageTree.getRandom01();
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

    let rando = LanguageTree.getRandom01() * totalTmpProbs;
    for (const [key, prob] of this.#frequenciesTemp) {
      if (rando < prob) return key;
      rando -= prob;
    }

    throw new Error('No letters available');
  }

  getAllWildcardPartialWords(word, results = new Set()) {
    const wildIdx = word.indexOf(LanguageTree.WildcardToken);
    if (wildIdx < 0) {
      if (this.isValidPartialWord(word)) {
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

  getAllWildcardWords(word, results = new Set()) {
    const wildIdx = word.indexOf(LanguageTree.WildcardToken);
    if (wildIdx < 0) {
      if (this.isValidWord(word)) {
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
      this.getAllWildcardWords(part + option + rest, results);
    }

    return results;
  }

  isValidPartialWord(word) {
    if (!word.length) return false;
    const result = this.#tokenTree.isPartialOrFullWord(word.toUpperCase(), this);
    return result.isPartial;
  }

  isValidWord(word) {
    if (word.length < LanguageTree.MinWordLength) return false;
    const result = this.#tokenTree.isPartialOrFullWord(word.toUpperCase(), this);
    return result.isFullWord;
  }

  nextLettersInPartialWord(word) {
    if (!word.length) return null;
    const partial = this.#tokenTree.getPartialWord(word.toUpperCase(), this);
    return partial?.nextTokens ? Array.from(partial.nextTokens.keys()) : null;
  }

  getRandomWord = (length) => this.#tokenTree.getRandomWord(length, this);

  getNextGameToken = (word) => LanguageTree.getNextToken(word, this.gameTokensUpper);

  getReadableToken = (tok) => this.gameTokensUpperToReadable.get(tok) || tok;

  //
  // Static functions
  //

    // Read text file as JSON, online (default) or offline
  static async readFileJSON(filepath, offline) {
    if (offline) {
      const configContent = await fs.readFile(`${LanguageTree.PublicFilePath}${LanguageTree.LangDataFilePath}${filepath}`, 'utf-8');
      return JSON.parse(LanguageTree.stripBOM(configContent));
    }

    const response = await fetch(`${LanguageTree.LangDataFilePath}${filepath}`);
    if (!response.ok) {
      throw new Error(`${filepath} file missing`);
    }
    return await response.json();
  }

    // Read text file, online (default) or offline
  static async readFile(filepath, offline) {
    if (offline) {
      const configContent = await fs.readFile(`${LanguageTree.PublicFilePath}${LanguageTree.LangDataFilePath}${filepath}`, 'utf-8');
      return LanguageTree.stripBOM(configContent);
    }

    const response = await fetch(`${LanguageTree.LangDataFilePath}${filepath}`);
    if (!response.ok) {
      throw new Error(`${filepath} file missing`);
    }
    return await response.text();
  }


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

    for (let tokLen = 1; tokLen <= LanguageTree.MaxTokenLen && tokLen <= word.length; tokLen++) {
      const token = word.slice(0, tokLen);
      if (tokenList.has(token)) return token;
    }
    return null;
  }

  static lerp = (start, end, amt) => ((1 - amt) * start + amt * end);

  static getAveragedRandom01(avg) {
    const rand = LanguageTree.getRandom01();
    return rand < 0.5 ?
      LanguageTree.lerp(0, avg, rand * 2) :
      LanguageTree.lerp(avg, 1, (rand - 0.5) * 2);
  }

  static getAveragedRandomRange(min, avg, max) {
    const rand = LanguageTree.getAveragedRandom01((avg - min) / (max - min));
    return LanguageTree.lerp(min, max, rand);
  }

  // Remove first character (byte order mark) if available
  static stripBOM = (data) => data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data;


  static replaceRandomLetters(str, numToReplace, replacementChar) {
    let chars = str.split('');
    let availableIndices = [...Array(str.length).keys()]; // [0,1,2,...,length-1]

    // Ensure we don't try to replace more characters than available
    numToReplace = Math.min(numToReplace, str.length);

    for (let i = 0; i < numToReplace; i++) {
        // Get random index from remaining available positions
        const randomPos = Math.floor(Math.random() * availableIndices.length);
        const indexToReplace = availableIndices[randomPos];

        // Replace the character
        chars[indexToReplace] = replacementChar;

        // Remove this index from available positions
        availableIndices.splice(randomPos, 1);
    }

    return chars.join('');
}

  //
  //  Offline processing (menu items)
  //

  static async exportTree(langCode) {
    try {

      const langInstance = LanguageTree.getInstance();

      // Configuration
      langInstance.readLangConfig(langCode, true);

      // Read words file
      const wordsContent = await LanguageTree.readFile(`${LanguageTree.LangWordsFilePrefix}${langCode}.txt`, true);

      // Process words and create tree
      const { numWords, treeData, probabilities } = await LanguageTree.processWords(LanguageTree.stripBOM(wordsContent), langInstance);

      // Save tree file
      await fs.writeFile(`${LanguageTree.PublicFilePath}${LanguageTree.LangDataFilePath}${LanguageTree.LangTreeFilePrefix}${langCode}.txt`, treeData);

      // Save probabilities file
      await fs.writeFile(`${LanguageTree.PublicFilePath}${LanguageTree.LangDataFilePath}${LanguageTree.LangProbFilePrefix}${langCode}.json`, JSON.stringify(probabilities, null, 2));

      LanguageTree.generalData.letterTreeSize = treeData.length;

      console.log(`#words: ${numWords}`, LanguageTree.generalData);

    } catch (error) {
      console.error('Error exporting tree:', error);
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
      .filter(word => word.length >= LanguageTree.MinWordLength);

    const probabilities = new Map();
    const tree = new TokenNode();

    words.forEach(word => {
      tree.addWord(word, langInstance);

      for (let i = 0, tok;
        tok = LanguageTree.getNextToken(word.slice(i), langInstance.gameTokensUpper);
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

  static async testTree(langCode) {
    const langInstance = LanguageTree.getInstance();
    await langInstance.initialize(langCode, true);  // Offline initialization

    console.log('Random words:');
    for (let i = LanguageTree.MinWordLength; i < 20; ++i) {
      let word = langInstance.getRandomWord(i);
      if (!word)
        break;
      console.log(i, word);
    }

    let word = langInstance.getRandomWord(LanguageTree.MinWordLength);
    console.log(`\nCompletion: (random word '${word}')`);
    while (word) {
      let tokenOptions = langInstance.nextLettersInPartialWord(word);
      console.log(`Possible letters after '${word}':`, tokenOptions);
      if (tokenOptions?.length)
        word += tokenOptions[0];
      else
        word = null;
    }


    // word = 'FL*W**';
    word = LanguageTree.replaceRandomLetters(langInstance.getRandomWord(7), 3, LanguageTree.WildcardToken);
    console.log(`\nWildcard word ${word} completion:`, langInstance.getAllWildcardWords(word));
  }
}

class TokenNode {
  // Map of next tokens token(string) -> TokenNode
  nextTokens = null;
  // Is a complete word (along with previous tree TokenNode's)
  isWord = false;

  addWord(word, langInstance) {
    const token = LanguageTree.getNextToken(word, langInstance.langTokensUpper);
    let tokenNode;
    let restStr;

    if (token) {
      tokenNode = this.#addWordToken(token);
      restStr = word.slice(token.length);
      if (restStr.length > 0) {
        tokenNode.addWord(restStr, langInstance);
      } else {
        tokenNode.isWord = true;
        ++LanguageTree.generalData.numWords;
      }
    }

    // Fork for game only next token (e.g. QU)
    const gameToken = LanguageTree.getNextToken(word, langInstance.gameOnlyTokensUpper);
    if (!gameToken)
      return;

    tokenNode = this.#addWordToken(gameToken);
    restStr = word.slice(gameToken.length);
    if (restStr.length > 0) {
      tokenNode.addWord(restStr, langInstance);
    } else {
      tokenNode.isWord = true;
      ++LanguageTree.generalData.numWords;
    }
  }

  #addWordToken(token) {
    this.nextTokens ??= new Map();

    let wordTokenNode = this.nextTokens.get(token);
    if (!wordTokenNode) {
      wordTokenNode = new TokenNode();
      ++LanguageTree.generalData.numTokens;
      this.nextTokens.set(token, wordTokenNode);
    }
    return wordTokenNode;
  }

  isPartialOrFullWord(word, langInstance) {
    if (word.length === 0) {
      return { isPartial: true, isFullWord: this.isWord };
    }

    const token = LanguageTree.getNextToken(word, langInstance.langTokensUpper);
    if (!token) return { isPartial: false, isFullWord: false };

    const rest = word.slice(token.length);
    if (!this.nextTokens || !this.nextTokens.has(token)) {
      return { isPartial: false, isFullWord: false };
    }

    return this.nextTokens.get(token).isPartialOrFullWord(rest, langInstance);
  }

  getPartialWord(word, langInstance) {
    if (word.length === 0) return this;

    const token = LanguageTree.getNextToken(word, langInstance.langTokensUpper);
    if (!token) return null;

    const rest = word.slice(token.length);
    if (!this.nextTokens || !this.nextTokens.has(token)) return null;

    return this.nextTokens.get(token).getPartialWord(rest, langInstance);
  }

  getRandomWord(numTokens, langInstance, word = '') {
    if (!this.nextTokens || this.nextTokens.size === 0) return null;

    const options = Array.from(this.nextTokens.keys());
    while (options.length > 0) {
      const i = LanguageTree.getRandomRange(0, options.length);
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

  deserialize(text, posRef = { value: 0 }) {

    this.isWord = true;
    const peek = () => text[posRef.value] || '';
    const read = () => text[posRef.value++] || '';
    const incWordCount = () => this.isWord && ++LanguageTree.generalData.numWords;

    switch (peek()) {
      case '':
        return;

      case ']':
      case ')':
        incWordCount();
        return;

      case '(':
        this.isWord = false;
        break;

      case '[':
        break;

      default:
        incWordCount();
        return;
    }

    incWordCount();

    posRef.value++;

    while (posRef.value < text.length) {
      const c = read();
      if (c === ')' || c === ']') return;

      let token;
      if (c === '{') {
        token = '';
        while (posRef.value < text.length) {
          const nextChar = read();
          if (!nextChar || nextChar === '}') break;
          token += nextChar;
        }
      } else {
        token = c;
      }

      const nl = this.#addWordToken(token);
      nl.deserialize(text, posRef);
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
const isValid = lang.isValidWord('HELLO');

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