import { LanguageTree } from './LanguageTree.js';
import { FontManager } from './FontManager.js';
import { Cave } from './Cave.js';

// Singleton class that manages the game
export class GameManager {

  static Debug = 1;
  static LanguageCode = 'en';

  static #Instance;
  static GetInstance = () => GameManager.#Instance ?? new GameManager();  

  constructor() {
    GameManager.#Instance = this;
  }

  async initialize() {
    await Promise.all([
      LanguageTree.GetInstance().initialize(GameManager.LanguageCode),
      FontManager.GetInstance().loadFont(Cave.FontName, `assets/fonts/${Cave.FontFile}`)
      // FontManager.GetInstance().loadFont(GameManager.FontName, 'assets/fonts/NotoSans-Regular.ttf')
    ]);
  }
  
  
}