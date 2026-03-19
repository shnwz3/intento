const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

/**
 * Configure and start auto-updates for the application
 * Checks GitHub Releases for new builders/versions
 */
function setupAutoUpdates() {
    // Check for updates and automatically notifies user on download
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        console.log('✨ Update available. Downloading in background...');
    });

    autoUpdater.on('update-downloaded', (info) => {
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: `Version ${info.version} has been downloaded. Restart the application to apply the update?`,
            buttons: ['Restart Now', 'Later']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('❌ Auto-updater error:', err.message);
    });
}

module.exports = setupAutoUpdates;
