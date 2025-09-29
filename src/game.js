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
    init: function(playerName) {
        this.playerName = playerName || ('Player' + Math.floor(Math.random() * 10000));
    },
    create: function() {
        var width = this.game.width;
        var height = this.game.height;

        // --- Start physics system FIRST ---
        this.game.physics.startSystem(Phaser.Physics.P2JS);

        this.game.world.setBounds(-width*4, -height*4, width*8, height*8);
        this.game.stage.backgroundColor = '#444';

        // Add border to fit background
        var thickness = 40; // Thickness of the border walls
        var bgWidth = this.game.world.bounds.width - 60;
        var bgHeight = this.game.world.bounds.height - 60;
        var bgX = this.game.world.bounds.x + 30;
        var bgY = this.game.world.bounds.y + 30;

        // Vẽ border màu đỏ quanh background
        var borderGraphics = this.game.add.graphics(0, 0);
        borderGraphics.lineStyle(thickness, 0xff0000, 1); // thickness là độ dày, 0xff0000 là màu đỏ
        borderGraphics.drawRect(bgX, bgY, bgWidth, bgHeight);
        borderGraphics.endFill();

        // Left border
        var leftWall = this.game.add.sprite(bgX - thickness/2, bgY + bgHeight/2, null);
        this.game.physics.p2.enable(leftWall, false);
        leftWall.body.static = true;
        leftWall.body.setRectangle(thickness, bgHeight + thickness);

        // Right border
        var rightWall = this.game.add.sprite(bgX + bgWidth + thickness/2, bgY + bgHeight/2, null);
        this.game.physics.p2.enable(rightWall, false);
        rightWall.body.static = true;
        rightWall.body.setRectangle(thickness, bgHeight + thickness);

        // Top border
        var topWall = this.game.add.sprite(bgX + bgWidth/2, bgY - thickness/2, null);
        this.game.physics.p2.enable(topWall, false);
        topWall.body.static = true;
        topWall.body.setRectangle(bgWidth + thickness, thickness);

        // Bottom border
        var bottomWall = this.game.add.sprite(bgX + bgWidth/2, bgY + bgHeight + thickness/2, null);
        this.game.physics.p2.enable(bottomWall, false);
        bottomWall.body.static = true;
        bottomWall.body.setRectangle(bgWidth + thickness, thickness);

        //add tilesprite background nhỏ hơn world map 60px mỗi cạnh và căn giữa
        var background = this.game.add.tileSprite(
            bgX,
            bgY,
            bgWidth,
            bgHeight,
            'background'
        );

        //initialize physics and groups
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

        // Leaderboard data
        this.leaderboard = [];

        //create player
        var snake = new PlayerSnake(this.game, 'circle', 0, 0);
        snake.playerName = this.playerName;
        this.game.camera.follow(snake.head);

        // --- Create bots at random positions ---
        var botCount = 20; // or any number you want
        var bounds = this.game.world.bounds;
        for (var i = 0; i < botCount; i++) {
            var bx = Util.randomInt(bounds.x, bounds.x + bounds.width);
            var by = Util.randomInt(bounds.y, bounds.y + bounds.height);
            var botSnake = new BotSnake(this.game, 'circle', bx, by);
            botSnake.playerName = 'Bot' + (i+1);
        }

        //initialize snake groups and collision
        for (var i = 0 ; i < this.game.snakes.length ; i++) {
            var snake = this.game.snakes[i];
            snake.head.body.setCollisionGroup(this.snakeHeadCollisionGroup);
            snake.head.body.collides([this.foodCollisionGroup]);
            // Prevent snake from leaving the world bounds
            snake.head.body.collideWorldBounds = true;
            //callback for when a snake is destroyed
            snake.addDestroyedCallback(this.snakeDestroyed, this);
        }

        // Leaderboard text
        this.leaderboardText = this.game.add.text(16, 16, '', {
            font: '20px Arial',
            fill: '#fff',
            stroke: '#222',
            strokeThickness: 2
        });
        this.leaderboardText.fixedToCamera = true;

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

        // Update leaderboard
        this.updateLeaderboard();
        // ...existing code...
    },

    updateLeaderboard: function() {
        // Collect all snakes and their scores
        var scores = [];
        for (var i = 0; i < this.game.snakes.length; i++) {
            var snake = this.game.snakes[i];
            var name = snake.playerName || ('Bot' + (i+1));
            var score = Math.round(snake.snakeLength || 0);
            scores.push({ name: name, score: score });
        }
        // Sort by score descending
        scores.sort(function(a, b) { return b.score - a.score; });
        // Take top 10
        var topScores = scores.slice(0, 10);
        // Build leaderboard string
        var lbStr = 'LEADERBOARD\n';
        for (var i = 0; i < topScores.length; i++) {
            lbStr += (i+1) + '. ' + topScores[i].name + ' - ' + topScores[i].score + '\n';
        }
        this.leaderboardText.text = lbStr;
    // ...existing code...

        // --- Remove excess food after 1 minute if more than 350 exist ---
        var minFoodCount = 350;
        var maxFoodCount = 350;
        var now = this.game.time.now;
        for (var i = this.foodGroup.children.length - 1; i >= 0; i--) {
            var foodSprite = this.foodGroup.children[i];
            // Add a spawnTime property if not present
            if (!foodSprite.spawnTime) {
                foodSprite.spawnTime = now;
            }
        }
        if (this.foodGroup.children.length > maxFoodCount) {
            // Find and remove oldest food that has existed for more than 1 minute (60000 ms)
            var foodsToRemove = [];
            for (var i = 0; i < this.foodGroup.children.length; i++) {
                var foodSprite = this.foodGroup.children[i];
                if (now - foodSprite.spawnTime > 60000) {
                    foodsToRemove.push(foodSprite);
                }
            }
            // Remove only enough to bring count down to maxFoodCount
            var removeCount = this.foodGroup.children.length - maxFoodCount;
            for (var i = 0; i < foodsToRemove.length && i < removeCount; i++) {
                foodsToRemove[i].destroy();
            }
        }

        // --- Auto fill food if below threshold ---
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
        // Set spawnTime for food removal logic
        f.sprite.spawnTime = this.game.time.now;
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
