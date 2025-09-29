var MenuState = function(game) {};

MenuState.prototype = {
    create: function() {
        // Nền màu gradient đơn giản
        this.game.stage.backgroundColor = '#222';
        var bg = this.game.add.graphics(0, 0);
        bg.beginFill(0x222244, 1);
        bg.drawRect(0, 0, this.game.width, this.game.height);
        bg.endFill();

        var centerX = this.game.world.centerX;
        var centerY = this.game.world.centerY;

        // Logo hoặc tiêu đề
        var title = this.game.add.text(centerX, centerY - 100, 'Slither.io - Clone', {
            font: 'bold 56px Arial',
            fill: '#fff',
            stroke: '#00eaff',
            strokeThickness: 6,
            shadow: true
        });
        title.anchor.set(0.5);

        // Nút PLAY với hiệu ứng hover
        var playButton = this.game.add.text(centerX, centerY + 20, 'PLAY', {
            font: 'bold 44px Arial',
            fill: '#ff4444',
            stroke: '#fff',
            strokeThickness: 4
        });
        playButton.anchor.set(0.5);
        playButton.inputEnabled = true;
        playButton.input.useHandCursor = true;

        // Hiệu ứng hover: đổi màu và phóng to
        playButton.events.onInputOver.add(function() {
            playButton.fill = '#fff';
            playButton.scale.set(1.15);
        });
        playButton.events.onInputOut.add(function() {
            playButton.fill = '#ff4444';
            playButton.scale.set(1);
        });

        playButton.events.onInputUp.add(function() {
            this.game.state.start('Game');
        }, this);

        // Thêm hướng dẫn nhỏ
        var guide = this.game.add.text(centerX, centerY + 80, 'Nhấn PLAY để bắt đầu!', {
            font: '24px Arial',
            fill: '#fff',
            stroke: '#00eaff',
            strokeThickness: 2
        });
        guide.anchor.set(0.5);
    }
};
