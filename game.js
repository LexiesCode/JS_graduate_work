'use strict';

class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    plus(vector) {
        if (!(vector instanceof Vector)) {
            throw new Error('Можно прибавлять к вектору только вектор типа Vector');
        }
        return new Vector(this.x + vector.x, this.y + vector.y);
    }

    times(num) {
        return new Vector(num * this.x, num * this.y);
    }
}

class Actor {
    constructor(pos = new Vector(0, 0), size = new Vector(1, 1), speed = new Vector(0, 0)) {
        if (!(pos instanceof Vector) || !(size instanceof Vector) || !(speed instanceof Vector)) {
            throw new Error('Все аргументы должны быть объектами типа Vector');
        }
        this.pos = pos;
        this.size = size;
        this.speed = speed;
    }

    act() {}

    get left() {
        return this.pos.x;
    }

    get top() {
        return this.pos.y;
    }

    get right() {
        return this.pos.x + this.size.x;
    }

    get bottom() {
        return this.pos.y + this.size.y;
    }

    get type() {
        return 'actor';
    }

    isIntersect(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Необходимо использовать объект типа Actor');
        }
        if (actor === this) {
            return false;
        }
        if (actor.left >= this.right) {
            return false;
        }
        if (actor.right <= this.left) {
            return false;
        }
        if (actor.top >= this.bottom) {
            return false;
        }
        if (actor.bottom <= this.top) {
            return false;
        }
        return true;
    }

}

class Level {
    constructor(grid = [], actors = []) {
        this.grid = grid.slice();
        this.actors = actors.slice();
        this.player = this.actors.find((actor) => actor.type === 'player');
        this.height = this.grid.length;
        this.width = Math.max(0, ...this.grid.map(subArr => subArr.length));
        this.status = null;
        this.finishDelay = 1;
    }

    isFinished() {
        return this.status !== null && this.finishDelay < 0;
    }

    actorAt(actor) {
        if (!(actor instanceof Actor)) {
            throw new Error('Необходимо использовать объект типа Actor');
        }
        return this.actors.find(el => el.isIntersect(actor));
    }

    obstacleAt(pos, size) {
        if (!(pos instanceof Vector) || !(size instanceof Vector)) {
            throw new Error('Все аргументы должны быть объектами типа Vector');
        }

        const xStart = Math.floor(pos.x);
        const xEnd = Math.ceil(pos.x + size.x);
        const yStart = Math.floor(pos.y);
        const yEnd = Math.ceil(pos.y + size.y);

        if (xStart < 0 || xEnd > this.width || yStart < 0) {
            return 'wall';
        }

        if (yEnd > this.height) {
            return 'lava';
        }

        for (let y = yStart; y < yEnd; y++) {
            for (let x = xStart; x < xEnd; x++) {
                let scene = this.grid[y][x];
                if (scene) {
                    return scene;
                }
            }
        }
    }

    removeActor(actor) {
        let actorIndex = this.actors.indexOf(actor);
        if (actorIndex !== -1) {
            this.actors.splice(this.actors.indexOf(actor), 1);
        }
    }

    noMoreActors(type) {
        return !this.actors.some(el => el.type === type);
    }

    playerTouched(obstacle, actor) {
        if (this.status !== null) {
            return;
        }
        if (obstacle === 'lava' || obstacle === 'fireball') {
            this.status = 'lost';
        }
        if (obstacle === 'coin') {
            this.removeActor(actor);
            if (this.noMoreActors('coin')) {
                this.status = 'won';
            }
        }
    }
}


class LevelParser {
    constructor(dictionary = {}) {
        this.dictionary = Object.assign({}, dictionary);
    }

    actorFromSymbol(symbol) {
        return this.dictionary[symbol];
    }

    obstacleFromSymbol(symbol) {
        switch (symbol) {
            case 'x':
                return 'wall';
            case '!':
                return 'lava';
            default:
                return undefined;
        }
    }

    createGrid(arr = []) {
        return arr.map((line) => line.split('').map(symbol => this.obstacleFromSymbol(symbol)));
    }

    createActors(plan) {
        let actors = [];
        for (let y = 0; y < plan.length; y++) {
            for (let x = 0; x < plan[y].length; x++) {
                let movingObj = this.dictionary[plan[y][x]];
                if (typeof movingObj === 'function') {
                    let actor = new movingObj(new Vector(x, y));
                    if (actor instanceof Actor) {
                        actors.push(actor);
                    }
                }
            }
        }
        return actors;
    }

    parse(plan) {
        return new Level(this.createGrid(plan), this.createActors(plan));
    }
}


class Fireball extends Actor {
    constructor(pos, speed) {
        super(pos, new Vector(1, 1), speed);
    }

    get type() {
        return 'fireball';
    }

    getNextPosition(time = 1) {
        return this.pos.plus(this.speed.times(time));
    }

    handleObstacle() {
        this.speed = this.speed.times(-1);
    }

    act(time, level) {
        let nextPos = this.getNextPosition(time);
        if (level.obstacleAt(nextPos, this.size)) {
            this.handleObstacle();
        } else {
            this.pos = nextPos;
        }
    }
}

class HorizontalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(2, 0));
    }
}

class VerticalFireball extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 2));
    }
}

class FireRain extends Fireball {
    constructor(pos) {
        super(pos, new Vector(0, 3));
        this.startPos = pos;
    }

    handleObstacle() {
        this.pos = this.startPos;
    }
}

class Coin extends Actor {
    constructor(pos = new Vector) {
        super(pos.plus(new Vector(0.2, 0.1)), new Vector(0.6, 0.6));
        this.springSpeed = 8;
        this.springDist = 0.07;
        this.spring = Math.random() * 2 * Math.PI;
        this.startPos = this.pos;
    }

    get type() {
        return 'coin';
    }

    updateSpring(time = 1) {
        this.spring += this.springSpeed * time;
    }

    getSpringVector() {
        let y = Math.sin(this.spring) * this.springDist;
        return new Vector(0, y);
    }

    getNextPosition(time = 1) {
        this.updateSpring(time);
        return this.pos = this.startPos.plus(this.getSpringVector());
    }

    act(time) {
        this.pos = this.getNextPosition(time);
    }
}

class Player extends Actor {
    constructor(pos = new Vector) {
        super(pos.plus(new Vector(0, -0.5)), new Vector(0.8, 1.5));
    }
    get type() {
        return 'player';
    }
}

const actorDict = {
    '@': Player,
    'v': FireRain,
    'o': Coin,
    '=': HorizontalFireball,
    '|': VerticalFireball
};

const parser = new LevelParser(actorDict);

loadLevels()
    .then((schemas) => {
        runGame(JSON.parse(schemas), parser, DOMDisplay)
            .then(() => alert('Вы выиграли!'))
    });