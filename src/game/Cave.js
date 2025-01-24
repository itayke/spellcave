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
  static FontSizeFactor = 0.6;
  static ExtraRows = 8;

  static SquareImageName = 'square';
  
  randomSeed4;
  randomFunction;

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

    this.randomSeed4 = seedStr ? HashManager.getSeed4FromString(seedStr) : HashManager.getRandomSeed4();
    this.randomFunction = HashManager.getRandomFunction(this.randomSeed4);

    this.columns = columns;
    this.rowsOnScreen = rowsOnScreen;
    this.maxRow = this.rowsOnScreen + Cave.ExtraRows;

    // Calculate the size of the squares based on the game size
    this.fontSize = this.squareSize * Cave.FontSizeFactor;

    console.log(`Cave size ${this.width},${this.height}, square size ${this.squareSize}, font size ${this.fontSize}`);
    this.createSquares();
  }

  createSquares() {
    for (let row = this.minRow; row < this.maxRow; row++) {
      let lineSquares = [];
      for (let column = 0; column < this.columns; column++) {
        //this.scene.add.circle(column * this.squareSize, row * this.squareSize, 5, 0x000000);

        let token = LanguageTree.GetInstance().randomizeToken(false, this.randomFunction);
        let square = new Square(this.scene, this, row, column, token);
        this.add(square);
        lineSquares.push(square);
      }
      this.squares.set(row, lineSquares);
    }
  }

}
