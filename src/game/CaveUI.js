import Phaser from 'phaser';
import { Cave } from './Cave.js'
import { GameManager } from './GameManager.js';


export class CaveUI extends Phaser.GameObjects.Container {


  static CaveOverlayGradient = { name: 'overlayGradient', file: 'darkenGradient.png' };
  static DigIcon = { name: 'shovel', file: 'shovel.png' };

  static GradientVerticalRatio = 0.2;
  static GradientAlpha = 0.5;

  // Parent container
  inContainer;

  // Cave object
  cave;

  // The Y position of the center of the buttons
  buttonY;

  // Whether the current word is valid
  isValid = false;

  // Buttons
  digButton;
  digButtonScale;
  digButtonColor = Phaser.Display.Color.ValueToColor(GameManager.ButtonColorInvalid);

  constructor(scene, inContainer, cave) {
    super(scene, 0, 0);
    this.inContainer = inContainer;
    this.cave = cave;
    
    this
      .setSize(inContainer.width, inContainer.height)
      .setDepth(100);

    // const circle = scene.add.graphics({ fillStyle: { color: 0x00ff00 } });
    // circle.fillCircle(0, 200, 800);
    // this.add(circle);

    this.add(scene.add
      .image(this.width / 2, this.inContainer.height, CaveUI.CaveOverlayGradient.name)
      .setOrigin(0.5, 1)
      .setDisplaySize(this.width, this.inContainer.height * CaveUI.GradientVerticalRatio)
      .setAlpha(CaveUI.GradientAlpha)
    );

    let size = this.cave.squareSize * 1.1;
    this.buttonY = this.inContainer.height * 0.9;
    this.buttonY = Cave.Padding.top + Math.round(this.buttonY / this.cave.squareSize) * this.cave.squareSize;

    let buttonX = this.width * 0.8;
    buttonX = Cave.Padding.left + Math.round(buttonX / this.cave.squareSize) * this.cave.squareSize;

    // Dig button
    this.digButton = scene.add
      .image(buttonX, this.buttonY, CaveUI.DigIcon.name)
      .setOrigin(0.5, 0.35)
      .setDisplaySize(size, size)
      .setAlpha(1)
      .setTint(GameManager.ButtonColorInvalid.color)
      .setInteractive()
      .on('pointerdown', () => {
        console.log('Digging');
      });
    this.add(this.digButton);
    this.digButtonScale = this.digButton.scale;

    this.inContainer.add(this);
  }

  // Called from Cave when a word is typed
  // updateWord(isValid) {
  //   if (isValid && this.cave.typedWordSquares.length) {
  //     const lastSq = this.cave.typedWordSquares[this.cave.typedWordSquares.length - 1];
  //     const maxY = this.cave.typedWordSquares.reduce((max, square) => Math.max(max, square.y), 0);
  //     this.digButton.setPosition(
  //       Cave.Padding.left + lastSq.x,
  //       Cave.Padding.top + maxY + this.cave.squareSize * 2.5
  //     );
  //     this.digButton.setVisible(true);
  //     this.scene.tweens.killTweensOf(this.digButton);
  //     this.scene.tweens.add({
  //       targets: this.digButton,
  //       alpha: 1,
  //       duration: 150,
  //       ease: 'Quad.linear'
  //     });
  //   } else {
  //     this.scene.tweens.killTweensOf(this.digButton);
  //     this.scene.tweens.add({
  //       targets: this.digButton,
  //       alpha: 0,
  //       duration: 150,
  //       ease: 'Quad.linear',
  //       onComplete: () => this.digButton.setVisible(false)
  //     });
  //   }
  // }
  
  updateWord(isValid) {
    if (this.isValid === isValid)
      return;

    this.isValid = isValid;
    const targetColor = isValid ? GameManager.ButtonColorValid : GameManager.ButtonColorInvalid;

    this.scene.tweens.killTweensOf(this.digButtonColor);
    this.scene.tweens.add({
      targets: this.digButtonColor,
      red: targetColor.red,
      green: targetColor.green,
      blue: targetColor.blue,
      duration: 100,
      ease: 'Linear',
      onUpdate: () => this.digButton.setTint(this.digButtonColor.color)
    });

    this.scene.tweens.killTweensOf(this.digButton);
    this.scene.tweens.add({
      targets: this.digButton,
      scale: this.digButtonScale * (this.isValid ? 1.25 : 1),
      duration: 150,
      ease: this.isValid ?
        (t => Cave.CurveQuad(t, 0.4, 1.6)) :
        (t => Cave.CurveQuad(t, 0.6, 1.3))
    });
  }
}
