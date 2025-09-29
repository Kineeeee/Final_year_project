var MenuState = function() {};

MenuState.selectedMap = null;

MenuState.prototype = {
    init: function(args) {
        // Nhận kỷ lục từ state chuyển sang
        this.lastScore = args && args.lastScore !== undefined ? args.lastScore : null;
        // Nếu có mapKey truyền về thì lưu lại
        if (args && args.mapKey) {
            MenuState.selectedMap = args.mapKey;
        }
    },
    create: function() {
        // Nền màu gradient đơn giản
        this.game.stage.backgroundColor = '#222';
        var bg = this.game.add.graphics(0, 0);
        bg.beginFill(0x222244, 1);
        bg.drawRect(0, 0, this.game.width, this.game.height);
        bg.endFill();

    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;

        // Logo hoặc tiêu đề
        var title = this.game.add.text(centerX, centerY - 100, 'Slither.io Clone', {
            font: 'bold 56px Arial',
            fill: '#fff',
            stroke: '#00eaff',
            strokeThickness: 6,
            shadow: true
        });
        title.anchor.set(0.5);

        // Hiển thị kỷ lục vừa đạt được nếu có
        if (this.lastScore !== null && this.lastScore !== undefined) {
            var scoreText = this.game.add.text(centerX, centerY - 60, 'Kỷ lục vừa đạt: ' + this.lastScore, {
                font: '32px Arial', fill: '#ff0', stroke: '#222', strokeThickness: 3
            });
            scoreText.anchor.set(0.5);
        }

        // Ô nhập tên
        var nameLabel = this.game.add.text(centerX, centerY - 20, 'Tên người chơi:', {
            font: '28px Arial', fill: '#fff', stroke: '#00eaff', strokeThickness: 2
        });
        nameLabel.anchor.set(0.5);

        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Nhập tên hoặc để trống';
        nameInput.style.position = 'absolute';
    nameInput.style.left = (window.innerWidth / 2 - 120) + 'px';
    nameInput.style.top = (window.innerHeight / 2 + 10) + 'px';
        nameInput.style.width = '240px';
        nameInput.style.height = '32px';
        nameInput.style.fontSize = '22px';
        nameInput.style.textAlign = 'center';
        nameInput.style.zIndex = 10;
        document.body.appendChild(nameInput);

        // Nút PLAY với hiệu ứng hover
        var playButton = this.game.add.text(centerX, centerY + 70, 'PLAY', {
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

        // --- Map selection UI ---
        var mapOptions = [
            { key: 'background', name: 'Cơ bản' },
            { key: 'hex_background', name: 'Tổ ong' },
            { key: 'tile_green', name: 'Gạch xanh' }
        ];
        // Sử dụng lựa chọn trước đó nếu có
        var selectedMap = MenuState.selectedMap || mapOptions[0].key;
        var mapText = this.game.add.text(centerX, window.innerHeight - 80, 'Chọn map:', {
            font: '28px Arial', fill: '#fff', stroke: '#00eaff', strokeThickness: 2
        });
        mapText.anchor.set(0.5);

        var buttonSpacing = 160;
        var mapButtons = [];
        for (var i = 0; i < mapOptions.length; i++) {
            var btn = this.game.add.text(centerX + (i - 1) * buttonSpacing, window.innerHeight - 40, mapOptions[i].name, {
                font: 'bold 26px Arial', fill: '#ff4444', stroke: '#fff', strokeThickness: 3
            });
            btn.anchor.set(0.5);
            btn.inputEnabled = true;
            btn.input.useHandCursor = true;
            btn.mapKey = mapOptions[i].key;
            btn.events.onInputUp.add(function(b) {
                selectedMap = b.mapKey;
                MenuState.selectedMap = selectedMap;
                for (var j = 0; j < mapButtons.length; j++) {
                    mapButtons[j].fill = '#ff4444';
                }
                b.fill = '#00eaff';
            }, this, 0, btn);
            mapButtons.push(btn);
        }
        // Đảm bảo highlight đúng nút đã chọn khi quay lại menu
        for (var i = 0; i < mapButtons.length; i++) {
            if (mapButtons[i].mapKey === selectedMap) {
                mapButtons[i].fill = '#00eaff';
            } else {
                mapButtons[i].fill = '#ff4444';
            }
        }

        // Sửa lại sự kiện nút PLAY để truyền mapKey
        playButton.events.onInputUp.removeAll();
        playButton.events.onInputUp.add(function() {
            var playerName = nameInput.value.trim();
            if (!playerName) {
                playerName = 'Player' + Math.floor(Math.random() * 10000);
            }
            nameInput.parentNode.removeChild(nameInput);
            MenuState.selectedMap = selectedMap;
            this.game.state.start('Game', true, false, { playerName: playerName, mapKey: selectedMap });
        }, this);

        // Thêm hướng dẫn nhỏ
        var guide = this.game.add.text(centerX, centerY + 130, 'Nhấn PLAY để bắt đầu!', {
            font: '24px Arial',
            fill: '#fff',
            stroke: '#00eaff',
            strokeThickness: 2
        });
        guide.anchor.set(0.5);

        // Xóa input khi chuyển state hoặc reload
        this.game.state.onStateChange.add(function() {
            if (nameInput && nameInput.parentNode) {
                nameInput.parentNode.removeChild(nameInput);
            }
        });
    }
};
