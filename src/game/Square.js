import Phaser from 'phaser';
import { Cave } from './Cave.js';
import { GameManager } from './GameManager.js';
import { LanguageTree } from './LanguageTree.js';


// Square in the cave, with origin at the top-left corner
export class Square extends Phaser.GameObjects.Container {


  static StateMask_Selectable = 1;
  static StateMask_Selected = 2;
  static StateMask_SelectedValid = 4;

  // Desired mask state (use updateState to make the change)
  state = 0;
  // Currently updated state
  currentState = 0;

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
        .setDepth(10)
        .setTint(Cave.BgTint)
        .setDisplaySize(Math.ceil(this.cave.squareSize), Math.ceil(this.cave.squareSize))
    );

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

  //
  //  Square states
  //

  updateState(immediate = false) {
    // Check if change is needed
    if (this.state === this.currentState)
      return false;
    if (GameManager.Debug >= 2) console.log(`${this.serializedRowColumn}: ${this.state} ${this.currentState}`);

    let selected = this.isSelected();
    let selectable = this.isSelectable();
    let valid = this.isSelectedValid();

    this.bgImageObj
      .setTint(
        valid ? Cave.BgTintSelectedValid :
          selected ? Cave.BgTintSelected :
            selectable ? Cave.BgTintSelectable :
              Cave.BgTint);
    this.textObj
      .setColor(selectable ? Cave.FontColorSelectable : Cave.FontColor)
    
    let newScale = selected ? Cave.SquareScaleSelected : 1;
    let curScale = this.scaleX;
    if (newScale != curScale) {
            
      if (immediate)
        this.setScale(newScale, newScale);
      else
        this.scene.tweens.add({
          targets: this,
          scaleX: newScale,
          scaleY: newScale,
          duration: 250,
          ease: Square.EaseOutBackExtreme // t => Cave.CurveQuad(t, 0.4, 2)
          // ease: 'Back.easeOut'
        });
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

}
