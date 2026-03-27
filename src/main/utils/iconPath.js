const path = require('path');
const { app } = require('electron');

function getAppIconPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'Keyboard-intento.ico');
    }

    return path.join(__dirname, '../../../resources/Keyboard-intento.ico');
}

module.exports = {
    getAppIconPath,
};
