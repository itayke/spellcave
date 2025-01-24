import { LanguageTree } from './LanguageTree';
import { FontManager } from './FontManager';
import { Cave } from './Cave';

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