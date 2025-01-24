import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { GameManager } from '../GameManager';
import { LanguageTree } from '../LanguageTree';
import { Cave } from '../Cave';

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
    this.load.image(Cave.SquareImageName, 'squareBg.png');
  }

  create() {

    // Ensure instance is created and assets are loaded
    GameManager.GetInstance().initialize()
      .then(() => this.complete())
      .catch((error) => console.error('GameManager failed to initialize:', error));

    //this.cameras.main.setBackgroundColor(0x000000);

    // this.add.image(512, 384, 'background').setAlpha(0.5);
    this.gameContainer =
      this.add.container(0, 0)
      .setSize(this.cameras.main.width, this.cameras.main.height)

    // this.gameContainer.add(this.add.rectangle(100, 100, 100, 100, 0xff0000));

    EventBus.emit('current-scene-ready', this);
  }

  complete() {
    if (GameManager.Debug)
      console.log('Assets loaded');
    
    // this.add.text(512, 384, LanguageTree.GetInstance().getRandomWord(10), {
    //   fontFamily: 'NotoSans', fontSize: 80, color: '#000000',
    //   //stroke: '#000000', strokeThickness: 8,
    //   align: 'center'
    // })
    //   .setOrigin(0.5)
    //   .setDepth(100);
    
    this.cave = new Cave(this, this.gameContainer);
    this.gameContainer.add(this.cave);
  }

  changeScene() {
    this.scene.start('GameOver');
  }
}
