import { LanguageTree } from './LanguageTree.js';
import { FontManager } from './FontManager.js';
import { Cave } from './Cave.js';

// Singleton class that manages the game
export class GameManager {

  static Debug = 1;
  static LanguageCode = 'en';

  static SqColorUnselectable = Cave.ParseColorFromString('#3d3e43');
  static SqColorSelectable = Cave.ParseColorFromString('#ffffff');
  static SqColorSelected = Cave.ParseColorFromString('#ec9a3d');
  static SqColorValid = Cave.ParseColorFromString('#80ec3d');

  static ButtonColorValid = Phaser.Display.Color.ValueToColor('#80ec3d');
  static ButtonColorInvalid = Phaser.Display.Color.ValueToColor('#6e7674');

  static FontColorUnselectable = '#f6f7f9';
  static FontColorSelectable = '#000000';

  static #Instance;
  static GetInstance = () => GameManager.#Instance ?? new GameManager();  

  constructor() {
    GameManager.#Instance = this;
  }

  async initialize() {
    await Promise.all([
      LanguageTree.GetInstance().initialize(GameManager.LanguageCode),
      FontManager.GetInstance().loadFont(Cave.Font.name, `assets/fonts/${Cave.Font.file}`)
      // FontManager.GetInstance().loadFont(GameManager.FontName, 'assets/fonts/NotoSans-Regular.ttf')
    ]);
  }
  
  
}