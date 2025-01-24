import { GameManager } from './GameManager.js';

export class FontManager {
  static Instance;

  // Map of loaded fonts, name -> FontFace
  loadedFonts = new Map();
  // Names of fonts that are pending load
  loadPendingSet = new Set();

  constructor() {
    FontManager.Instance = this;
  }

  static GetInstance = () => FontManager.Instance ?? new FontManager();

  /**
   * Loads a font from a given URL and adds it to the document's font set.
   *
   * @param {string} name - The name of the font to be loaded.
   * @param {string} url - The URL from which to load the font.
   * @param {function} [onComplete] - Optional callback function to be called when the font loading is complete.
   * @param {boolean} onComplete.success - Indicates whether the font was successfully loaded.
   * @param {boolean} onComplete.isEmpty - Indicates whether there are no more pending font loads.
   */
  async loadFont(name, url) {
    if (this.loadedFonts.has(name)) {
      if (GameManager.Debug)
        console.log(`loadFont ${name} already loaded`);
      return;
    }
    this.loadPendingSet.add(name);
    let font = new FontFace(name, `url(${url})`);
    font.load()
      .then(function (loaded) {
        document.fonts.add(loaded);

        this.loadedFonts.set(name, font);
        if (GameManager.Debug)
          console.log(`loadFont ${name} complete`);
        this.loadPendingSet.delete(name);
      }.bind(this))
      .catch(function (error) {
        console.log(`loadFont Error ${error} for url(${url})`);
        this.loadPendingSet.delete(name);
        throw error;
      }.bind(this));
  }

  /**
   * Checks if all pending font loads have completed.
   *
   * @returns {boolean} True if all pending font loads have completed.
   */
  isLoadComplete = () => this.loadPendingSet.size === 0;
}
