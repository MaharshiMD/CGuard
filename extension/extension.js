const vscode = require('vscode');

function activate(context) {
    console.log('CodeGuard AI is now active!');

    let disposable = vscode.commands.registerCommand('codeguard.scanFile', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const code = editor.document.getText();
        const filename = editor.document.fileName;

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "CodeGuard: Analyzing code...",
            cancellable: false
        }, async (progress) => {
            // In a real implementation, this would call the Firebase Function
            // For the skeleton, we simulate a response
            return new Promise(resolve => {
                setTimeout(() => {
                    vscode.window.showInformationMessage('CodeGuard Analysis Complete: 12% Similarity found.');
                    resolve();
                }, 2000);
            });
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
