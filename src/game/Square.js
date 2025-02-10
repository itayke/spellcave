import Phaser from 'phaser';
import { Cave } from './Cave.js';
import { GameManager } from './GameManager.js';
import { LanguageTree } from './LanguageTree.js';


// Square in the cave, with origin at the top-left corner
export class Square extends Phaser.GameObjects.Container {

  static StateMask_Selectable = 1;
  static StateMask_Selected = 2;
  static StateMask_SelectedValid = 4;

  static ImageSquareSizeFactor = 1.12;
  static SquareScaleSelected = 1.25;

  // Desired mask state (use updateState to make the change)
  state = 0;
  // Currently updated state
  visualState = 0;
  // Time (s) to delay update
  updateDelay = 0;

  row;
  column;
  serializedRowColumn;

  // Returns a serialized name for the square based on row and column, e.g. 12c for row 12 col 2 (0 based)
  static SerializedNameByRowColumn = (row, column) => `${row}${String.fromCharCode(97 + column)}`
  // Convert 12c notation to numeric [ row, column ]
  static DeserializeNameToRowColumn = (name) => [
    parseInt(name.slice(0, -1)),
    name.charCodeAt(name.length - 1) - 97
  ];

  token;
  cave;
  textObj;
  bgImageObj;

  debugText;

  outlineImage;

  // Private field for tweening
  #selectTween;
  #tintTween;
  
  // For tweening
  #desiredTint;
  tintR256 = 0;
  tintG256 = 0;
  tintB256 = 0;

  constructor(scene, cave, row, column, token, serializedRowColumn) {
    super(scene,
      Math.round((column + 0.5) * cave.squareSize),
      Math.round((row + 0.5) * cave.squareSize)
    );

    this.row = row;
    this.column = column;
    this.serializedRowColumn = serializedRowColumn ?? Square.SerializedNameByRowColumn(this.row, this.column);

    this.cave = cave;
    this.token = token;

    let readableToken = LanguageTree.GetInstance().getReadableToken(token);

    this.setSize(this.cave.squareSize, this.cave.squareSize);

    this.add(
      this.bgImageObj = scene.add.image(0, 0, Cave.SquareImage.name)
        .setOrigin(0.5)   // Center
        .setDisplaySize(Math.ceil(Square.ImageSquareSizeFactor * this.cave.squareSize),
          Math.ceil(Square.ImageSquareSizeFactor * this.cave.squareSize))
    );

    this.forceTint(GameManager.SqColorUnselectable);

    this.add(
      this.textObj = new Phaser.GameObjects.Text(scene,
        0, 0,
        readableToken, {
        fontFamily: Cave.Font.name,
        fontSize: this.cave.fontSize,
        align: 'center'
      })
        .setLetterSpacing(Cave.Font.spacing)
        .setOrigin(0.5)
        .setDepth(100)
        .setColor(GameManager.FontColorUnselectable)
    );

    // Debug text
    this.debugText = new Phaser.GameObjects.Text(scene,
      Math.round(cave.squareSize / 2),
      Math.round(cave.squareSize * 0.85),
      `${row},${column}`, {
      fontFamily: Cave.Font.name,
      color: '#FF0000',
      fontSize: this.cave.fontSize / 4,
      align: 'center'
    })
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.add(this.debugText);
    
    this.updateVisualState();

    if (GameManager.Debug >= 2)
      console.log(`Square ${row},${column} created with token ${token}`);
  }

  forceTint(color) {
    [this.tintR256, this.tintG256, this.tintB256] = Square.GetRGB256FromColor(color);
    this.bgImageObj.setTint(color);
  }

  updateTint() {
    // console.log(`${Math.floor(this.tintR256)}, ${Math.floor(this.tintG256)}, ${Math.floor(this.tintB256)}`);
    const toByte = (n) => Math.min(Math.max(Math.round(n), 0), 255)
    this.bgImageObj.setTint(Square.GetColorFromRGB256(
      toByte(this.tintR256),
      toByte(this.tintG256),
      toByte(this.tintB256)
    ));
  }

  onCompleteTint() {
    this.#tintTween = null;

    if (this.#desiredTint != this.bgImageObj.tint)
      this.forceTint(this.#desiredTint);
  }

  onUpdateScale() {
    this.outlineImage?.setScale(this.scaleX * this.bgImageObj.scaleX);
  }

  onCompleteScale() {
    this.#selectTween = null;
    if (!this.isSelected()) {
      // Remove outline
      this.outlineImage?.destroy();
      this.outlineImage = null;

      // Back to previous container
      this.cave.squaresContainer.add(this);
      this.cave.squaresContainer.sendToBack(this);
    }

    // Update still pending
    if (this.state !== this.visualState)
      this.updateVisualState(true);
  }
  
  //
  //  Square states
  //

  updateVisualState(immediate = false) {
    // Check if change is needed
    if (this.state === this.visualState)
      return false;

    if (GameManager.Debug >= 2) console.log(`${this.serializedRowColumn}: ${this.state} ${this.visualState}`);

    let prevSelected = this.isSelected(this.visualState);
    this.visualState = this.state;

    let selected = this.isSelected(this.state);
    let selectable = this.isSelectable(this.state);
    let valid = selected && this.isSelectedValid(this.state);

    this.textObj.setColor(selectable || selected ? GameManager.FontColorSelectable : GameManager.FontColorUnselectable)
        
    this.#desiredTint = valid ? GameManager.SqColorValid :
      selected ? GameManager.SqColorSelected :
        selectable ? GameManager.SqColorSelectable :
          GameManager.SqColorUnselectable;
    
    if (this.#desiredTint != this.bgImageObj.tint) {
      this.#tintTween?.destroy();
      if (immediate) {
        this.#tintTween = null;
        this.forceTint(this.#desiredTint);
        this.onCompleteTint();
      }
      else {
        const [r256, g256, b256] = Square.GetRGB256FromColor(this.#desiredTint);
        this.#tintTween = this.scene.tweens.add({
          targets: this,
          tintR256: r256,
          tintG256: g256,
          tintB256: b256,
          duration: selected != prevSelected ? 25 : 150,
          ease: 'Quad.easeOut',
          // delay: selected ? 0 : Math.max(this.row - this.cave.topRow, 0) * 20,
          onUpdate: () => this.updateTint(),
          onComplete: () => this.onCompleteTint()
        });
      }      
    }
    
    // Scale
    if (selected != prevSelected) {
      let newScale = selected ? Square.SquareScaleSelected : 1;
      this.#selectTween?.destroy();

      this.startSelectSquare(selected);
      if (immediate) {
        this.setScale(newScale, newScale);
        this.onUpdateScale();
        this.onCompleteScale();
      }
      else {
        // Scale tween
        this.#selectTween = this.scene.tweens.add({
          targets: this,
          scaleX: newScale,
          scaleY: newScale,
          duration: selected ? 175 : 125,
          // ease: Square.EaseOutBackExtreme, 
          // ease: 'Bounce.easeOut',
          ease: selected ? 
            (t => Cave.CurveQuad(t, 0.4, 1.6)) :
            (t => Cave.CurveQuad(t, 0.6, 1.3)),
          onUpdate: () => this.onUpdateScale(),
          onComplete: () => this.onCompleteScale()
        });
      }
    }

    return true;
  }

  startSelectSquare(select) {
    if (select) {
      // Remove old outline if during animation
      this.outlineImage?.destroy();
      // Outline image is placed separately in the original container
      this.outlineImage = this.scene.add.image(this.x, this.y, Cave.SquareOutlineImage.name)
        .setOrigin(0.5)   // Center
        .setDisplaySize(this.bgImageObj.displayWidth, this.bgImageObj.displayHeight);
      this.onUpdateScale();
      
      // Add outline to the topmost container, in the back
      this.cave.selectedSquaresContainer.addAt(this.outlineImage, 0);

      // Add to the topmost container, top
      this.cave.selectedSquaresContainer.add(this);
    }
    else {
      if (this.outlineImage)
        this.cave.squaresContainer.add(this.outlineImage);
      this.cave.squaresContainer.add(this);
    }
  }

  setStateMask(flagMask, on = true) {
    let prevState = this.state;
    if (on)
      this.state |= flagMask;
    else
      this.state &= ~flagMask
    return this.state !== prevState;
  }
  
  getStateMask = (flagMask, state = this.state) => (state & flagMask) !== 0;

  setSelectable = (flag = true) =>
    this.setStateMask(Square.StateMask_Selectable, flag);
  isSelectable = (state = this.state) => this.getStateMask(Square.StateMask_Selectable, state);

  setSelected = (flag = true) =>
    this.setStateMask(Square.StateMask_Selected, flag);
  isSelected = (state = this.state) => this.getStateMask(Square.StateMask_Selected, state);

  setSelectedValid = (flag = true) =>
    this.setStateMask(Square.StateMask_SelectedValid, flag);
  isSelectedValid = (state) => this.getStateMask(Square.StateMask_SelectedValid, state);

  // Change flags and visualize (possibly delayed)
  selectSquare(select = true, delay = 0) {
    if (!this.setSelected(select))
      return false;

    if (delay > 0)
      this.scene.time.delayedCall(delay * 1000, () => this.updateVisualState());
    else
      this.updateVisualState();

    return true;
  }

  destroy() {
    this.#selectTween?.destroy();
    this.#tintTween?.destroy();
    this.outlineImage?.destroy();
    this.textObj.destroy();
    this.bgImageObj.destroy();
    this.debugText.destroy();
    super.destroy();
  }

  //
  // Visuals
  //

  setDebugText(text) {
    this.debugText.setVisible(!!text);
    this.debugText.setText(text);
  }

  static EaseOutBackExtreme = x => {
    const c1 = 6; // Increased from 1.70158 for more overshoot
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  // Convert color to RGB256
  static GetRGB256FromColor = (color) => [
    (color >> 16) & 0xff,
    (color >> 8) & 0xff,
    color & 0xff
  ];
  
  // Convert RGB256 to color
  static GetColorFromRGB256 = (r, g, b) => (r << 16) | (g << 8) | b;

}
