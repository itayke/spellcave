import Phaser from 'phaser';
import { Square } from './Square.js';
import { GameManager } from './GameManager.js';
import { HashManager } from './HashManager.js';
import { LanguageTree } from './LanguageTree.js';

// A board of Squares
export class Cave extends Phaser.GameObjects.Container {

  // Padding on sides
  static HorizPadding = 8;

  static FontName = 'CaveFont';

  // static FontFile = 'MuseoSans-500.otf';
  // static FontFile = 'OdibeeSans-Regular.ttf';  
  // static FontFile = 'SmoochSans-Medium.ttf';
  // static FontSizeFactor = 0.65;
  // static FontSpacing = -2.5;

  // static FontFile = 'Oswald-Regular.ttf';//'Oswald-Light.ttf';
  // static FontSizeFactor = 0.5;
  
  static FontFile = 'PathwayGothicOne-Regular.ttf';
  static FontSizeFactor = 0.55;
  
  static FontSpacing = 0;
  static FontColor = '#000000';
  static FontColorSelectable = '#000000';
  static ExtraRows = 8;

  static BgTint = Cave.ParseColorFromString('#ffffff');
  static BgTintSelectable = Cave.ParseColorFromString('#f6f5a3');
  //static BgTintSelected = Cave.ParseColorFromString('#91deeb');
  static BgTintSelected = Cave.ParseColorFromString('#f2b6ff');
  static BgTintSelectedValid = Cave.ParseColorFromString('#bfeb91');

  static SquareScaleSelected = 1.26;

  // Value 0..1 representing the use of random (0.0) through language probabilites (1.0)
  static LanguageTokenVsRandomProbabilityScale = 0.8;
  // Weight of standard/random probability compared to token probability based on previous tokens
  // 1.0 to use the same weight, 0.0 is to only use previous token probabilities
  static StandardProbabilityWeight = 0.5;
  // Prevents the same token from appearing in adjacent squares. 
  // The closer the value to 0, the less likely it is to repeat. 
  static AdjacentTokenRepeatWeight = 0.35;

  static GradientVerticalRatio = 0.2;
  static GradientAlpha = 0.5;

  static SquareImage = { name: 'square', file: 'squareBg3.png' };
  static CaveOverlayGradient = { name: 'overlayGradient', file: 'darkenGradient.png' };
  
  #randomSeed4;
  #randomTokenFunction;

  // Visible squares window size
  columns;
  rowsOnScreen;

  // Minimum row held in squareLines
  minRow = 0;
  // Top Row presented on screen now
  topRow = 0;
  // Maxumum row help in squareLines
  maxRow = 100;

  // Map of square lines by column. Each line is an array of squares: { <row>: [ sq0, sq1, sq2... ] }
  squareLines = new Map();
  // Set of dug squares in serialized string notation (e.g. 12c)
  dugSquares = new Set();
  // Selectable squares
  selectableSquares = new Set();
  // Updated this move
  squaresPendingUpdate = new Set();

  // Size of each square in pixels, based on the game size
  squareSize;
  // Size of the font in pixels, based on square size
  fontSize;

  // Container for all the squares
  squaresContainer;
  // Overlay 
  overlayContainer;

  constructor(scene, container, columns = 7, rowsOnScreen = 12, seedStr = null) {
    super(scene, 0, 0);

    this.columns = columns;
    this.rowsOnScreen = rowsOnScreen;
    this.maxRow = this.rowsOnScreen + Cave.ExtraRows;

    this.squareSize = (container.width - Cave.HorizPadding * 2) / this.columns; // Round?

    this.setSize(this.squareSize * this.columns, container.height);

    this.squaresContainer = scene.add
      .container(Math.round(Cave.HorizPadding), 0)
      .setSize(this.width, this.height);
    
    this.#randomSeed4 = seedStr ? HashManager.getSeed4FromString(seedStr) : HashManager.getRandomSeed4();
    this.#randomTokenFunction = HashManager.getRandomFunction(this.#randomSeed4);


    // Calculate the size of the squares based on the game size
    this.fontSize = this.squareSize * Cave.FontSizeFactor;

    console.log(`Cave size ${this.width},${this.height}, square size ${this.squareSize}, font size ${this.fontSize}`);
    

    // this.squaresContainer.add(scene.add.graphics()
    //   .fillStyle(0xff0000, 1)
    //   .fillCircle(0, 0, 30));
    this.setupOverlay();

    this.createSquares();
    this.setSelectableSquaresBeforeType();

    this.updatePendingSquares(true);

    scene.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
  }

  onPointerDown(pointer) {
    let column = Math.floor(pointer.x / this.squareSize);
    let row = this.topRow + Math.floor(pointer.y / this.squareSize);

    let square = this.getSquareAt(row, column);
    if (GameManager.Debug >= 1) console.log(`${row},${column}`, square.isSelectable());
    
    if (square?.isSelectable()) {
      this.selectSquare(square);
    }
  }

  destroy() {
    this.scene.input.off('pointerdown');
    this.squaresContainer?.destroy();
    this.overlayContainer?.destroy();
    this.squareLines?.clear();
    this.dugSquares?.clear();
    super.destroy();
  }

  getSquareAt = (row, column) => this.squareLines.get(row)?.[column] ?? null;
  getTokenAt = (row, column) => this.getSquareAt(row, column)?.token ?? null;

  createSquares() {
    const languageTree = LanguageTree.GetInstance();
    // let extraProbs = new Map();
    // const adjustExtraProbs = (y, x, extraProb) => {
    //   let tok = this.getTokenAt(y, x);
    //   if (tok) extraProbs.set(tok, (extraProbs.get(tok) ?? 0) + extraProb);
    // };

    let prevTokensList;
    const addTokenForPairLookup = (y, x) => {
      let tok = this.getTokenAt(y, x);
      if (tok) prevTokensList.push(tok);
    };

    for (let row = this.minRow; row < this.maxRow; row++) {
      let lineSquares = new Array (this.columns);
      this.squareLines.set(row, lineSquares);

      for (let column = 0; column < this.columns; column++) {

        let serializedRowColumn = Square.SerializedNameByRowColumn(row, column);
        if (this.dugSquares.has(serializedRowColumn))
          continue;
        // let token = languageTree.randomizeToken(this.#randomTokenFunction);

        prevTokensList = [];
        addTokenForPairLookup(row - 1, column - 1);
        addTokenForPairLookup(row - 1, column);
        addTokenForPairLookup(row - 1, column + 1);
        // addTokenForPairLookup(row, column - 1);    

        let token = languageTree.randomizeTokenFromPrevious(
          prevTokensList,
          Cave.StandardProbabilityWeight,
          Cave.AdjacentTokenRepeatWeight,
          Cave.LanguageTokenVsRandomProbabilityScale,
          this.#randomTokenFunction
        );

        // extraProbs.clear();

        // // Adjust extra probabilities based on the tokens in the previous row
        // adjustExtraProbs(row - 1, column - 1, -1);
        // adjustExtraProbs(row - 1, column, -1);
        // adjustExtraProbs(row - 1, column + 1, -1);
        // adjustExtraProbs(row, column - 1, -1);    
        
        // // Second ring
        // if (Cave.PreventTokenRepeatUseTwoRings) {
        //   adjustExtraProbs(row, column - 2, -0.5);
        //   adjustExtraProbs(row - 1, column - 2, -0.5);
        //   adjustExtraProbs(row - 2, column - 2, -0.5);
        //   adjustExtraProbs(row - 2, column - 1, -0.5);
        //   adjustExtraProbs(row - 2, column, -0.5);
        //   adjustExtraProbs(row - 2, column, -0.5);
        //   adjustExtraProbs(row - 2, column + 1, -0.5);
        //   adjustExtraProbs(row - 2, column + 2, -0.5);
        // }

        // let token = languageTree.randomizeTokenExtraProbs(extraProbs, Cave.PreventTokenRepeatFactor, this.#randomTokenFunction);
        
        let square = new Square(this.scene, this, row, column, token, serializedRowColumn);

        // square.setDebugText(pairLookupList.join());

        this.squaresContainer.add(square);
        lineSquares[column] = square;
      }
    }
    if (GameManager.Debug >= 2)
      this.traceCaveTokens();
  }

  setupOverlay() {
    this.overlayContainer = this.scene.add
      .container(0, 0)
      .setSize(this.width, this.height)
      .setDepth(100);

    const gradientImage = this.scene.add.image(this.width / 2, this.height, Cave.CaveOverlayGradient.name);
    gradientImage
      .setOrigin(0.5, 1)
      .setDisplaySize(this.width, this.height * Cave.GradientVerticalRatio)
      .setAlpha(Cave.GradientAlpha);
    this.overlayContainer.add(gradientImage);
  }

  setSelectableSquaresBeforeType() {
    this.selectableSquares.clear();

    const setSquareSelectable = (row, column) => {
      let sq = this.getSquareAt(row, column);
      if (!sq)
        return;
      
      sq.setSelectable() && this.squaresPendingUpdate.add(sq);
      this.selectableSquares.add(sq);      
    }

    // First row always open
    for (let i = 0; i < this.columns; ++i)
      setSquareSelectable(0, i);
    
    // And around dug squares
    this.dugSquares.forEach(serializedRowColumn => {
      const [row, column] = Square.RowColumnFromSerializedName(serializedRowColumn);
      
      setSquareSelectable(row - 1, column - 1);
      setSquareSelectable(row - 1, column);
      setSquareSelectable(row - 1, column + 1);
      setSquareSelectable(row, column - 1);
      setSquareSelectable(row, column + 1);
      setSquareSelectable(row + 1, column - 1);
      setSquareSelectable(row + 1, column);
      setSquareSelectable(row + 1, column + 1);
    });
  }

  setSelectableSquaresOnType(sq) {
    this.selectableSquares.clear();

    const setSquareSelectable = (row, column) => {
      let sq = this.getSquareAt(row, column);
      if (!sq || sq.isSelected())
        return;
      
      sq.setSelectable() && this.squaresPendingUpdate.add(sq);
      this.selectableSquares.add(sq);      
    }

    const row = sq.row;
    const column = sq.column;

    setSquareSelectable(row - 1, column - 1);
    setSquareSelectable(row - 1, column);
    setSquareSelectable(row - 1, column + 1);
    setSquareSelectable(row, column - 1);
    setSquareSelectable(row, column + 1);
    setSquareSelectable(row + 1, column - 1);
    setSquareSelectable(row + 1, column);
    setSquareSelectable(row + 1, column + 1);
  }

  deselectSquares() {
    this.selectableSquares.forEach(sq => sq.setSelectable(false) && this.squaresPendingUpdate.add(sq));
    this.selectableSquares.clear();
  }

  updatePendingSquares(immediate = false) {
    this.squaresPendingUpdate.forEach(sq => sq.updateState(immediate));
    this.squaresPendingUpdate.clear();
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

  //
  //  Typing/selection
  //

  selectSquare(sq, select = true) {
    this.squaresContainer.bringToTop(sq);
    this.deselectSquares();
    sq.setSelected(select) && this.squaresPendingUpdate.add(sq);

    this.setSelectableSquaresOnType(sq);
    // console.log(this.squaresPendingUpdate);
    this.updatePendingSquares();
  }

  //
  //  Helper functions
  //

  /**
   * Parses a color string in hexadecimal format and converts it to an integer representation.
   * Supports both 3-digit and 6-digit hexadecimal color codes.
   *
   * @param {string} colorStr - The hexadecimal color string to parse. It can be in the format of "#RGB" or "#RRGGBB".
   * @returns {number} The integer representation of the color. Returns 0 if the input string is not a valid hexadecimal color code.
   */
  static ParseColorFromString(colorStr) {
    var match = colorStr.match(/^#?([0-9a-f]{6})$/i);
    if (match) {
      const m = match[1];
      return (parseInt(m.slice(0, 2), 16) << 16) |
        (parseInt(m.slice(2, 4), 16) << 8) |
        parseInt(m.slice(4, 6), 16);
    }
    match = colorStr.match(/^#?([0-9a-f]{3})$/i);
    if (match) {
      const m = match[1];
      return (
        ((parseInt(m.charAt(0), 16) * 0x11) << 16) |
        ((parseInt(m.charAt(1), 16) * 0x11) << 8) |
        (parseInt(m.charAt(2), 16) * 0x11)
      );
    }
    return 0;
  }  

  /**
   * Calculates a quadratic curve value based on the given control point and progress.
   *
   * @param {number} t - Progress along the curve (0..1).
   * @param {number} cx - X position of the control point (0..1).
   * @param {number} cy - Y position of the control point (any number).
   * @returns {number} - The calculated y value on the quadratic curve.
   */
    static CurveQuad(t, cx, cy) {
      if (t <= cx) {
        // First half: quadratic curve from (0,0) through (cx/2, cy/2) to (cx,cy)
        const qt = t / cx;
        return cy * qt * qt;
      } else {
        // Second half: quadratic curve from (cx,cy) through ((1+cx)/2, (1+cy)/2) to (1,1)
        const qt = (t - cx) / (1 - cx);
        return cy + (1 - cy) * (2 * qt - qt * qt);
      }
    }
    
}
