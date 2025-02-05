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
  currentState = 0;
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

  // For tweening
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

    this.forceTint(Cave.BgTint);

    this.add(
      this.textObj = new Phaser.GameObjects.Text(scene,
        0, 0,
        readableToken, {
        fontFamily: Cave.FontName,
        fontSize: this.cave.fontSize,
        align: 'center'
      })
        .setLetterSpacing(Cave.FontSpacing)
        .setOrigin(0.5)
        .setDepth(100)
        .setColor(Cave.FontColor)
    );

    // Debug text
    this.debugText = new Phaser.GameObjects.Text(scene,
      Math.round(cave.squareSize / 2),
      Math.round(cave.squareSize * 0.85),
      `${row},${column}`, {
      fontFamily: Cave.FontName,
      color: '#FF0000',
      fontSize: this.cave.fontSize / 4,
      align: 'center'
    })
      .setLetterSpacing(Cave.FontSpacing)
      .setOrigin(0.5)
      .setDepth(100)
      .setVisible(false);
    this.add(this.debugText);
    
    this.updateState();

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

  onUpdateScale() {
    this.outlineImage?.setScale(this.scaleX * this.bgImageObj.scaleX);
  }

  onCompleteScale() {
    if (!this.isSelected()) {
      // Remove outline
      this.outlineImage?.destroy();
      this.outlineImage = null;

      // Back to previous container
      this.cave.squaresContainer.add(this);
      this.cave.squaresContainer.sendToBack(this);
    }
  }
  
  //
  //  Square states
  //

  updateState(immediate = false) {
    // Check if change is needed
    if (this.state === this.currentState)
      return false;
    if (GameManager.Debug >= 2) console.log(`${this.serializedRowColumn}: ${this.state} ${this.currentState}`);

    this.scene.tweens.killTweensOf(this);

    let selected = this.isSelected();
    let selectable = this.isSelectable();
    let valid = selected && this.isSelectedValid();

    let curTint = this.bgImageObj.tint;
    let newTint = valid ? Cave.BgTintSelectedValid :
      selected ? Cave.BgTintSelected :
        selectable ? Cave.BgTintSelectable :
          Cave.BgTint;
    
    if (newTint != curTint) {
      if (immediate)
        this.forceTint(newTint);
      else {
        const [r256, g256, b256] = Square.GetRGB256FromColor(newTint);
        this.scene.tweens.add({
          targets: this,
          tintR256: r256,
          tintG256: g256,
          tintB256: b256,
          duration: 75,
          ease: 'Quad.easeOut',
          // delay: selected ? 0 : Math.max(this.row - this.cave.topRow, 0) * 20,
          onUpdate: () => this.updateTint()
        });
      }
    }
    
    this.textObj
      .setColor(selectable ? Cave.FontColorSelectable : Cave.FontColor)
    
    // Scale
    let newScale = selected ? Square.SquareScaleSelected : 1;
    let curScale = this.scaleX;
    if (newScale != curScale) {
      if (immediate) {
        this.setScale(newScale, newScale);
        this.onUpdateScale();
        this.onCompleteScale();
      }
      else {
        // Scale tween
        this.scene.tweens.add({
          targets: this,
          scaleX: newScale,
          scaleY: newScale,
          duration: selected ? 175 : 100,
          // ease: Square.EaseOutBackExtreme, 
          // ease: 'Bounce.easeOut',
          ease: selected ? 
            (t => Cave.CurveQuad(t, 0.4, 1.6)) :
            (t => Cave.CurveQuad(t, 0.1, -0.25)),
          onUpdate: () => this.onUpdateScale(),
          onComplete: () => this.onCompleteScale()
        });
      }
    }

    this.currentState = this.state;
    return true;
  }

  setSelectable = (flag = true) =>
    this.setStateMask(Square.StateMask_Selectable, flag);
  isSelectable = () => this.getStateMask(Square.StateMask_Selectable);

  setSelected = (flag = true) =>
    this.setStateMask(Square.StateMask_Selected, flag);
  isSelected = () => this.getStateMask(Square.StateMask_Selected);

  setSelectedValid = (flag = true) =>
    this.setStateMask(Square.StateMask_SelectedValid, flag);
  isSelectedValid = () => this.getStateMask(Square.StateMask_SelectedValid);

  // Change flags and visualize (possibly delayed)
  selectSquare(select = true, delay = 0) {
    if (!this.setSelected(select))
      return false;

    if (delay > 0)
      this.scene.time.delayedCall(delay * 1000, () => this.selectSquareFinalize(select));
    else
      this.selectSquareFinalize(select);

    return true;
  }

  // Visual changes
  selectSquareFinalize(select) {
    if (!this.updateState())
      return;

    if (select) {

      // Remove old outline if during animation
      this.outlineImage?.destroy();
      // Outline image is placed separately in the original container
      this.outlineImage = this.scene.add.image(this.x, this.y, Cave.SquareOutlineImage.name)
        .setOrigin(0.5)   // Center
        .setDisplaySize(this.bgImageObj.displayWidth, this.bgImageObj.displayHeight);
      this.onUpdateScale();
      
      // Add to the topmost container, in the back
      this.cave.selectedSquaresContainer.addAt(this.outlineImage, 0);

      // Add to the topmost container, top
      this.cave.selectedSquaresContainer.add(this);
    }
  }

  /**
   * Sets or clears the specified flag(s) in the state mask.
   *
   * @param {number} flagMask - The bitmask representing the flag(s) to set or clear.
   * @param {boolean} [on=true] - If true, the flag(s) in the mask will be set; if false, the flag(s) will be cleared.
   * @returns {boolean} - Returns true if the state has changed, otherwise false.
   */
  setStateMask(flagMask, on = true) {
    let prevState = this.state;
    if (on)
      this.state |= flagMask;
    else
      this.state &= ~flagMask
    return this.state !== prevState;
  }
  
  /**
   * Checks if the specified flag(s) are set in the state mask.
   *
   * @param {number} flagMask - The bitmask representing the flag(s) to check.
   * @returns {boolean} - Returns true if the flag(s) are set, otherwise false.
   */
  getStateMask = flagMask => (this.state & flagMask) !== 0;

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
