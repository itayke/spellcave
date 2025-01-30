import Phaser from 'phaser';
import { Cave } from './Cave.js'
import { GameManager } from './GameManager.js';


export class CaveUI extends Phaser.GameObjects.Container {

  static CaveOverlayGradient = { name: 'overlayGradient', file: 'darkenGradient.png' };

  static GradientVerticalRatio = 0.2;
  static GradientAlpha = 0.5;

  inContainer;

  constructor(scene, inContainer) {
    super(scene, 0, 0);
    this.inContainer = inContainer;

    this
      .setSize(inContainer.width, inContainer.height)
      .setDepth(100);

    console.log(this)

    // const circle = scene.add.graphics({ fillStyle: { color: 0x00ff00 } });
    // circle.fillCircle(0, 200, 800);
    // this.add(circle);

    this.add(scene.add
      .image(this.width / 2, this.inContainer.height, CaveUI.CaveOverlayGradient.name)
      .setOrigin(0.5, 1)
      .setDisplaySize(this.width, this.inContainer.height * CaveUI.GradientVerticalRatio)
      .setAlpha(CaveUI.GradientAlpha)
    );

    this.inContainer.add(this);
  }
}
