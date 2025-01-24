import Phaser from 'phaser';
import { Square } from './Square';
import { GameManager } from './GameManager';
import { HashManager } from './HashManager';
import { LanguageTree } from './LanguageTree';

// A board of Squares
export class Cave extends Phaser.GameObjects.Container {

  static FontName = 'CaveFont';
  static FontFile = 'MuseoSans-500.otf';
  static FontSpacing = -2.5;

  static FontColor = '#000000';
  static FontSizeFactor = 0.55;
  static ExtraRows = 8;

  // Prevents the same token from appearing in adjacent squares. 
  // The closer the value to 1.0, the less likely it is to repeat. 
  static PreventTokenRepeatFactor = 0.6;
  static PreventTokenRepeatUseTwoRings = true;

  static SquareImageName = 'square';
  
  #randomSeed4;
  #randomTokenFunction;

  columns = 7;
  rowsOnScreen = 12;
  minRow = 0;
  maxRow = 100;

  // Map of square lines by column. Each line is an array of squares.
  squares = new Map();

  // Size of each square in pixels, based on the game size
  squareSize;
  // Size of the font in pixels, based on square size
  fontSize;

  constructor(scene, container, columns = 7, rowsOnScreen = 12, seedStr = null) {
    super(scene, 0, 0);
    this.squareSize = container.width / this.columns; // Round?

    this.setSize(this.squareSize * this.columns, container.height);
    // this.add(scene.add.graphics()
    //     .fillStyle(0x404040)
    //     .fillRect(0, 0, this.width, this.height));

    this.#randomSeed4 = seedStr ? HashManager.getSeed4FromString(seedStr) : HashManager.getRandomSeed4();
    this.#randomTokenFunction = HashManager.getRandomFunction(this.#randomSeed4);

    this.columns = columns;
    this.rowsOnScreen = rowsOnScreen;
    this.maxRow = this.rowsOnScreen + Cave.ExtraRows;

    // Calculate the size of the squares based on the game size
    this.fontSize = this.squareSize * Cave.FontSizeFactor;

    console.log(`Cave size ${this.width},${this.height}, square size ${this.squareSize}, font size ${this.fontSize}`);
    this.createSquares();
  }

  getSquareAt = (row, column) => this.squares.get(row)?.[column] ?? null;
  getTokenAt = (row, column) => this.getSquareAt(row, column)?.token ?? null;

  createSquares() {
    const languageTree = LanguageTree.GetInstance();
    let extraProbs = new Map();
    const adjustExtraProbs = (y, x, extraProb) => {
      let tok = this.getTokenAt(y, x);
      if (tok) extraProbs.set(tok, (extraProbs.get(tok) ?? 0) + extraProb);
    };

    for (let row = this.minRow; row < this.maxRow; row++) {
      let lineSquares = [];
      this.squares.set(row, lineSquares);

      for (let column = 0; column < this.columns; column++) {
        // let token = languageTree.randomizeToken(this.randomFunction);

        extraProbs.clear();

        // Adjust extra probabilities based on the tokens in the previous row
        adjustExtraProbs(row - 1, column - 1, -1);
        adjustExtraProbs(row - 1, column, -1);
        adjustExtraProbs(row - 1, column + 1, -1);
        adjustExtraProbs(row, column - 1, -1);    
        
        // Second ring
        if (Cave.PreventTokenRepeatUseTwoRings) {
          adjustExtraProbs(row, column - 2, -0.5);
          adjustExtraProbs(row - 1, column - 2, -0.5);
          adjustExtraProbs(row - 2, column - 2, -0.5);
          adjustExtraProbs(row - 2, column - 1, -0.5);
          adjustExtraProbs(row - 2, column, -0.5);
          adjustExtraProbs(row - 2, column, -0.5);
          adjustExtraProbs(row - 2, column + 1, -0.5);
          adjustExtraProbs(row - 2, column + 2, -0.5);
        }

        let token = languageTree.randomizeTokenExtraProbs(extraProbs, Cave.PreventTokenRepeatFactor, this.#randomTokenFunction);
        let square = new Square(this.scene, this, row, column, token);

        // square.setDebugText(JSON.stringify(Object.fromEntries(extraProbs)));

        this.add(square);
        lineSquares.push(square);
      }
    }
    if (GameManager.Debug >= 2)
      this.traceCaveTokens();
  }

  // Debug function to print the cave tokens
  traceCaveTokens() {
    console.log('Cave:');
    for (let row = this.minRow; row < this.maxRow; row++) {
      let line = `${row}: `;
      for (let column = 0; column < this.columns; column++) {
        line += `${this.getTokenAt(row, column)} `;
      }
      console.log(line);
    }
  }

}
