import { Application, Assets, Sprite, Texture, Graphics, Renderer, WebGLRenderer } from "pixi.js";

type PixiRenderer = Renderer | WebGLRenderer;

export const isDestroyed = (app: Application): boolean => {
  if (!app.ticker || !app.renderer || !app.stage) return true;
  
  const renderer = app.renderer as WebGLRenderer;
  if (renderer.gl) {
    return renderer.gl.isContextLost();
  }
  return false;
};

export const generateTexture = (app: Application, graphic: Graphics): Texture => {
  const renderer = app.renderer as PixiRenderer;

  if (!isDestroyed(app)) {
    return renderer.generateTexture(graphic);
  }

  return Texture.WHITE;
};

export const degreesToRadians = (degrees: number) => {
  return degrees * (Math.PI / 180);
};

export const imageToSprite = async (app: Application, path: string) => {
  let texture;

  if (Assets.cache.has(path)) {
    texture = Assets.cache.get(path);
  } else {
    texture = await Assets.load(path);
  }

  const sprite = Sprite.from(texture);

  return sprite;
};

export const createRenderWithFPS = (app: Application, fps: number) => {
  let lastUpdateTime = 0;

  return () => {
    const currentTime = performance.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTime;

    if (timeSinceLastUpdate >= 1000 / fps) {
      app.ticker.update();
      app.render();
      lastUpdateTime = currentTime;
    }
  };
};

export const waitUntilPixiIsReady = (app: Application) => {
  return new Promise((resolve) => {
    app.canvas.addEventListener("pixi-initialized", resolve);
  });
};
