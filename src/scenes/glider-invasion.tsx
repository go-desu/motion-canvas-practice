import { Img, makeScene2D, Node, Rect, View2D } from '@motion-canvas/2d';
import { all, chain, createRef, createRefArray, delay, ReferenceArray, sequence, ThreadGenerator, useLogger } from '@motion-canvas/core';

import cursorImg from '../../images/cursor.png'
import clickImg from '../../images/click.png'

const screen_width = 1920;
const screen_height = 1080;
const tile_size = 24;
const grid_width = Math.ceil(screen_width / tile_size);
const grid_height = Math.ceil(screen_height / tile_size);

let gen = 0

const glider = [
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1]
]

const beehive = [
  [0, 1, 1, 0],
  [1, 0, 0, 1],
  [0, 1, 1, 0],
]

const lerp = (min: number, max: number, current: number): number => {
  // Ensure the current value is within the range [min, max]
  // If max equals min, return 0 to avoid division by zero
  if (max === min) return 0;

  // Calculate the relative position of 'current' between 'min' and 'max'
  return (current - min) / (max - min);
}

const unlerp = (min: number, max: number, currentLerp: number): number => {
  // Calculate the corresponding value between 'min' and 'max'
  return min + (currentLerp * (max - min));
}

class Uint8Matrix {
  readonly array: Uint8Array
  constructor(
    public readonly width: number,
    public readonly height: number
  ) {
    this.array = new Uint8Array(width * height)
  }

  get midX() {
    return Math.floor(this.width / 2)
  }

  get midY() {
    return Math.floor(this.height / 2)
  }

  clear() {
    this.array.fill(0)
  }

  idx(x: number, y: number) {
    return x * this.height + y
  }

  get(x: number, y?: number) {
    let idx = x
    if (y !== undefined) {
      idx = this.idx(x, y)
    }
    return this.array[idx]
  }

  set(x: number, y?: number) {
    let idx = x
    if (y !== undefined) {
      idx = this.idx(x, y)
    }
    this.array[idx] = 1
  }

  unset(x: number, y?: number) {
    let idx = x
    if (y !== undefined) {
      idx = this.idx(x, y)
    }
    this.array[idx] = 0
  }

  wrap(x: number, y: number) {
    return [
      (x + this.width) % this.width,
      (y + this.height) % this.height,
    ] as const
  }

  countNeighborhood(x: number, y: number) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const [nx, ny] = this.wrap(x + dx, y + dy);
        if (this.get(nx, ny) === 1) count++;
      }
    }
    return count;
  }

  blit(x: number, y: number, bits: number[][]) {
    for (let _y = 0; _y < bits.length; _y++) {
      const row = bits[_y]
      for (let _x = 0; _x < row.length; _x++) {
        const val = row[_x]
        if (val === 1) {
          const [wx, wy] = this.wrap(x + _x, y + _y)
          this.set(wx, wy)
        }
      }
    }
  }
}

function compute(matrix: Uint8Matrix) {
  const changes = [] as Array<readonly [number, number]>

  for (let x = 0; x < grid_width; x++) {
    for (let y = 0; y < grid_height; y++) {
      const index = matrix.idx(x, y);
      const aliveNeighbors = matrix.countNeighborhood(x, y);
      const isAlive = matrix.get(index) === 1;

      if (isAlive) {
        if (aliveNeighbors < 2 || aliveNeighbors > 3) {
          changes.push([index, 0])
        }
      } else if (aliveNeighbors === 3) {
        changes.push([index, 1])
      }
    }
  }

  const gMin = 90
  const gMax = gMin + 5
  const iMin = 0
  const iMax = 15
  const gl = lerp(gMin, gMax, gen)
  const il = unlerp(iMin, iMax, gl)

  if (gen >= gMin && gen <= gMax) {
    for (let i = 0; i < il; i++) {
      changes.push([matrix.idx(matrix.midX + i, matrix.midY), 1])
    }
  }

  for (const [index, value] of changes) {
    if (value === 1) {
      matrix.set(index)
    } else {
      matrix.unset(index)
    }
  }

  gen += 1

  return changes
}

function render(changes: Array<readonly [number, number]>, tiles: Rect[]): any {
  for (const [index, value] of changes) {
    tiles[index].fill(value === 1 ? "black" : "white")
  }
}

const twomap = (width: number, height: number, callback: (x: number, y: number) => Node): Node[] => {
  const nodes = [] as Node[];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const node = callback(x, y);
      nodes.push(node);
    }
  }
  return nodes;
};

function* update(matrix: Uint8Matrix, tiles: Rect[]): any {
  const changes = compute(matrix)
  render(changes, tiles)
  yield
}

export default makeScene2D(function* (view) {
  gen = 0
  const matrix = new Uint8Matrix(grid_width, grid_height);
  for (let y = 0; y < grid_height / 5; y++) {
    for (let x = 0; x < grid_width / 5; x++) {
      matrix.blit(x * 5, y * 5, glider)
    }
  }

  // matrix.blit(0, 0, glider)

  // matrix.blit(matrix.midX - 3, matrix.midY - 2, beehive)

  // matrix.set(matrix.midX, matrix.midY)

  const tiles = createRefArray<Rect>();
  const total_width = tile_size * grid_width;
  const total_height = tile_size * grid_height;
  const half_width = Math.floor(total_width / 2);
  const half_height = Math.floor(total_height / 2);
  const half_size = Math.floor(tile_size / 2);

  view.add(
    <Rect x={0} y={0}>
      {twomap(grid_width, grid_height, (x, y) => {
        return (
          <Rect
            ref={tiles}
            x={0 - half_width + x * tile_size + half_size}
            y={0 - half_height + y * tile_size + half_size}
            width={tile_size}
            height={tile_size}
            fill={matrix.get(x, y) === 1 ? 'black' : 'white'}
          />
        );
      })}
    </Rect>
  );

  let cursor = createRef<Img>()
  view.add(<Img ref={cursor} src={cursorImg} x={0} y={1080 / 2} />);

  let click = createRef<Img>()
  view.add(<Img opacity={0} ref={click} src={clickImg} x={0} y={1080 / 2} />);

  function* cursorAnimation() {
    yield* all(
      cursor().position.y(110, .5),
      click().position.y(110, .5),
      cursor().position.x(120, .5),
      click().position.x(120, .5),
      chain(
        delay(.36, all(
          cursor().opacity(0, 0),
          click().opacity(1, 0),
          cursor().position.x(420, .4),
          click().position.x(420, .4)
        )),
        all(
          cursor().opacity(1, 0),
          click().opacity(0, 0),
        ),
        delay(2, all(
          cursor().rotation(-25, .1),
          cursor().position.x(1920 / 2 + 500, .5),
          cursor().position.y(180, .4),
        ))
      )
    )
  }

  const generations = 250;

  const jobs: ThreadGenerator[] = []
  for (let _gen = 0; _gen < generations; _gen++) {
    jobs.push(update(matrix, tiles))
  }

  yield* all(
    delay(.1, sequence(.05, ...jobs)),
    delay(4.2, cursorAnimation())
  );
});