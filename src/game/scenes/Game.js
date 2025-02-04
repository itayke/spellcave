import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { GameManager } from '../GameManager';
import { LanguageTree } from '../LanguageTree';
import { Cave } from '../Cave';
import { CaveUI } from '../CaveUI';

export class Game extends Scene {


  // Container for the cave object + UI
  gameContainer;

  // Current cave
  cave;

  constructor() {
    super('Game');
  }

  preload() {
    this.load.setPath('assets/');
    this.load.image(Cave.SquareImage.name, Cave.SquareImage.file);
    this.load.image(Cave.SquareOutlineImage.name, Cave.SquareOutlineImage.file);
    this.load.image(CaveUI.CaveOverlayGradient.name, CaveUI.CaveOverlayGradient.file);
  }

  create() {

    // Ensure instance is created and assets are loaded
    GameManager.GetInstance().initialize()
      .then(() => this.complete())
      .catch((error) => console.error('GameManager failed to initialize:', error));

    //this.cameras.main.setBackgroundColor(0x000000);

    // this.add.image(512, 384, 'background').setAlpha(0.5);
    
    // this.gameContainer.add(this.add.rectangle(100, 100, 100, 100, 0xff0000));

    EventBus.emit('current-scene-ready', this);
  }

  complete() {
    if (GameManager.Debug)
      console.log('Assets loaded');

    this.gameContainer = this.add
      .container(0, 0)
      .setSize(this.cameras.main.width, this.cameras.main.height);

    // const circle = this.add.graphics({ fillStyle: { color: 0xff0000 } });
    // circle.fillCircle(0, 0, 1000);
    // this.gameContainer.add(circle);

    
    this.cave = new Cave(this, this.gameContainer);
    this.caveUI = new CaveUI(this, this.gameContainer);

  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
