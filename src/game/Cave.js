import Phaser from 'phaser';
import { Square } from './Square.js';
import { GameManager } from './GameManager.js';
import { HashManager } from './HashManager.js';
import { LanguageTree } from './LanguageTree.js';

// A board of Squares
export class Cave extends Phaser.GameObjects.Container {

  static Padding = { left: 12, right: 12, top: 16, bottom: 12 };

  static SquareImage = { name: 'square', file: 'squareBg3.png' };
  static SquareOutlineImage = { name: 'squareBgOutline', file: 'squareBgOutline.png' };

  static Font = { name: 'CaveFont', file: 'PathwayGothicOne-Regular.ttf', sizeFactor: 0.55, spacing: 0 };

  // static FontFile = 'MuseoSans-500.otf';
  // static FontFile = 'OdibeeSans-Regular.ttf';  
  // static FontFile = 'SmoochSans-Medium.ttf';
  // static FontSizeFactor = 0.65;
  // static FontSpacing = -2.5;

  // static FontFile = 'Oswald-Regular.ttf';//'Oswald-Light.ttf';
  // static FontSizeFactor = 0.5;
    
  static ExtraRows = 8;

  /*
  static FontColor = '#000000';
  static FontColorSelectable = '#000000';
  static BgTint = Cave.ParseColorFromString('#b9b9b9');
  static BgTintSelectable = Cave.ParseColorFromString('#ffffff');
  static BgTintSelected = Cave.ParseColorFromString('#f0ef98');
  static BgTintSelectedValid = Cave.ParseColorFromString('#8ef77c');
  */

  // Distance to enable swipe
  static SwipeMoveThresholdDistSq = 5 * 5;

  // Value 0..1 representing the use of random (0.0) through language probabilites (1.0)
  static LanguageTokenVsRandomProbabilityScale = 0.8;
  // Weight of standard/random probability compared to token probability based on previous tokens
  // 1.0 to use the same weight, 0.0 is to only use previous token probabilities
  static StandardProbabilityWeight = 0.5;
  // Prevents the same token from appearing in adjacent squares. 
  // The closer the value to 0, the less likely it is to repeat. 
  static AdjacentTokenRepeatWeight = 0.35;

  // How permissive the diamond size is for swiping. 0.5 is a perfect center diamond, larger cuts into the corners.
  static SwipeDiamondThreshold = 0.5;
  // How straight (degrees) the swipe must be to be considered a straight line and allow for using the full square vs diamond
  static StraightAngleDegsThreshold = 12.5;

  // Frequency in secs between deselects in chain
  static DelayFrequencyDeselect = 0.04;
  // Factor to reduce the delay frequency for each subsequent deselect
  static DelayFrequencyDeselectFactor = 0.95;

  
  // Array[4] random seed
  #randomSeed4;
  // Function that returns a deterministic random number based on provided seed4
  #randomTokenFunction;

  // Visible squares window size
  columns;
  rowsOnScreen;

  // Minimum row held in squareLines
  minRow = 0;
  // Top Row presented on screen now
  topRow = 0;
  // Maximum row in squareLines
  maxRow = 100;

  // Map of square lines by column. Each line is an array of squares: { <row>: [ sq0, sq1, sq2... ] }
  squareLines = new Map();
  // Set of dug squares in serialized string notation (e.g. 12c)
  dugSquares = new Set();
  // Selectable squares
  selectableSquares = new Set();
  // Updated this move
  squaresPendingUpdate = new Set();
  // Current word (list of Square objs)
  typedWordSquares = [];
  // Current word (uppsercase string)
  typedWordString;

  // Size of each square in pixels, based on the game size
  squareSize;
  // Size of the font in pixels, based on square size
  fontSize;

  inContainer;
  // Container for all the squares
  squaresContainer;
  // Overlay for selected squares
  selectedSquaresContainer;

  // Tap/swipe info
  pointerDownPos = null;
  // In swipe mode
  swipeStarted = false;
  // Swipe square position { row: <int>, column: <int> } or null while not swiping
  swipeSquarePos = null;
  // Square clicked on pointer down
  pointerDownStartedOnSelectedSq = null;

  // Reference to the CaveUI
  caveUI;

  constructor(scene, inContainer, columns = 7, rowsOnScreen = 12, seedStr = null) {
    super(scene, 0, 0);
    this.inContainer = inContainer;
    this.columns = columns;
    this.rowsOnScreen = rowsOnScreen;
    this.maxRow = this.rowsOnScreen + Cave.ExtraRows;

    // const circle = scene.add.graphics({ fillStyle: { color: 0x00ff00 } });
    // circle.fillCircle(0, 200, 800);
    // this.add(circle);

    this.squareSize = (inContainer.width - Cave.Padding.left - Cave.Padding.right) / this.columns; // Round?

    this.setSize(this.squareSize * this.columns, inContainer.height - Cave.Padding.top);

    this.squaresContainer = scene.add
      .container(Math.round(Cave.Padding.left), Math.round(Cave.Padding.top))
      .setSize(this.width, this.height);
    this.add(this.squaresContainer);    

    this.selectedSquaresContainer = scene.add
    .container(Math.round(Cave.Padding.left), Math.round(Cave.Padding.top))
    .setSize(this.width, this.height);
    this.add(this.selectedSquaresContainer);    

    this.#randomSeed4 = seedStr ? HashManager.getSeed4FromString(seedStr) : HashManager.getRandomSeed4();
    this.#randomTokenFunction = HashManager.getRandomFunction(this.#randomSeed4);

    // Calculate the size of the squares based on the game size
    this.fontSize = this.squareSize * Cave.Font.sizeFactor;

    console.log(`Cave size ${this.width},${this.height}, square size ${this.squareSize}, font size ${this.fontSize}`);
    
    this.createSquares();
    this.resetTyping();

    this.updatePendingSquares(true);

    scene.input.on('pointerdown', (pointer, overObjects) => this.onPointerDown(pointer, overObjects));    
    scene.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
    scene.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
    scene.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
    this.inContainer.add(this);
  }

  resetTyping() {
    this.typedWordSquares = [];
    this.typedWordString = '';
    this.updateSelectableSquares();
    
    this.caveUI?.updateWord();
  }


  onPointerDown(pointer, overObjects) {
    // If over UI elements, ignore
    if (overObjects.length)
      return;

    this.pointerDownStartedOnSelectedSq = null;

    let column = Math.floor(pointer.x / this.squareSize);
    let row = this.topRow + Math.floor(pointer.y / this.squareSize);

    let square = this.getSquareAt(row, column);
    if (!square)
      return;

    if (GameManager.Debug >= 2) console.log(`${row},${column}`, square.isSelectable());
    
    // Already selected, deselect anything after
    if (square.isSelected()) {
      this.pointerDownStartedOnSelectedSq = square;
      this.deselectAfterSquare(square);
    }
    // Not selected and selectable, select it
    else if (square.isSelectable()) {
      this.selectSquare(square, true);
    }

    this.pointerDownPos = { x: pointer.x, y: pointer.y };
  }

  onPointerUp(pointer) {
    // Stationary (not swipe) and started on selected square - deselect it
    if (!this.swipeStarted &&
      this.pointerDownStartedOnSelectedSq) {
      this.selectSquare(this.pointerDownStartedOnSelectedSq, false);
    }

    this.pointerDownPos = null;
    this.swipeStarted = false;
  }

  onPointerMove(pointer) {
    if (!this.pointerDownPos)
      return;

    // Check if dist passed swipe threshold 
    if (!this.swipeStarted) {
      const distX = pointer.x - this.pointerDownPos.x;
      const distY = pointer.y - this.pointerDownPos.y;
      const distanceSq = distX * distX + distY * distY;

      if (distanceSq > Cave.SwipeMoveThresholdDistSq) {
        this.isSwipe = true;
        if (GameManager.Debug >= 1) console.log("Swipe starts");

        this.swipeStarted = true;
      }
    }
    else {
      let modX = (pointer.x % this.squareSize) / this.squareSize;
      let modY = (pointer.y % this.squareSize) / this.squareSize;
      // Check if pointer is moving diagonally
      let angleDeg = pointer.angle * (180 / Math.PI);
      let angleDeg90 = (angleDeg + 180) % 90;
      let angleIsStraight = Math.abs(angleDeg90 - 45) > (45 - Cave.StraightAngleDegsThreshold);
      
      // If straight movement, ensure it's in the the center diamond
      if (angleIsStraight ||
        Math.abs(modX - 0.5) + Math.abs(modY - 0.5) <= Cave.SwipeDiamondThreshold) {
        let column = Math.floor(pointer.x / this.squareSize);
        let row = this.topRow + Math.floor(pointer.y / this.squareSize);
        // And stepped into a new square
        if (!this.swipeSquarePos ||
          column != this.swipeSquarePos.column ||
          row != this.swipeSquarePos.row) {
          
          this.swipeSquarePos = { row, column };    
          let square = this.getSquareAt(row, column);
          if (!square)
            return;

          // Already selected, deselect anything after
          if (square.isSelected()) {
            this.deselectAfterSquare(square);
          }
          // Not selected and selectable, select it
          else if (square.isSelectable()) {
            this.selectSquare(square, true);
          }
        }
      }
    }
  }

  destroy() {
    this.scene.input.off('pointerdown');
    this.squaresContainer?.destroy();
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

  // Automatically update squares based on whether a word is being typed
  updateSelectableSquares() 
  {
    if (this.typedWordSquares.length) {
      const lastSq = this.typedWordSquares[this.typedWordSquares.length - 1];
      this.updateSelectableSquaresAround(lastSq);
    }
    else {
      this.updateSelectableSquaresNoWord();
    }
  }

  // Update squares by previous caves
  updateSelectableSquaresNoWord() {
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

  // Update selectable around specified square
  updateSelectableSquaresAround(sq) {
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

  updatePendingSquares(immediate = false) {
    this.squaresPendingUpdate.forEach(sq => sq.updateVisualState(immediate));
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

  selectSquare(sq, select) {    
    this.clearSelectableSquares();

    if (sq.selectSquare(select)) {
      // Pending visual update
      this.squaresPendingUpdate.add(sq);

      if (select) {
        // Add square to word
        this.typedWordSquares.push(sq);
      }
      else if (this.typedWordSquares[this.typedWordSquares.length - 1] === sq) {
        // If sq is the last in the word, remove it
        this.typedWordSquares.pop();
      }
    }

    this.updateSelectableSquares();
    this.updateTypedWord();
    this.updatePendingSquares();
  }

  deselectAfterSquare(sq) {
    const index = this.typedWordSquares.indexOf(sq);
    if (index === -1)
      return -1;

    this.clearSelectableSquares();

    let numDeselect = this.typedWordSquares.length - index - 1;
    if (numDeselect) {
      let delayFreq = Cave.DelayFrequencyDeselect;
      // Deselect the rest
      for (let i = index + 1, delay = 0;
        i < this.typedWordSquares.length;
        i++, delayFreq *= Cave.DelayFrequencyDeselectFactor) {
        this.typedWordSquares[i].selectSquare(false, delay += delayFreq);
      }
      // Remove through the end
      this.typedWordSquares.splice(index + 1);
    }

    // Find new selectables
    this.updateSelectableSquares();
    
    this.updateTypedWord();
    this.updatePendingSquares();

    return numDeselect;
  }

  clearSelectableSquares() {
    this.selectableSquares.forEach(sq => sq.setSelectable(false) && this.squaresPendingUpdate.add(sq));
    this.selectableSquares.clear();
  }

  updateTypedWord() {
    this.typedWordString = this.typedWordSquares.map(sq => sq.token).join('');
    let str = LanguageTree.GetInstance().getValidWildcardWord(this.typedWordString);
    let valid = !!str;
    if (valid && GameManager.Debug) console.log(this.typedWordString, '->', str);
    this.typedWordSquares.forEach(sq => sq.setSelectedValid(valid) && this.squaresPendingUpdate.add(sq));
    
    this.caveUI?.updateWord(valid);
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
  static CurveQuad = (t, cx, cy) => {
    if (t <= cx) {
      const qt = 1 - t / cx;
      return cy * (1 - qt * qt);
    } else {
      const qt = 1 - (t - cx) / (1 - cx);
      return cy + (1 - cy) * (1 - (2 * qt - qt * qt));
    }
  };
 
    
}
