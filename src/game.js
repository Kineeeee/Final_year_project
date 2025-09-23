Game = function(game) {}

Game.prototype = {
    preload: function() {

        //load assets
        this.game.load.image('circle','asset/circle.png');
    	this.game.load.image('shadow', 'asset/white-shadow.png');
    	this.game.load.image('background', 'asset/tile.png');

    	this.game.load.image('eye-white', 'asset/eye-white.png');
    	this.game.load.image('eye-black', 'asset/eye-black.png');

        this.game.load.image('food', 'asset/hex.png');
    },
    create: function() {
        var width = this.game.width;   // chiều rộng của canvas (màn hình hiển thị)
        var height = this.game.height; // chiều cao của canvas

        this.game.world.setBounds(-width*4, -height*4, width*8, height*8);
        this.game.stage.backgroundColor = '#444';

        //add tilesprite background
        var background = this.game.add.tileSprite(
            this.game.world.bounds.x,
            this.game.world.bounds.y,
            this.game.world.bounds.width,
            this.game.world.bounds.height,
            'background'
        );

        //initialize physics and groups
        this.game.physics.startSystem(Phaser.Physics.P2JS);
        this.foodGroup = this.game.add.group();
        this.snakeHeadCollisionGroup = this.game.physics.p2.createCollisionGroup();
        this.foodCollisionGroup = this.game.physics.p2.createCollisionGroup();

        // --- FIX: add food randomly across the entire world bounds ---
        var bounds = this.game.world.bounds;
        for (var i = 0 ; i < 350 ; i++) {
            var fx = Util.randomInt(bounds.x, bounds.x + bounds.width);
            var fy = Util.randomInt(bounds.y, bounds.y + bounds.height);
            this.initFood(fx, fy);
        }

        this.game.snakes = [];

        //create player
        var snake = new PlayerSnake(this.game, 'circle', 0, 0);
        this.game.camera.follow(snake.head);

        // --- Create bots at random positions ---
        var botCount = 20; // or any number you want
        var bounds = this.game.world.bounds;
        for (var i = 0; i < botCount; i++) {
            var bx = Util.randomInt(bounds.x, bounds.x + bounds.width);
            var by = Util.randomInt(bounds.y, bounds.y + bounds.height);
            new BotSnake(this.game, 'circle', bx, by);
        }

        //initialize snake groups and collision
        for (var i = 0 ; i < this.game.snakes.length ; i++) {
            var snake = this.game.snakes[i];
            snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
            snake.head.body.collides([this.foodCollisionGroup]);
            //callback for when a snake is destroyed
            snake.addDestroyedCallback(this.snakeDestroyed, this);
        }

        // --- Minimap setup ---
        this.minimapSize = 180; // px
        this.minimapPadding = 16; // px from screen edge
        this.minimapGraphics = this.game.add.graphics(0, 0);
        this.minimapGraphics.fixedToCamera = true;
    },
    /**
     * Main update loop
     */
    update: function() {
        //update game components
        for (var i = this.game.snakes.length - 1 ; i >= 0 ; i--) {
            this.game.snakes[i].update();
        }
        for (var i = this.foodGroup.children.length - 1 ; i >= 0 ; i--) {
            var f = this.foodGroup.children[i];
            f.food.update();
        }

        // --- Auto fill food if below threshold ---
        var minFoodCount = 350;
        if (this.foodGroup.children.length < minFoodCount) {
            var bounds = this.game.world.bounds;
            var toAdd = minFoodCount - this.foodGroup.children.length;
            for (var i = 0; i < toAdd; i++) {
                var fx = Util.randomInt(bounds.x, bounds.x + bounds.width);
                var fy = Util.randomInt(bounds.y, bounds.y + bounds.height);
                this.initFood(fx, fy);
            }
        }

        // --- Minimap update ---
        this.drawMinimap();
    },
    /**
     * Create a piece of food at a point
     * @param  {number} x x-coordinate
     * @param  {number} y y-coordinate
     * @return {Food}   food object created
     */
    initFood: function(x, y) {
        var f = new Food(this.game, x, y);
        f.sprite.body.setCollisionGroup(this.foodCollisionGroup);
        this.foodGroup.add(f.sprite);
        f.sprite.body.collides([this.snakeHeadCollisionGroup]);
        return f;
    },
    snakeDestroyed: function(snake) {
        //place food where snake was destroyed
        for (var i = 0 ; i < snake.headPath.length ;
        i += Math.round(snake.headPath.length / snake.snakeLength) * 2) {
            this.initFood(
                snake.headPath[i].x + Util.randomInt(-10,10),
                snake.headPath[i].y + Util.randomInt(-10,10)
            );
        }
    },
    drawMinimap: function() {
        // Clear previous minimap
        this.minimapGraphics.clear();

        // Minimap position and size
        var size = this.minimapSize;
        var pad = this.minimapPadding;
        var x = this.game.width - size - pad;
        var y = pad;

        // World bounds
        var bounds = this.game.world.bounds;

        // Draw minimap background
        this.minimapGraphics.beginFill(0x222222, 0.7);
        this.minimapGraphics.drawRect(x, y, size, size);
        this.minimapGraphics.endFill();

        // Draw every single food as a white dot
        for (var i = 0; i < this.foodGroup.children.length; i++) {
            var foodSprite = this.foodGroup.children[i];
            var fx = x + ((foodSprite.x - bounds.x) / bounds.width) * size;
            var fy = y + ((foodSprite.y - bounds.y) / bounds.height) * size;
            this.minimapGraphics.beginFill(0xffffff, 1); // white for food
            this.minimapGraphics.drawCircle(fx, fy, 3);
            this.minimapGraphics.endFill();
        }

        // Draw snakes (player and bots)
        for (var i = 0; i < this.game.snakes.length; i++) {
            var snake = this.game.snakes[i];
            var head = snake.head;
            var color = (i === 0) ? 0x00ff00 : 0xff0000; // Player is green, bots red

            // Map world position to minimap
            var mx = x + ((head.x - bounds.x) / bounds.width) * size;
            var my = y + ((head.y - bounds.y) / bounds.height) * size;

            this.minimapGraphics.beginFill(color, 1);
            this.minimapGraphics.drawCircle(mx, my, 6);
            this.minimapGraphics.endFill();
        }

        // Draw world border LAST to ensure it's always visible
        this.minimapGraphics.lineStyle(2, 0xffffff, 1);
        this.minimapGraphics.drawRect(x, y, size, size);
    }
};
