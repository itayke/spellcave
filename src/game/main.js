import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import Phaser from 'phaser';
import { Preloader } from './scenes/Preloader';

let Zoom;
let GameSize;

let isMobile = (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

function calcZoomGameSize() {
  Zoom = 1 / (isMobile ? Math.min(window.devicePixelRatio, 3) : 2);
  let bottomMargin = isMobile ? 125 : 0;
  GameSize = {
    x: 512 / Zoom,
    y: Math.max(window.innerHeight / Zoom - bottomMargin, 1000),
  };
  console.log(`Pixel ratio ${window.devicePixelRatio}, zoom ${Zoom}, window size ${GameSize.x},${GameSize.y}`);
}

console.clear();
calcZoomGameSize();

// Find out more information about the Game Config at:
// https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
  type: Phaser.AUTO,
  multiTexture: true,
  //antialias: true,
  pixelArt: false,
  width: GameSize.x,
  height: GameSize.y,
  zoom: Zoom,
  parent: 'game-container',
  backgroundColor: '#000',
  scene: [
    Game,
  ]
};

const StartGame = (parent) => {
  return new Phaser.Game({ ...config, parent });
}

export default StartGame;
/*
import { Game } from './scenes/Game';
import Phaser, { Game as PhaserGame } from 'phaser';

let Zoom;
let GameSize;

function CalcZoomGameSize() {
  // If mobile, use devicePixelRatio (limited to prevent an oversized canvas)
  // Desktop browsers should always use a double-pixel density for clarity

  let isMobile = Game.IsMobile();
  Zoom = 1 / (isMobile ? Math.min(window.devicePixelRatio, 3) : 2);
  let bottomMargin = isMobile ? 125 : 0; 
  GameSize = {
    x: Math.max(window.innerWidth / Zoom, 1000),
    y: Math.max(window.innerHeight / Zoom - bottomMargin, 1000),
  };
  if (Game.Debug)
    console.log(`Pixel ratio ${window.devicePixelRatio}, zoom ${Zoom}, window size ${GameSize.x},${GameSize.y}`);
}

CalcZoomGameSize();
const config = {
  type: Phaser.AUTO,
  multiTexture: true,
  // pixelArt: true,
  antialias: true,
  mode: Phaser.Scale.NONE,
  width: GameSize.x,
  height: GameSize.y,
  zoom: Zoom,
  parent: 'game-container',
  backgroundColor: '#e5e7eb',
  input: {
    // Desktop scroll to zoom events allowed on page (PC)
    mouse: { preventDefaultWheel: false },
    // Pinch to zoom event allowed on page (Mobile)
    // REMOVED because swipes triggered browser-back gestures
    // touch: { capture: false },
  },
  scene: [Game],
};

window.addEventListener('resize', () => {
  CalcZoomGameSize();
  Game.Instance?.scale.resize(GameSize.x, GameSize.y);
});

const StartGame = (parent) => {
  return new PhaserGame({ ...config, parent });
};

export default StartGame;
*/