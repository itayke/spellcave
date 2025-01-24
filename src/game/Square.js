import Phaser from 'phaser';
import { Cave } from './Cave';
import { GameManager } from './GameManager';
import { LanguageTree } from './LanguageTree';

// Square in the cave, with origin at the top-left corner
export class Square extends Phaser.GameObjects.Container {

  token;
  cave;
  textObj;

  debugText;

  constructor(scene, cave, row, column, token) {
    super(scene,
      Math.round(column * cave.squareSize),
      Math.round(row * cave.squareSize)
    );

    this.cave = cave;
    this.token = token;

    let readableToken = LanguageTree.GetInstance().getReadableToken(token);

    this.setSize(this.cave.squareSize, this.cave.squareSize);

    this.add(
      scene.add.image(0, 0, Cave.SquareImageName)
      .setOrigin(0)   // Top-left corner
      .setDepth(10)
      .setDisplaySize(Math.ceil(this.cave.squareSize), Math.ceil(this.cave.squareSize))
    );

    this.textObj = new Phaser.GameObjects.Text(scene,
      Math.round(cave.squareSize / 2),
      Math.round(cave.squareSize / 2),
      readableToken, {
      fontFamily: Cave.FontName,
      color: Cave.FontColor,
      fontSize: this.cave.fontSize,
      align: 'center'
    })
      .setLetterSpacing(Cave.FontSpacing)
      .setOrigin(0.5)
      .setDepth(100);
    this.add(this.textObj);

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

    if (GameManager.Debug >= 2)
      console.log(`Square ${row},${column} created with token ${token}`);
  }

  setDebugText(text) {
    this.debugText.setVisible(!!text);
    this.debugText.setText(text);
  }
}
