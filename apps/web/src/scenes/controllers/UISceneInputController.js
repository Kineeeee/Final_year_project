export class UISceneInputController {
    bindKeyboard(uiScene, gameScene) {
        if (!uiScene?.input?.keyboard) return;

        this.unbindKeyboard(uiScene);

        const one = () => uiScene.tryUseItem(gameScene, 'speed');
        let two;
        let three;

        if (uiScene.gameMode !== 'normal') {
            two = () => uiScene.tryUseItem(gameScene, 'ghost');
            uiScene._keyboardBindings = [
                ['keydown-ONE', one],
                ['keydown-TWO', two]
            ];
        } else {
            two = () => uiScene.tryUseItem(gameScene, 'magnet');
            three = () => uiScene.tryUseItem(gameScene, 'ghost');
            uiScene._keyboardBindings = [
                ['keydown-ONE', one],
                ['keydown-TWO', two],
                ['keydown-THREE', three],
            ];
        }

        uiScene._keyboardBindings.forEach(([evt, fn]) => uiScene.input.keyboard.on(evt, fn));

        const f3 = () => uiScene.toggleDebugOverlay();
        uiScene.input.keyboard.on('keydown-F3', f3);
        uiScene._keyboardBindings.push(['keydown-F3', f3]);
    }

    unbindKeyboard(uiScene) {
        if (!uiScene?._keyboardBindings) return;
        if (uiScene.input && uiScene.input.keyboard && uiScene.input.keyboard.off) {
            uiScene._keyboardBindings.forEach(([evt, fn]) => uiScene.input.keyboard.off(evt, fn));
        }
        uiScene._keyboardBindings = null;
    }
}